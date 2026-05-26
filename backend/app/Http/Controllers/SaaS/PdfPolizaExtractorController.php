<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Aseguradora;
use App\Models\Ramo;
use App\Models\Cliente;
use App\Models\Vendedor;
use App\Services\AIResponseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PdfPolizaExtractorController extends Controller
{
    private function getBrokerId(Request $request)
    {
        if ($request->has('authenticated_broker_id')) {
            return $request->get('authenticated_broker_id');
        }
        if ($request->has('broker_id')) {
            return $request->get('broker_id');
        }
        $authType = $request->get('auth_type');
        if ($authType === 'empleado') {
            $user = $request->get('authenticated_empleado');
        } else {
            $user = $request->user() ?? \Illuminate\Support\Facades\Auth::user();
        }
        if ($user && isset($user->broker_id) && $user->broker_id) {
            return $user->broker_id;
        }
        // Fallback desarrollo
        if (app()->environment('local')) {
            return (int) env('DEV_BROKER_ID', 32);
        }
        throw new \Exception('Broker no encontrado');
    }

    /**
     * Extract policy data from PDF text using DeepSeek AI + catalog matching
     */
    public function extract(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $request->validate([
                'text' => 'required|string|min:20',
            ]);

            $pdfText = $request->input('text');

            // 1. Load catalogs for this broker
            $aseguradoras = Aseguradora::where('broker_id', $brokerId)->pluck('nombre')->toArray();
            $ramos = Ramo::where('broker_id', $brokerId)->pluck('nombre')->toArray();
            $vendedores = Vendedor::where('broker_id', $brokerId)->pluck('nombres')->toArray();

            // 2. Build the AI prompt
            $prompt = $this->buildPrompt($pdfText, $aseguradoras, $ramos);

            // 3. Call DeepSeek via AIResponseService
            $aiService = new AIResponseService();
            $aiResult = $aiService->generateResponse($prompt, [], [
                'system_prompt' => 'Eres un experto en extracción de datos de pólizas de seguros colombianas. Responde ÚNICAMENTE con JSON válido, sin texto adicional.',
                'max_tokens' => 2000,
                'temperature' => 0.05,
            ]);

            if (!$aiResult['success'] || empty($aiResult['response'])) {
                Log::warning('[PDF EXTRACTOR] AI failed', ['error' => $aiResult['error'] ?? 'empty response']);
                return response()->json([
                    'success' => false,
                    'message' => 'No se pudo procesar el PDF con IA',
                    'error' => $aiResult['error'] ?? 'Sin respuesta',
                ], 500);
            }

            // 4. Parse AI JSON response
            $extracted = $this->parseAiJson($aiResult['response']);
            if (!$extracted) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se pudo interpretar la respuesta de IA',
                ], 500);
            }

            // 5. Fuzzy-match against real catalogs
            $matched = $this->matchCatalogs($extracted, $brokerId);

            return response()->json([
                'success' => true,
                'data' => $matched,
            ]);

        } catch (\Exception $e) {
            Log::error('[PDF EXTRACTOR] Error', ['message' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Extract policy data from PDF page images using GPT-4o-mini vision (same approach as ChatGPT)
     */
    public function extractVision(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $request->validate([
                'images' => 'required|array|min:1|max:10',
                'images.*' => 'required|string', // base64 encoded PNG images
                'text' => 'nullable|string', // optional: extracted text as fallback context
            ]);

            $images = $request->input('images');
            $fallbackText = $request->input('text', '');

            // 1. Load catalogs for this broker
            $aseguradoras = Aseguradora::where('broker_id', $brokerId)->pluck('nombre')->toArray();
            $ramos = Ramo::where('broker_id', $brokerId)->pluck('nombre')->toArray();

            // 2. Check OpenAI key
            $openaiKey = env('OPENAI_API_KEY', '');
            if (empty($openaiKey)) {
                Log::warning('[PDF VISION] OpenAI key not configured, falling back to text extraction');
                // Fallback to text-based extraction
                if (!empty($fallbackText)) {
                    return $this->extractFromText($fallbackText, $brokerId, $aseguradoras, $ramos);
                }
                return response()->json(['success' => false, 'message' => 'OpenAI API key not configured and no fallback text'], 500);
            }

            // 3. Build vision prompt
            $asegList = implode(', ', array_slice($aseguradoras, 0, 50));
            $ramoList = implode(', ', array_slice($ramos, 0, 50));
            $visionPrompt = $this->buildVisionPrompt($asegList, $ramoList);

            // 4. Build messages with images
            $contentParts = [
                ['type' => 'text', 'text' => $visionPrompt],
            ];

            // Add each page image (limit to first 4 pages for token economy)
            foreach (array_slice($images, 0, 4) as $idx => $base64Image) {
                // If already a full data URL, use as-is; otherwise wrap it
                if (str_starts_with($base64Image, 'data:image/')) {
                    $imageUrl = $base64Image;
                } else {
                    $imageUrl = 'data:image/jpeg;base64,' . $base64Image;
                }
                $contentParts[] = [
                    'type' => 'image_url',
                    'image_url' => [
                        'url' => $imageUrl,
                        'detail' => 'high',
                    ],
                ];
            }

            // 5. Call GPT-4o-mini with vision
            Log::info('[PDF VISION] Calling GPT-4o-mini', ['pages' => count($images), 'broker' => $brokerId]);

            $response = \Illuminate\Support\Facades\Http::withHeaders([
                'Authorization' => "Bearer {$openaiKey}",
                'Content-Type' => 'application/json',
            ])->timeout(60)->post('https://api.openai.com/v1/chat/completions', [
                'model' => 'gpt-4o-mini',
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'Eres un experto en extracción de datos de pólizas de seguros colombianas. Analiza las imágenes de las páginas del PDF y extrae TODOS los datos. Responde ÚNICAMENTE con JSON válido.',
                    ],
                    [
                        'role' => 'user',
                        'content' => $contentParts,
                    ],
                ],
                'max_tokens' => 2500,
                'temperature' => 0.05,
            ]);

            if (!$response->successful()) {
                $error = $response->json('error.message') ?? 'OpenAI Vision API error';
                Log::error('[PDF VISION] GPT-4o-mini error', ['error' => $error, 'status' => $response->status()]);

                // Fallback to text extraction
                if (!empty($fallbackText)) {
                    Log::info('[PDF VISION] Falling back to text extraction');
                    return $this->extractFromText($fallbackText, $brokerId, $aseguradoras, $ramos);
                }

                return response()->json(['success' => false, 'message' => 'Error en visión: ' . $error], 500);
            }

            $data = $response->json();
            $content = $data['choices'][0]['message']['content'] ?? null;
            $usage = $data['usage'] ?? null;

            Log::info('[PDF VISION] GPT-4o-mini response', [
                'tokens' => $usage,
                'content_length' => strlen($content ?? ''),
            ]);

            if (empty($content)) {
                if (!empty($fallbackText)) {
                    return $this->extractFromText($fallbackText, $brokerId, $aseguradoras, $ramos);
                }
                return response()->json(['success' => false, 'message' => 'Respuesta vacía de visión'], 500);
            }

            // 6. Parse JSON
            $extracted = $this->parseAiJson($content);
            if (!$extracted) {
                if (!empty($fallbackText)) {
                    return $this->extractFromText($fallbackText, $brokerId, $aseguradoras, $ramos);
                }
                return response()->json(['success' => false, 'message' => 'No se pudo interpretar la respuesta de visión'], 500);
            }

            // 7. Catalog matching
            $matched = $this->matchCatalogs($extracted, $brokerId);
            $matched['_method'] = 'vision-gpt4o-mini';
            $matched['_tokens'] = $usage;

            return response()->json(['success' => true, 'data' => $matched]);

        } catch (\Exception $e) {
            Log::error('[PDF VISION] Error', ['message' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Internal: text-based extraction (reuse of existing logic)
     */
    private function extractFromText(string $text, int $brokerId, array $aseguradoras, array $ramos)
    {
        $prompt = $this->buildPrompt($text, $aseguradoras, $ramos);
        $aiService = new AIResponseService();
        $aiResult = $aiService->generateResponse($prompt, [], [
            'system_prompt' => 'Eres un experto en extracción de datos de pólizas de seguros colombianas. Responde ÚNICAMENTE con JSON válido, sin texto adicional.',
            'max_tokens' => 2000,
            'temperature' => 0.05,
        ]);

        if (!$aiResult['success'] || empty($aiResult['response'])) {
            return response()->json(['success' => false, 'message' => 'Fallback text extraction also failed'], 500);
        }

        $extracted = $this->parseAiJson($aiResult['response']);
        if (!$extracted) {
            return response()->json(['success' => false, 'message' => 'Could not parse fallback response'], 500);
        }

        $matched = $this->matchCatalogs($extracted, $brokerId);
        $matched['_method'] = 'text-deepseek-fallback';
        return response()->json(['success' => true, 'data' => $matched]);
    }

    private function buildVisionPrompt(string $asegList, string $ramoList, string $insurerHints = ''): string
    {
        $hintsBlock = $insurerHints ? "\n\n{$insurerHints}\n" : '';
        return <<<PROMPT
Analiza las imágenes de este documento de póliza de seguros colombiana. Extrae TODOS los datos visibles.{$hintsBlock}

CATÁLOGOS DEL BROKER (usa coincidencia exacta o la más cercana):
- Aseguradoras: [{$asegList}]
- Ramos: [{$ramoList}]

REGLAS DE EXTRACCIÓN:

1. ASEGURADORA: Busca en logo, encabezado, sello y pie de página. Casos especiales:
   - "HDI SEGUROS COLOMBIA" o "Liberty Seguros" (cambió nombre en 2024) → usa "HDI Seguros"
   - "Aseguradora Solidaria de Colombia" → usa "Solidaria" o el nombre más cercano del catálogo
   - "Compañía Mundial de Seguros" → "Mundial" o más cercano del catálogo
   Usa el catálogo dado para la coincidencia final.

2. NÚMERO DE PÓLIZA: Busca el valor en la celda/columna con encabezado "PÓLIZA" o "Póliza Nº" o "No. PÓLIZA".
   - Tabla HDI: fila de encabezados "RAMO | PRODUCTO | PÓLIZA | CERTIFICADO | DOCUMENTO" → extrae el valor de la columna PÓLIZA (número de 6-10 dígitos), NO el encabezado.
   - "PÓLIZA No: 510 -89 - 994000000151" → número completo es "510-89-994000000151" (quita espacios extra).
   - "Póliza nº 023869855 / 0" → número es "023869855" (ignora "/ 0" que es el certificado).
   - "No. PÓLIZA COA-400007704" → número es "COA-400007704".

3. RAMO: Del título principal del documento.
   - "SEGURO DE AUTOMOVILES" / "POLIZA SEGURO DE AUTOMOVILES" → busca en catálogo (ej: "Automóviles")
   - "RESPONSABILIDAD CIVIL PROFESIONAL MEDICA" → busca en catálogo (ej: "RC Profesional")
   - "TODO RIESGO MAQUINARIA Y EQUIPO" → busca en catálogo (ej: "Maquinaria y Equipo")

4. FECHAS → formato YYYY-MM-DD estricto. Variantes encontradas en pólizas colombianas:
   - DD/MM/YYYY: "20/05/2026" → "2026-05-20"
   - DD-MM-YYYY (MAPFRE): "21-03-2025" → "2025-03-21"
   - YYYY-ABR-DD (HDI): "2025-ABR-10" → "2025-04-10"
   - DD-AGO-YYYY (HDI Hogar): "26-AGO-2025" → "2025-08-26"
   - DD/FEBRERO/YYYY (SBS): "10/FEBRERO/2026" → "2026-02-10"
   - DD MM YYYY (Solidaria): "07 05 2026" → "2026-05-07"
   - Meses cortos: ENE=01,FEB=02,MAR=03,ABR=04,MAY=05,JUN=06,JUL=07,AGO=08,SEP=09,OCT=10,NOV=11,DIC=12
   - Meses largos: ENERO=01,FEBRERO=02,MARZO=03,ABRIL=04,MAYO=05,JUNIO=06,JULIO=07,AGOSTO=08,SEPTIEMBRE=09,OCTUBRE=10,NOVIEMBRE=11,DICIEMBRE=12
   - IGNORA fechas seguidas de "-1301-" o código alfanumérico (son versiones de clausulado).
   - IGNORA "Fecha de Nacimiento" — no es fecha de póliza.
   - expedicion=campo "FECHA DE EXPEDICIÓN", inicio="VIGENCIA DESDE"/"DESDE", fin="VIGENCIA HASTA"/"HASTA".

5. MONTOS → siempre entero sin símbolos ni separadores. Formatos por aseguradora:
   - Coma como miles, sin decimal: "$361,400" → 361400 (Liberty/HDI/SBS)
   - Punto como miles, sin decimal: "65.000.000" → 65000000 (MAPFRE/Mundial)
   - Europeo punto=miles, coma=decimal: "804.405,00" → 804405 (Allianz)
   - Coma=miles, punto=decimal: "1,685,274.00" → 1685274 (SBS)
   - "PRIMA VIGENCIA 2,497,691" / "TOTAL PRIMA PESOS 2,497,691" → primaNeta=2497691
   - "PRIMA BRUTA 1,685,274.00" (SBS) → primaNeta=1685274
   - "VALOR IVA: 327,479.00" (SBS) → iva=327479
   - "TOTAL PRIMA: 2,051,053.00" (SBS) → total=2051053
   - "TOTAL A PAGAR 2,979,245" → total=2979245
   - "IMPORTE TOTAL 957.242,00" (Allianz) → total=957242
   - Texto OCR corrupto "80:00 Horas" → ignorar para montos.

6. DOCUMENTOS (cédula/NIT): Solo números. "43.628.865" → "43628865". "15.448.404" → "15448404".
   - "C.C. 43628865" → tipo="CC", documento="43628865".
   - "549001376" como "No. CERTIFICADO" NO es el documento del tomador.

7. TIPO DOC: Abreviatura ANTES del número. CC, CE, NIT, PAS, TI.

8. TOMADOR vs ASEGURADO: Si son la misma persona, copia datos en clienteNombre/clienteApellido/clienteDocumento también.
   Separa: "CASTANEDA ARANGO, DENIS FERNANDO" → nombre="DENIS FERNANDO", apellido="CASTANEDA ARANGO".
   Separa: "BUITRAGO AGUIRRE, JOSE ALEXANDER" → nombre="JOSE ALEXANDER", apellido="BUITRAGO AGUIRRE".

9. RIESGO (campo riesgo): Para autos → placa+marca+modelo. Para maquinaria → tipo+marca+serie. Para RC → especialidad.
   Ejemplos: "MAZDA CX5 2018 EPP552", "CARGADOR CATERPILLAR 226B3", "RESPONSABILIDAD CIVIL MÉDICA".

10. GASTOS ADICIONALES entre prima e IVA — son variables por aseguradora:
    - "GASTOS DE EXPEDICIÓN $ 5,877" (HDI/Liberty Auto, SIN dos puntos) → gastosExpedicion=5877
      CUIDADO HDI: los gastos van en la misma línea que la forma de cobro:
      "Anual 2025-JUL-09 GASTOS DE EXPEDICIÓN $ 5,877" → gastosExpedicion=5877 (ignorar "Anual" y fecha)
    - "GASTOS DE EXPEDICIÓN: $20,000" (MAPFRE, Liberty RC, CON dos puntos) → gastosExpedicion=20000
    - "GASTOS EXP. $ 10.000,00" (Mundial, formato europeo) → gastosExpedicion=10000
    - "DERECHOS DE EMISION: 38,300" (SBS) → gastosExpedicion=38300
    - "GASTOS (IVA-RÉGIMEN COMÚN): $157,457" (Sura) → ATENCIÓN: esto ES el IVA, gastosExpedicion=0, iva=157457
    - "BENEFICIO teCuidamos: $0" → ignorar
    - "RECARGOS Y/O DESCUENTOS: $0" → ignorar si es $0
    - "SUBTOTAL" entre prima+gastos y el IVA → confirma que gastos tienen IVA
    Determina gastosConIva:
    - Si gastos > 0 Y total ≈ (primaNeta + gastos) × 1.19 → gastosConIva = true
    - Si gastos > 0 Y total ≈ primaNeta × 1.19 → gastosConIva = false
    - Si gastos = 0 → gastosConIva = false

11. INTERMEDIARIO/AGENCIA: Si ves "AGENCIA DE SEGUROS LTDA" o "COOPROSEGUROS" con clave numérica, NO es el vendedor.

12. TEXTO CORRUPTO (PDFs escaneados): Ignora caracteres sin sentido como "คด", "80:00", "De1", "IRACIÓN", "TIRO". Son artefactos de OCR.

13. Si un dato NO es visible, devuelve "".

RESPONDE ÚNICAMENTE con JSON (sin markdown, sin explicaciones):
{
  "numeroPoliza": "", "aseguradora": "", "ramo": "",
  "primaNeta": "", "gastosExpedicion": "", "gastosConIva": false, "iva": "", "total": "",
  "fechaExpedicion": "", "fechaRecepcion": "", "fechaInicio": "", "fechaFin": "",
  "clienteNombre": "", "clienteApellido": "", "clienteDocumento": "",
  "clienteTelefono": "", "clienteEmail": "", "clienteDireccion": "", "clienteCiudad": "",
  "tomadorNombre": "", "tomadorDocumento": "", "tipoDocTomador": "",
  "tomadorTelefono": "", "tomadorEmail": "", "tomadorDireccion": "", "tomadorCiudad": "",
  "aseguradoNombre": "", "aseguradoDocumento": "",
  "riesgo": "", "valorAsegurado": "", "placas": [],
  "periodicidadPago": "", "formaPago": "", "medioPago": "",
  "porcentajeComision": "", "oficina": "", "ciudad": "",
  "vendedor": "", "observaciones": "", "renovable": "", "estado": "ACTIVA"
}
PROMPT;
    }

    private function buildPrompt(string $text, array $aseguradoras, array $ramos): string
    {
        // Truncate text to avoid token limits — keep only first portion (carátula real, no clausulado)
        $text = mb_substr($text, 0, 10000);

        $asegList = implode(', ', array_slice($aseguradoras, 0, 50));
        $ramoList = implode(', ', array_slice($ramos, 0, 50));

        return <<<PROMPT
Eres un experto en extracción de datos de pólizas de seguros colombianas. Analiza el texto extraído de un PDF y extrae TODOS los datos.

CATÁLOGOS DEL BROKER (usa coincidencia exacta o la más cercana):
- Aseguradoras: [{$asegList}]
- Ramos: [{$ramoList}]

REGLAS CRÍTICAS DE EXTRACCIÓN:

1. ASEGURADORA: Identifica la compañía aseguradora. Casos especiales frecuentes:
   - "HDI SEGUROS COLOMBIA" o "Liberty Seguros Colombia" (mismo: cambió nombre en 2024) → busca "HDI" en catálogo
   - "Aseguradora Solidaria de Colombia" o "SOLIDARIA" → busca "Solidaria" en catálogo
   - "COMPAÑÍA MUNDIAL DE SEGUROS" o "MUNDIAL" → busca "Mundial" en catálogo
   - "SURAMERICANA" → "SURA"
   - "AXACOLPATRIA" → "AXA Colpatria"
   - Busca en encabezados, pies de página, firmas autorizadas, marcas de agua.
   - Usa la coincidencia más cercana del catálogo.

2. NÚMERO DE PÓLIZA: Extrae el número real de póliza, NO la palabra "PÓLIZA".
   - Tabla columnar HDI: el texto puede tener "RAMO PRODUCTO PÓLIZA CERTIFICADO DOCUMENTO TIPO VEHICULO" seguido de "104 6033 94302738 0 2 LIVIANO". En este caso son cabeceras y valores: PÓLIZA → 94302738.
   - "PÓLIZA No: 510 -89 - 994000000151" → número completo "510-89-994000000151" (elimina espacios internos).
   - "No. PÓLIZA COA-400007704" → "COA-400007704".
   - "Póliza nº 023869855 / 0" → "023869855" (ignora "/ 0", es el número de certificado).
   - "POLIZA SEGURO DE AUTOMOVILES" en el título → NO es el número de póliza.

3. RAMO: Del título del documento o del campo RAMO:
   - "POLIZA SEGURO DE AUTOMOVILES" → busca "Automóviles" o "Autos" en catálogo
   - "SEGURO DE RESPONSABILIDAD CIVIL PROFESIONAL MEDICA" → busca "RC Profesional" o "Responsabilidad Civil" en catálogo
   - "TODO RIESGO MAQUINARIA Y EQUIPO" → busca "Maquinaria" en catálogo
   - Usa la coincidencia más cercana del catálogo de ramos.

4. FECHAS (formato YYYY-MM-DD estricto). Variantes reales en pólizas colombianas:
   - DD/MM/YYYY: "20/05/2026" → "2026-05-20"
   - DD-MM-YYYY (MAPFRE): "21-03-2025" → "2025-03-21"
   - YYYY-ABR-DD (HDI): "2025-ABR-10" → "2025-04-10"
   - DD-AGO-YYYY (HDI Hogar): "26-AGO-2025" → "2025-08-26"
   - DD/FEBRERO/YYYY (SBS): "10/FEBRERO/2026" → "2026-02-10"
   - DD MM YYYY (Solidaria): "07 05 2026" → "2026-05-07"
   - Meses cortos: ENE=01,FEB=02,MAR=03,ABR=04,MAY=05,JUN=06,JUL=07,AGO=08,SEP=09,OCT=10,NOV=11,DIC=12
   - Meses largos: ENERO=01,FEBRERO=02,MARZO=03,ABRIL=04,MAYO=05,JUNIO=06,JULIO=07,AGOSTO=08,SEPTIEMBRE=09,OCTUBRE=10,NOVIEMBRE=11,DICIEMBRE=12
   - IGNORA "29/11/2024-1301-P-03-AUTO58VERSION24" → versión de clausulado, NO fecha de vigencia.
   - IGNORA "Fecha de Nacimiento" → no es fecha de póliza.
   - expedicion = "FECHA DE EXPEDICION". inicio = "VIGENCIA DESDE". fin = "VIGENCIA HASTA".

5. MONTOS → entero sin símbolos ni separadores. Formatos por aseguradora:
   - Coma=miles: "$361,400" → 361400 (Liberty/HDI/SBS)
   - Punto=miles: "65.000.000" → 65000000 (MAPFRE/Mundial)
   - Europeo punto=miles coma=decimal: "804.405,00" → 804405 (Allianz)
   - Coma=miles punto=decimal: "1,685,274.00" → 1685274 (SBS)
   - "PRIMA VIGENCIA 2,497,691" → primaNeta=2497691
   - "PRIMA BRUTA 1,685,274.00" (SBS) → primaNeta=1685274
   - "VALOR IVA: 327,479.00" (SBS) → iva=327479
   - "TOTAL PRIMA: 2,051,053.00" (SBS) → total=2051053
   - "IMPORTE TOTAL 957.242,00" (Allianz) → total=957242
   - "TOTAL A PAGAR 2,979,245" → total=2979245
   - Asteriscos "\$ ****0.00" → 0.

6. DOCUMENTOS: Solo números sin puntos ni guiones. "43.628.865" → "43628865". "15.448.404" → "15448404".
   - "C.C. 43628865" → tipo="CC", documento="43628865"
   - ATENCIÓN: "549001376" como "No. CERTIFICADO" NO es el documento del tomador.

7. TIPO DOCUMENTO: CC, CE, NIT, PAS, TI.

8. TOMADOR vs ASEGURADO vs CLIENTE:
   - TOMADOR = quien contrata y paga. ASEGURADO = persona/bien protegido.
   - Si son la misma persona, copia los datos en clienteNombre/clienteApellido/clienteDocumento.
   - Apellido-primero: "CASTANEDA ARANGO, DENIS FERNANDO" → nombre="DENIS FERNANDO", apellido="CASTANEDA ARANGO".
   - Apellido-primero: "BUITRAGO AGUIRRE, JOSE ALEXANDER" → nombre="JOSE ALEXANDER", apellido="BUITRAGO AGUIRRE".

9. RIESGO (campo riesgo): Para autos → placa+marca+modelo. Para maquinaria → tipo+marca+serie. Para RC → especialidad médica o civil.

10. GASTOS ADICIONALES entre prima e IVA:
    - "GASTOS DE EXPEDICIÓN $ 5,877" (HDI, SIN dos puntos, mezclado con forma de cobro):
      "Anual 2025-JUL-09 GASTOS DE EXPEDICIÓN $ 5,877" → gastosExpedicion=5877
    - "GASTOS DE EXPEDICIÓN: $20,000" (MAPFRE, CON dos puntos) → gastosExpedicion=20000
    - "GASTOS EXP. $ 10.000,00" (Mundial, formato europeo) → gastosExpedicion=10000
    - "DERECHOS DE EMISION: 38,300" (SBS) → gastosExpedicion=38300
    - "GASTOS (IVA-RÉGIMEN COMÚN): $157,457" (Sura) → esto ES el IVA, gastosExpedicion=0, iva=157457
    - "SUBTOTAL" entre prima y el IVA → confirma gastosConIva=true
    Determina gastosConIva:
    - Si gastos > 0 Y total ≈ (prima + gastos) × 1.19 → gastosConIva=true
    - Si gastos > 0 Y total ≈ prima × 1.19 → gastosConIva=false
    - Si gastos = 0 → gastosConIva=false

11. TEXTO CORRUPTO/DESORDENADO: PDFs escaneados pueden tener "คด", "80:00 Horas", "De1", "IRACIÓN", "TIRO", "NUMOC NEMIGER". Ignóralos.

12. INTERMEDIARIO/AGENCIA: "COOPROSEGUROS AGENCIA DE SEGUROS LTDA" con clave numérica → NO es vendedor.

13. Si un dato NO está presente, devuelve cadena vacía "".

RESPONDE ÚNICAMENTE con este JSON (sin texto adicional, sin markdown, sin explicaciones):
{
  "numeroPoliza": "",
  "aseguradora": "",
  "ramo": "",
  "primaNeta": "",
  "gastosExpedicion": "",
  "gastosConIva": false,
  "iva": "",
  "total": "",
  "fechaExpedicion": "",
  "fechaRecepcion": "",
  "fechaInicio": "",
  "fechaFin": "",
  "clienteNombre": "",
  "clienteApellido": "",
  "clienteDocumento": "",
  "clienteTelefono": "",
  "clienteEmail": "",
  "clienteDireccion": "",
  "clienteCiudad": "",
  "tomadorNombre": "",
  "tomadorDocumento": "",
  "tipoDocTomador": "",
  "tomadorTelefono": "",
  "tomadorEmail": "",
  "tomadorDireccion": "",
  "tomadorCiudad": "",
  "aseguradoNombre": "",
  "aseguradoDocumento": "",
  "riesgo": "",
  "valorAsegurado": "",
  "placas": [],
  "periodicidadPago": "",
  "formaPago": "",
  "medioPago": "",
  "porcentajeComision": "",
  "oficina": "",
  "ciudad": "",
  "vendedor": "",
  "observaciones": "",
  "renovable": "",
  "estado": "ACTIVA"
}

TEXTO DEL PDF:
{$text}
PROMPT;
    }

    private function parseAiJson(string $response): ?array
    {
        // Try to extract JSON from the response
        $response = trim($response);

        // Remove markdown code blocks if present
        $response = preg_replace('/^```(?:json)?\s*/i', '', $response);
        $response = preg_replace('/\s*```$/i', '', $response);

        // Try direct parse
        $data = json_decode($response, true);
        if (is_array($data)) {
            return $data;
        }

        // Try to find JSON object in the response
        if (preg_match('/\{[\s\S]*\}/', $response, $matches)) {
            $data = json_decode($matches[0], true);
            if (is_array($data)) {
                return $data;
            }
        }

        Log::warning('[PDF EXTRACTOR] Could not parse AI response as JSON', ['response' => mb_substr($response, 0, 500)]);
        return null;
    }

    private function matchCatalogs(array $extracted, int $brokerId): array
    {
        // --- Match Aseguradora ---
        $aseguradoraMatch = null;
        if (!empty($extracted['aseguradora'])) {
            $aseguradoraMatch = $this->fuzzyMatchAseguradora($extracted['aseguradora'], $brokerId);
        }
        $extracted['aseguradora_id'] = $aseguradoraMatch?->id;
        $extracted['aseguradora_nombre'] = $aseguradoraMatch?->nombre ?? $extracted['aseguradora'] ?? '';

        // --- Match Ramo ---
        $ramoMatch = null;
        if (!empty($extracted['ramo'])) {
            $ramoMatch = $this->fuzzyMatchRamo($extracted['ramo'], $brokerId);
        }
        $extracted['ramo_id'] = $ramoMatch?->id;
        $extracted['ramo_nombre'] = $ramoMatch?->nombre ?? $extracted['ramo'] ?? '';

        // --- Match Cliente by document ---
        $clienteMatch = null;
        $docToSearch = $extracted['clienteDocumento'] ?? $extracted['tomadorDocumento'] ?? '';
        if (!empty($docToSearch)) {
            $clienteMatch = Cliente::where('broker_id', $brokerId)
                ->where('document_number', $docToSearch)
                ->first();
        }
        // If not found by document, try by name
        if (!$clienteMatch) {
            $nameToSearch = trim(($extracted['clienteNombre'] ?? '') . ' ' . ($extracted['clienteApellido'] ?? ''));
            if (strlen($nameToSearch) >= 3) {
                $clienteMatch = Cliente::where('broker_id', $brokerId)
                    ->where(function ($q) use ($nameToSearch) {
                        $q->whereRaw("CONCAT(COALESCE(first_name,''), ' ', COALESCE(last_name,'')) LIKE ?", ["%{$nameToSearch}%"])
                          ->orWhere('company_legal_name', 'LIKE', "%{$nameToSearch}%")
                          ->orWhere('company', 'LIKE', "%{$nameToSearch}%");
                    })
                    ->first();
            }
        }
        // If not found, try tomador name
        if (!$clienteMatch && !empty($extracted['tomadorNombre'])) {
            $clienteMatch = Cliente::where('broker_id', $brokerId)
                ->where(function ($q) use ($extracted) {
                    $name = $extracted['tomadorNombre'];
                    $q->whereRaw("CONCAT(COALESCE(first_name,''), ' ', COALESCE(last_name,'')) LIKE ?", ["%{$name}%"])
                      ->orWhere('company_legal_name', 'LIKE', "%{$name}%")
                      ->orWhere('company', 'LIKE', "%{$name}%");
                })
                ->first();
        }

        if ($clienteMatch) {
            $extracted['cliente_id'] = $clienteMatch->id;
            $tipo = $clienteMatch->client_type;
            if ($tipo === 'empresa') {
                $extracted['cliente_nombre_display'] = $clienteMatch->company_legal_name ?: $clienteMatch->company ?: $clienteMatch->first_name;
            } else {
                $extracted['cliente_nombre_display'] = trim(($clienteMatch->first_name ?? '') . ' ' . ($clienteMatch->last_name ?? ''));
            }
            $extracted['cliente_documento_display'] = $clienteMatch->document_number;
            $extracted['cliente_celular'] = $clienteMatch->mobile_phone ?? $clienteMatch->phone ?? '';
            $extracted['cliente_email'] = $clienteMatch->email ?? '';
        } else {
            $extracted['cliente_id'] = null;
            $extracted['cliente_nombre_display'] = null;
        }

        // --- Match Vendedor ---
        if (!empty($extracted['vendedor'])) {
            $vendedorMatch = Vendedor::where('broker_id', $brokerId)
                ->where('nombres', 'LIKE', '%' . $extracted['vendedor'] . '%')
                ->first();
            $extracted['vendedor_id'] = $vendedorMatch?->id;
            $extracted['vendedor_nombre'] = $vendedorMatch?->nombres ?? $extracted['vendedor'];
        }

        return $extracted;
    }

    private function fuzzyMatchAseguradora(string $name, int $brokerId): ?Aseguradora
    {
        $name = strtolower(trim($name));

        // Exact match
        $match = Aseguradora::where('broker_id', $brokerId)
            ->whereRaw('LOWER(nombre) = ?', [$name])
            ->first();
        if ($match) return $match;

        // Contains match
        $match = Aseguradora::where('broker_id', $brokerId)
            ->whereRaw('LOWER(nombre) LIKE ?', ["%{$name}%"])
            ->first();
        if ($match) return $match;

        // Reverse contains (catalog name in extracted)
        $all = Aseguradora::where('broker_id', $brokerId)->get();
        foreach ($all as $a) {
            if (str_contains($name, strtolower($a->nombre))) {
                return $a;
            }
        }

        // Levenshtein for short names
        $best = null;
        $bestDist = PHP_INT_MAX;
        foreach ($all as $a) {
            $dist = levenshtein($name, strtolower($a->nombre));
            if ($dist < $bestDist && $dist <= 5) {
                $bestDist = $dist;
                $best = $a;
            }
        }

        return $best;
    }

    private function fuzzyMatchRamo(string $name, int $brokerId): ?Ramo
    {
        $name = strtolower(trim($name));

        $match = Ramo::where('broker_id', $brokerId)
            ->whereRaw('LOWER(nombre) = ?', [$name])
            ->first();
        if ($match) return $match;

        $match = Ramo::where('broker_id', $brokerId)
            ->whereRaw('LOWER(nombre) LIKE ?', ["%{$name}%"])
            ->first();
        if ($match) return $match;

        $all = Ramo::where('broker_id', $brokerId)->get();
        foreach ($all as $r) {
            if (str_contains($name, strtolower($r->nombre))) {
                return $r;
            }
        }

        $best = null;
        $bestDist = PHP_INT_MAX;
        foreach ($all as $r) {
            $dist = levenshtein($name, strtolower($r->nombre));
            if ($dist < $bestDist && $dist <= 5) {
                $bestDist = $dist;
                $best = $r;
            }
        }

        return $best;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  ADVANCED EXTRACTION — GPT-4o + Gemini consensus + re-extracción
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Extracción avanzada: GPT-4o vision + Gemini en paralelo → consensus por campo → re-extracción dirigida.
     * Objetivo: 99%+ de precisión en los campos críticos de la póliza.
     */
    public function extractAdvanced(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $request->validate([
                'images'     => 'required|array|min:1|max:5',
                'images.*'   => 'required|string',
                'text'       => 'nullable|string',
                'pdf_base64' => 'nullable|string',
            ]);

            $images = $request->input('images');

            // Si viene el PDF binario, correr pdftotext -layout server-side (más preciso que PDF.js)
            $text = mb_substr($request->input('text', ''), 0, 12000);
            $pdfBase64 = $request->input('pdf_base64', '');
            if (!empty($pdfBase64)) {
                $tmpPath = sys_get_temp_dir() . '/guro_pdf_' . uniqid() . '.pdf';
                try {
                    file_put_contents($tmpPath, base64_decode($pdfBase64));
                    $layoutText = shell_exec('pdftotext -layout ' . escapeshellarg($tmpPath) . ' - 2>/dev/null');
                    if (!empty($layoutText) && strlen(trim($layoutText)) > 50) {
                        $text = mb_substr($layoutText, 0, 40000);
                        Log::info('[PDF-ADV] pdftotext -layout OK: ' . strlen($text) . ' chars');
                    }
                } catch (\Throwable $e) {
                    Log::warning('[PDF-ADV] pdftotext failed: ' . $e->getMessage());
                } finally {
                    @unlink($tmpPath);
                }
            }
            $openaiKey   = env('OPENAI_API_KEY', '');
            $geminiKey   = env('GEMINI_API_KEY', '');

            $aseguradoras = Aseguradora::where('broker_id', $brokerId)->pluck('nombre')->toArray();
            $ramos        = Ramo::where('broker_id', $brokerId)->pluck('nombre')->toArray();
            $asegList     = implode(', ', array_slice($aseguradoras, 0, 50));
            $ramoList     = implode(', ', array_slice($ramos, 0, 50));

            // 1. Detección rápida de aseguradora (texto o GPT-4o-mini con imagen de baja res)
            $detectedInsurer = $this->quickDetectInsurer($text, $images, $openaiKey);
            $insurerHints    = $this->getInsurerSpecificInstructions($detectedInsurer);
            // Inyectar correcciones previas del broker como few-shot examples
            $correctionsHint = $this->loadCorrectionsHint($brokerId, $detectedInsurer);
            if ($correctionsHint) $insurerHints .= "\n\n" . $correctionsHint;
            Log::info('[PDF-ADV] Aseguradora detectada: ' . $detectedInsurer);

            // 2. Extracción paralela — GPT-4o vision + Gemini
            $gptResult    = null;
            $geminiResult = null;

            if (!empty($openaiKey) && !empty($geminiKey)) {
                // Ambas APIs disponibles → paralelo real con Http::pool
                $prompt = $this->buildVisionPrompt($asegList, $ramoList, $insurerHints);
                [$gptResp, $geminiResp] = \Illuminate\Support\Facades\Http::pool(function (\Illuminate\Http\Client\Pool $pool) use (
                    $images, $text, $prompt, $openaiKey, $geminiKey
                ) {
                    return [
                        $pool->as('gpt')
                            ->withHeaders(['Authorization' => "Bearer {$openaiKey}", 'Content-Type' => 'application/json'])
                            ->timeout(90)
                            ->post('https://api.openai.com/v1/chat/completions', $this->buildGptPayload($images, $prompt)),
                        $pool->as('gemini')
                            ->withHeaders(['Content-Type' => 'application/json'])
                            ->timeout(90)
                            ->post($this->geminiUrl($geminiKey), $this->buildGeminiPayload($images, $prompt)),
                    ];
                });

                if ($gptResp->successful()) {
                    $gptResult = $this->parseAiJson($gptResp->json('choices.0.message.content', ''));
                    Log::info('[PDF-ADV] GPT-4o OK');
                } else {
                    Log::warning('[PDF-ADV] GPT-4o error', ['status' => $gptResp->status(), 'body' => mb_substr($gptResp->body(), 0, 300)]);
                }

                if ($geminiResp->successful()) {
                    $geminiResult = $this->parseAiJson($geminiResp->json('candidates.0.content.parts.0.text', ''));
                    Log::info('[PDF-ADV] Gemini OK');
                } else {
                    Log::warning('[PDF-ADV] Gemini error', ['status' => $geminiResp->status(), 'body' => mb_substr($geminiResp->body(), 0, 300)]);
                }
            } elseif (!empty($openaiKey)) {
                // Solo GPT-4o
                $prompt    = $this->buildVisionPrompt($asegList, $ramoList, $insurerHints);
                $gptResult = $this->callGptVision($images, $prompt, $openaiKey);
            } elseif (!empty($geminiKey)) {
                // Solo Gemini
                $prompt       = $this->buildVisionPrompt($asegList, $ramoList, $insurerHints);
                $geminiResult = $this->callGeminiVision($images, $prompt, $geminiKey);
            }

            // Si ambas fallaron, usa texto con DeepSeek como emergencia
            if (!$gptResult && !$geminiResult) {
                Log::warning('[PDF-ADV] Ambos modelos fallaron, usando DeepSeek texto');
                $prompt    = $this->buildPrompt($text, $aseguradoras, $ramos);
                $aiService = new \App\Services\AIResponseService();
                $aiResult  = $aiService->generateResponse($prompt, [], ['system_prompt' => 'Responde ÚNICAMENTE con JSON válido.', 'max_tokens' => 2000, 'temperature' => 0.05]);
                if ($aiResult['success']) {
                    $gptResult = $this->parseAiJson($aiResult['response']);
                }
            }

            // 3. Consensus campo a campo
            $merged = $this->consensusEngine($gptResult, $geminiResult);

            // 4. Validación + re-extracción dirigida para campos que fallan sanity checks
            $merged = $this->validateAndReExtract($merged, $images, $text, $openaiKey, $geminiKey, $insurerHints);

            // 5. Catalog matching
            $final = $this->matchCatalogs($merged, $brokerId);
            $final['_method']          = 'advanced-consensus';
            $final['_detectedInsurer'] = $detectedInsurer;
            $final['_fieldConfidence'] = $merged['_fieldConfidence'] ?? [];

            return response()->json(['success' => true, 'data' => $final]);

        } catch (\Exception $e) {
            Log::error('[PDF-ADV] Error fatal', ['msg' => $e->getMessage(), 'trace' => mb_substr($e->getTraceAsString(), 0, 800)]);
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    // ──────────────────────────────────────────────────
    //  Detección rápida de aseguradora
    // ──────────────────────────────────────────────────

    private function quickDetectInsurer(string $text, array $images, string $openaiKey): string
    {
        $textUp = mb_strtoupper($text);

        $signatures = [
            'HDI'       => ['HDI SEGUROS', 'HDI COLOMBIA', 'LIBERTY SEGUROS', 'LIBERTYSEGUROS', 'LCOL0041', 'LCOL0119'],
            'ALLIANZ'   => ['ALLIANZ', 'ALLIANZ.CO', 'ALLIANZ SEGUROS'],
            'SURA'      => ['SURAMERICANA', 'SEGUROS SURA', 'SURA.COM'],
            'SBS'       => ['SBS SEGUROS', 'SBS COLOMBIA', '860037707', 'POLIZA NO. 124', 'POLIZA NO. 125', 'SEGUROS BOLIVAR S.A'],
            'BOLIVAR'   => ['BOLIVAR', 'SEGUROS BOLÍVAR', 'SEGUROS BOLIVAR'],
            'MUNDIAL'   => ['MUNDIAL', 'COMPAÑÍA MUNDIAL', 'SEGUROSMUNDIAL'],
            'SOLIDARIA' => ['SOLIDARIA', 'ASEGURADORA SOLIDARIA'],
            'AXA'       => ['AXACOLPATRIA', 'AXA COLPATRIA', 'COLPATRIA', 'AXA SEGUROS'],
            'MAPFRE'    => ['MAPFRE'],
            'QBE'       => ['QBE SEGUROS', 'QBE'],
            'ZURICH'    => ['ZURICH'],
            'GENERALI'  => ['GENERALI'],
            'EQUIDAD'   => ['EQUIDAD', 'LA EQUIDAD'],
            'PREVISORA' => ['PREVISORA'],
        ];

        foreach ($signatures as $insurer => $keywords) {
            foreach ($keywords as $kw) {
                if (str_contains($textUp, $kw)) return $insurer;
            }
        }

        // Si no se encontró en texto, pedir al modelo con la primera imagen (baja resolución, barato)
        if (!empty($openaiKey) && !empty($images)) {
            try {
                $resp = \Illuminate\Support\Facades\Http::withHeaders([
                    'Authorization' => "Bearer {$openaiKey}",
                    'Content-Type'  => 'application/json',
                ])->timeout(10)->post('https://api.openai.com/v1/chat/completions', [
                    'model'      => 'gpt-4o-mini',
                    'messages'   => [[
                        'role'    => 'user',
                        'content' => [
                            ['type' => 'text', 'text' => 'Identifica SOLO el nombre de la compañía aseguradora en este documento colombiano. Responde únicamente el nombre, sin explicaciones.'],
                            ['type' => 'image_url', 'image_url' => ['url' => $images[0], 'detail' => 'low']],
                        ],
                    ]],
                    'max_tokens' => 25,
                    'temperature'=> 0.0,
                ]);
                if ($resp->successful()) {
                    return mb_strtoupper(trim($resp->json('choices.0.message.content', 'UNKNOWN')));
                }
            } catch (\Exception $e) {
                Log::warning('[PDF-ADV] quickDetect img error: ' . $e->getMessage());
            }
        }

        return 'UNKNOWN';
    }

    // ──────────────────────────────────────────────────
    //  Instrucciones específicas por aseguradora
    // ──────────────────────────────────────────────────

    private function getInsurerSpecificInstructions(string $insurer): string
    {
        $insurer = mb_strtoupper($insurer);

        if (str_contains($insurer, 'HDI') || str_contains($insurer, 'LIBERTY')) {
            return <<<HINT
INSTRUCCIONES HDI / LIBERTY SEGUROS:
- Formatos de póliza:
  a) HDI clásico: tabla "RAMO | PRODUCTO | POLIZA | CERTIFICADO | DOCUMENTO | TIPO VEHICULO" → valores en fila siguiente. POLIZA = número 6-10 dígitos (ej: 94302738).
  b) LCOL (Liberty certificate): "POLIZA 614669" aparece explícito. Extraer ese número.
- Fechas YYYY-ABR-DD (ej: 2025-ABR-10) Y también DD-AGO-YYYY (ej: 26-AGO-2025):
  ENE=01,FEB=02,MAR=03,ABR=04,MAY=05,JUN=06,JUL=07,AGO=08,SEP=09,OCT=10,NOV=11,DIC=12 → YYYY-MM-DD.
- Aseguradora: "HDI SEGUROS COLOMBIA S.A." (pie de página o encabezado del certificado).
- Prima en "PRIMA VIGENCIA" o "TOTAL PRIMA PESOS". Total en "TOTAL A PAGAR".
- IVA: aparece como "IVA 475,677" SIN signo $ ni dos puntos → iva=475677.
- Gastos: "GASTOS DE EXPEDICIÓN $ 5,877" → gastosExpedicion=5877.
  ATENCIÓN: en HDI los gastos aparecen en la MISMA LÍNEA que la forma de cobro:
  "Anual 2025-JUL-09 GASTOS DE EXPEDICIÓN $ 5,877" → gastosExpedicion=5877 (ignorar "Anual" y la fecha).
  El IVA se calcula sobre prima+gastos → gastosConIva=true. Verificar: (2,497,691 + 5,877) × 0.19 ≈ 475,677 ✓
- Si "BENEFICIARIO: BANCOLOMBIA S.A." → es banco acreedor, no el cliente. Ignorar para clienteNombre.
- Montos con coma como miles (ej: 3,401,148) → solo dígitos: 3401148.
HINT;
        }

        if (str_contains($insurer, 'ALLIANZ')) {
            return <<<HINT
INSTRUCCIONES ALLIANZ SEGUROS:
- ESTRUCTURA: Página 1 = portada (nombre + nº póliza). Página 2 = sumario/índice. Datos reales en "CONDICIONES PARTICULARES" (página 3 en adelante). Financieros al FINAL del documento en sección "Liquidación de Primas".
- Pie de cada página: "29/11/2024-1301-P-03-AUTO58..." → NO es fecha de póliza, es código interno de versión. IGNORAR.
- Número de póliza: "Póliza nº: 023869855 / 0" → extraer "023869855", ignorar "/ 0" (es el suplemento).
- Tomador: "BUITRAGO AGUIRRE, JOSE ALEXANDER CC: 94283570" → nombre="JOSE ALEXANDER", apellido="BUITRAGO AGUIRRE", doc="94283570", tipoDoc="CC".
- Fechas: "Duración: Desde las 00:00 horas del 20/05/2026 hasta las 24:00 horas del 19/05/2027" → fechaInicio=2026-05-20, fechaFin=2027-05-19. Formato DD/MM/YYYY.
- "Fecha de Nacimiento:02101974" → nacimiento del asegurado, NO es fecha de póliza.
- Vehículo: "Placa: LXK195", "Marca: BYD", "Tipo: SONG PLUS DM-I", "Modelo: 2024" → placas=["LXK195"], riesgo="BYD SONG PLUS DM-I 2024 LXK195".
- Valor asegurado: "Valor Asegurado: 159.500.000,00" → valorAsegurado=159500000.
- FINANCIEROS (sección "Liquidación de Primas" — puede estar en página 4 o 5):
  "PRIMA          2.622.835,00" → primaNeta=2622835  (etiqueta solo "PRIMA", SIN "NETA" ni "BRUTA")
  "IVA            498.338,00"   → iva=498338
  "IMPORTE TOTAL  3.121.173,00" → total=3121173
  gastosExpedicion=0, gastosConIva=false (Allianz NO cobra gastos de expedición)
  VERIFICACIÓN: primaNeta + iva = total (2622835 + 498338 = 3121173 ✓)
- Montos formato europeo: "2.622.835,00" → 2622835. "159.500.000,00" → 159500000. "5.000.000.000,00" → 5000000000.
  REGLA: quitar coma y 2 decimales finales, luego quitar puntos de miles.
- "Periodicidad del pago: ANUAL" → periodicidadPago="ANUAL".
- Intermediario "COOPROSEGUROS. AGENCIA DE SEGU" o similar con "Clave:" → NO es vendedor.
- Asegurado: sección "Asegurado Principal" puede tener mismos datos que tomador → copiar en aseguradoNombre/aseguradoDocumento.
HINT;
        }

        if (str_contains($insurer, 'MAPFRE')) {
            return <<<HINT
INSTRUCCIONES MAPFRE:
- Número de póliza: "Poliza No 3416120001511" → "3416120001511" (puede ser 13 dígitos).
  Alternativa: "Ref. 31819863726" → NO es el número de póliza, es referencia de pago.
- Fechas formato DD-MM-YYYY (ej: 21-03-2025 → 2025-03-21). Vigencia: "01-04-2025 to 31-03-2026".
- Montos con PUNTO como miles: "65.000.000" → 65000000. "135.400.000" → 135400000.
- Nombre: "SZEGEDY MASZAK ILDIKO" → format apellido-apellido nombre (invertido). tomadorNombre=ILDIKO, tomadorApellido=SZEGEDY MASZAK.
- Conductor habitual en "CONDUCTOR HABITUAL" = asegurado principal.
- Gastos: "GASTOS DE EXPEDICIÓN: 20,000" (con punto como miles) → gastosExpedicion=20000.
- SUBTOTAL entre prima y IVA = prima+gastos → gastosConIva=true si gastos > 0.
- "BENEFICIO teCuidamos: $0" → ignorar.
- Código FASECOLDA (ej: 06208142) → NO es número de póliza.
- Intermediario "CLAVE 96941" → NO es vendedor.
HINT;
        }

        if (str_contains($insurer, 'SBS')) {
            return <<<HINT
INSTRUCCIONES SBS SEGUROS COLOMBIA (antes Seguros Bolívar):
- Número de póliza: "POLIZA No. 1249193" → "1249193".
- Fechas en formato DD/MONTHNAME/YYYY con mes en español completo:
  "10/FEBRERO/2026" → 2026-02-10. "24/FEBRERO/2026" → 2026-02-24.
  ENERO=01,FEBRERO=02,MARZO=03,ABRIL=04,MAYO=05,JUNIO=06,JULIO=07,AGOSTO=08,SEPTIEMBRE=09,OCTUBRE=10,NOVIEMBRE=11,DICIEMBRE=12.
- Headers con texto invertido (".NUMOC NEMIGER" = "REGIMEN COMUN") → ignorar esos fragmentos.
- Prima: campo "PRIMA BRUTA" = primaNeta. Ejemplo: "PRIMA BRUTA: 1,685,274.00" → primaNeta=1685274.
- Gastos: "DERECHOS DE EMISION: 38,300.00" → gastosExpedicion=38300.
- IVA: campo "VALOR IVA" = iva. Ejemplo: "VALOR IVA: 327,479.00" → iva=327479.
- Total: campo "TOTAL PRIMA" = total. Ejemplo: "TOTAL PRIMA: 2,051,053.00" → total=2051053.
- El IVA se calcula sobre (PRIMA BRUTA + DERECHOS DE EMISION) → gastosConIva=true.
- "BASE IMPONIBLE 19%: 1,723,574" = prima+gastos juntos (confirma que gastos tienen IVA).
- "RECARGOS Y/O DESCUENTOS: $0" → ignorar si es $0.
- Montos: siempre quitar comas de miles y decimales ".00". "1,685,274.00" → 1685274. "38,300.00" → 38300.
- Aseguradora: "SBS Seguros Colombia S.A." NIT "860037707-9".
HINT;
        }

        if (str_contains($insurer, 'AXA') || str_contains($insurer, 'COLPATRIA')) {
            return <<<HINT
INSTRUCCIONES AXA COLPATRIA:
- Aseguradora: "AXA Colpatria Seguros S.A." o "AXA COLPATRIA".
- Número de póliza en campo "No. de Poliza" o "Poliza No.".
- Fechas DD/MM/YYYY.
- PDF puede estar protegido con contraseña → si no hay texto, indicar en observaciones.
HINT;
        }

        if (str_contains($insurer, 'MUNDIAL')) {
            return <<<HINT
INSTRUCCIONES MUNDIAL SEGUROS (Compañía Mundial de Seguros S.A.):
- Número de póliza: campo "No. PÓLIZA" o "No. POLIZA": formato COA-XXXXXXXXX. Ejemplo: "No. PÓLIZA COA-400007704" → "COA-400007704".
- "No. CERTIFICADO 549001376" → es número de certificado, NO documento del tomador.
- Tomador: campo "TOMADOR" en la sección de CONDICIONES PARTICULARES. Apellido primero: "CASTANEDA ARANGO, DENIS" → nombre="DENIS", apellido="CASTANEDA ARANGO".
- Fechas: formato DD/MM/YYYY. Vigencia DESDE/HASTA.
- ARTEFACTOS OCR: ignorar "TIRO", "IRACIÓN", "คด", "EQOIPO" (= EQUIPO), "80:00 Horas" (= 00:00), "De1" (= Del).
- NÚMEROS: formato europeo con PUNTO como separador de miles y COMA como decimal.
  "900.000,00" → 900000. "10.000,00" → 10000. "172.900,00" → 172900. "1.082.900,00" → 1082900.
  "100.000.000,00" → 100000000 (suma asegurada, NO confundir con prima).
- COLUMNA FINANCIERA (esquina inferior DERECHA de la carátula — ignorar todo lo demás):
  Lee SOLO estos campos de esa columna. Ignora valores de la sección AMPAROS/SUMAS ASEGURADAS.
  "PRIMA BRUTA 900.000,00"       → prima antes de descuentos.
  "PRIMA NETA $ 900.000,00"      → primaNeta=900000. USA ESTE VALOR. NO uses valores de amparos.
  "GASTOS EXP. $ 10.000,00"      → gastosExpedicion=10000.
  "IVA $ 172.900,00"             → iva=172900.
  "$ 1.082.900,00"               → total (aparece SIN etiqueta al final de la columna).
  "TOTAL A PAGAR"                → etiqueta que aparece en línea SIGUIENTE al valor total.
  VERIFICACIÓN: primaNeta + gastosExpedicion + iva = total (900000+10000+172900=1082900).
  Si tu suma no cuadra con el total visible, relee los valores de la columna financiera.
- gastosConIva=true (los gastos de expedición tienen IVA en Mundial).
- Ramo: "TODO RIESGO MAQUINARIA Y EQUIPO" (ignorar "EQOIPO" como artefacto OCR).
- Riesgo: incluye TIPO MAQUINARIA, MARCA, MODELO, PLACA, LINEA, SERIE. Ejemplo: "CARGADOR CATERPILLAR 226B3 2012 MC582591".
HINT;
        }

        if (str_contains($insurer, 'SOLIDARIA')) {
            return <<<HINT
INSTRUCCIONES ASEGURADORA SOLIDARIA:
- Número de póliza compuesto: "POLIZA No: 510 -89 - 994000000151" → "510-89-994000000151".
- Fechas en tabla: DIA / MES / AÑO separados (ej: "07 05 2026" → 2026-05-07).
- Montos con punto como miles: "$ 1.234.567" → 1234567.
HINT;
        }

        return '';
    }

    // ──────────────────────────────────────────────────
    //  Llamadas individuales a GPT-4o y Gemini
    // ──────────────────────────────────────────────────

    private function geminiUrl(string $key): string
    {
        $model = env('GEMINI_MODEL', 'gemini-2.5-flash-lite-preview-06-17');
        return "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$key}";
    }

    private function buildGptPayload(array $images, string $prompt): array
    {
        $contentParts = [['type' => 'text', 'text' => $prompt]];
        foreach (array_slice($images, 0, 3) as $image) {
            $url = str_starts_with($image, 'data:image/') ? $image : 'data:image/png;base64,' . $image;
            $contentParts[] = ['type' => 'image_url', 'image_url' => ['url' => $url, 'detail' => 'high']];
        }
        return [
            'model'       => 'gpt-4o',
            'messages'    => [
                ['role' => 'system', 'content' => 'Eres un experto en extracción de datos de pólizas de seguros colombianas. Responde ÚNICAMENTE con JSON válido.'],
                ['role' => 'user',   'content' => $contentParts],
            ],
            'max_tokens'  => 2500,
            'temperature' => 0.0,
        ];
    }

    private function buildGeminiPayload(array $images, string $prompt): array
    {
        $parts = [['text' => $prompt]];
        foreach (array_slice($images, 0, 3) as $image) {
            $base64   = preg_replace('/^data:image\/[a-z]+;base64,/', '', $image);
            $mime     = str_contains($image, 'data:image/png') ? 'image/png' : 'image/jpeg';
            $parts[]  = ['inline_data' => ['mime_type' => $mime, 'data' => $base64]];
        }
        return [
            'contents'          => [['parts' => $parts]],
            'systemInstruction' => ['parts' => [['text' => 'Eres un experto en extracción de datos de pólizas de seguros colombianas. Responde ÚNICAMENTE con JSON válido.']]],
            'generationConfig'  => ['temperature' => 0.0, 'maxOutputTokens' => 2500, 'responseMimeType' => 'application/json'],
        ];
    }

    private function callGptVision(array $images, string $prompt, string $key): ?array
    {
        $resp = \Illuminate\Support\Facades\Http::withHeaders([
            'Authorization' => "Bearer {$key}",
            'Content-Type'  => 'application/json',
        ])->timeout(90)->post('https://api.openai.com/v1/chat/completions', $this->buildGptPayload($images, $prompt));

        if (!$resp->successful()) {
            Log::error('[PDF-ADV] GPT-4o error', ['status' => $resp->status(), 'body' => mb_substr($resp->body(), 0, 300)]);
            return null;
        }
        return $this->parseAiJson($resp->json('choices.0.message.content', ''));
    }

    private function callGeminiVision(array $images, string $prompt, string $key): ?array
    {
        $resp = \Illuminate\Support\Facades\Http::withHeaders(['Content-Type' => 'application/json'])
            ->timeout(90)
            ->post($this->geminiUrl($key), $this->buildGeminiPayload($images, $prompt));

        if (!$resp->successful()) {
            Log::error('[PDF-ADV] Gemini error', ['status' => $resp->status(), 'body' => mb_substr($resp->body(), 0, 300)]);
            return null;
        }
        return $this->parseAiJson($resp->json('candidates.0.content.parts.0.text', ''));
    }

    // ──────────────────────────────────────────────────
    //  Consensus engine — compara GPT-4o vs Gemini campo a campo
    // ──────────────────────────────────────────────────

    private function consensusEngine(?array $gpt, ?array $gemini): array
    {
        $allFields = [
            'numeroPoliza','aseguradora','ramo','primaNeta','gastosExpedicion','gastosConIva','iva','total',
            'fechaExpedicion','fechaRecepcion','fechaInicio','fechaFin',
            'clienteNombre','clienteApellido','clienteDocumento',
            'clienteTelefono','clienteEmail','clienteDireccion','clienteCiudad',
            'tomadorNombre','tomadorDocumento','tipoDocTomador',
            'tomadorTelefono','tomadorEmail','tomadorDireccion','tomadorCiudad',
            'aseguradoNombre','aseguradoDocumento',
            'riesgo','valorAsegurado','placas',
            'periodicidadPago','formaPago','medioPago','estado',
        ];

        $merged   = [];
        $fieldConf = [];

        foreach ($allFields as $field) {
            $gVal = $gpt    ? (is_array($gpt[$field]    ?? null) ? ($gpt[$field]    ?? []) : trim((string)($gpt[$field]    ?? ''))) : '';
            $mVal = $gemini ? (is_array($gemini[$field] ?? null) ? ($gemini[$field] ?? []) : trim((string)($gemini[$field] ?? ''))) : '';

            $gEmpty = is_array($gVal) ? empty($gVal) : ($gVal === '');
            $mEmpty = is_array($mVal) ? empty($mVal) : ($mVal === '');

            if ($gEmpty && $mEmpty) {
                $merged[$field]    = is_array($gVal) ? [] : '';
                $fieldConf[$field] = 20;
                continue;
            }

            if (!$gEmpty && !$mEmpty) {
                if ($this->valuesMatch($gVal, $mVal, $field)) {
                    // Acuerdo: alta confianza
                    $merged[$field]    = $gVal;
                    $fieldConf[$field] = 98;
                } else {
                    // Desacuerdo: GPT-4o prevalece (mejor en documentos estructurados), confianza media
                    $merged[$field]    = $gVal;
                    $fieldConf[$field] = 62;
                    Log::info("[PDF-CONSENSUS] Desacuerdo '{$field}': GPT='{$this->strVal($gVal)}' Gemini='{$this->strVal($mVal)}'");
                }
                continue;
            }

            // Solo un modelo tiene valor
            $merged[$field]    = !$gEmpty ? $gVal : $mVal;
            $fieldConf[$field] = 72;
        }

        $merged['_fieldConfidence'] = $fieldConf;
        return $merged;
    }

    private function strVal($v): string
    {
        return is_array($v) ? implode(',', $v) : (string)$v;
    }

    private function valuesMatch($v1, $v2, string $field): bool
    {
        if (is_array($v1) && is_array($v2)) {
            $a = $v1; $b = $v2; sort($a); sort($b);
            return $a === $b;
        }

        $s1 = mb_strtolower(trim((string)$v1));
        $s2 = mb_strtolower(trim((string)$v2));

        if ($s1 === $s2) return true;
        if ($s1 === '' && $s2 === '') return true;
        if ($s1 === '' || $s2 === '') return false;

        // Números: solo dígitos
        if (in_array($field, ['primaNeta', 'iva', 'total', 'valorAsegurado'])) {
            return preg_replace('/\D/', '', $s1) === preg_replace('/\D/', '', $s2);
        }

        // Documentos: solo dígitos
        if (in_array($field, ['clienteDocumento', 'tomadorDocumento', 'aseguradoDocumento'])) {
            $n1 = preg_replace('/\D/', '', $s1);
            $n2 = preg_replace('/\D/', '', $s2);
            return $n1 === $n2 && strlen($n1) >= 6;
        }

        // Fechas
        if (in_array($field, ['fechaInicio', 'fechaFin', 'fechaExpedicion'])) {
            return $this->normDate($s1) === $this->normDate($s2);
        }

        // Número de póliza: normalizar guiones y espacios
        if ($field === 'numeroPoliza') {
            $p1 = preg_replace('/[\s\-_\.]/', '', $s1);
            $p2 = preg_replace('/[\s\-_\.]/', '', $s2);
            return $p1 === $p2 && strlen($p1) >= 4;
        }

        // Nombres: uno puede contener al otro (Gemini devuelve nombre completo, GPT separa)
        if (in_array($field, ['clienteNombre', 'clienteApellido', 'tomadorNombre', 'aseguradoNombre'])) {
            return $s1 === $s2 || str_contains($s1, $s2) || str_contains($s2, $s1);
        }

        return false;
    }

    private function normDate(string $d): string
    {
        $d = trim($d);
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) return $d;

        static $months = ['ENE'=>'01','FEB'=>'02','MAR'=>'03','ABR'=>'04','MAY'=>'05','JUN'=>'06',
                          'JUL'=>'07','AGO'=>'08','SEP'=>'09','OCT'=>'10','NOV'=>'11','DIC'=>'12'];

        static $fullMonths = ['ENERO'=>'01','FEBRERO'=>'02','MARZO'=>'03','ABRIL'=>'04','MAYO'=>'05',
                               'JUNIO'=>'06','JULIO'=>'07','AGOSTO'=>'08','SEPTIEMBRE'=>'09',
                               'OCTUBRE'=>'10','NOVIEMBRE'=>'11','DICIEMBRE'=>'12'];

        // DD/MM/YYYY → 2026-05-20
        if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $d, $m))
            return "{$m[3]}-" . str_pad($m[2],2,'0',STR_PAD_LEFT) . '-' . str_pad($m[1],2,'0',STR_PAD_LEFT);

        // YYYY-ABR-DD (HDI) → 2025-04-10
        if (preg_match('/^(\d{4})-([A-Z]{3})-(\d{1,2})$/i', $d, $m))
            return "{$m[1]}-" . ($months[strtoupper($m[2])] ?? '00') . '-' . str_pad($m[3],2,'0',STR_PAD_LEFT);

        // DD-ABR-YYYY (HDI Hogar variante) → 2025-08-26
        if (preg_match('/^(\d{1,2})-([A-Z]{3})-(\d{4})$/i', $d, $m))
            return "{$m[3]}-" . ($months[strtoupper($m[2])] ?? '00') . '-' . str_pad($m[1],2,'0',STR_PAD_LEFT);

        // DD/FEBRERO/YYYY (SBS formato largo) → 2026-02-10
        if (preg_match('/^(\d{1,2})\/([A-ZÁÉÍÓÚ]+)\/(\d{4})$/i', $d, $m))
            return "{$m[3]}-" . ($fullMonths[strtoupper($m[2])] ?? '00') . '-' . str_pad($m[1],2,'0',STR_PAD_LEFT);

        // DD-MM-YYYY (MAPFRE) → 2025-03-21
        if (preg_match('/^(\d{1,2})-(\d{2})-(\d{4})$/', $d, $m))
            return "{$m[3]}-" . str_pad($m[2],2,'0',STR_PAD_LEFT) . '-' . str_pad($m[1],2,'0',STR_PAD_LEFT);

        // DD MM YYYY (Solidaria separado por espacios) → 2026-05-07
        if (preg_match('/^(\d{1,2})\s+(\d{1,2})\s+(\d{4})$/', $d, $m))
            return "{$m[3]}-" . str_pad($m[2],2,'0',STR_PAD_LEFT) . '-' . str_pad($m[1],2,'0',STR_PAD_LEFT);

        return $d;
    }

    // ──────────────────────────────────────────────────
    //  Validación por campo + re-extracción dirigida
    // ──────────────────────────────────────────────────

    // Strip trailing 2-digit decimal (.00 / ,00) before parsing to int.
    // "1,685,274.00" → 1685274  (not 168527400)
    // "804.405,00"   → 804405   (Allianz European format)
    // "5,877"        → 5877     (no decimal suffix, unchanged)
    private function normalizeAmount(string $s): float
    {
        $s = trim($s);
        $s = preg_replace('/[,\.](\d{2})$/', '', $s);
        return (float) preg_replace('/[^\d]/', '', $s);
    }

    private function autoDetectGastosConIva(array &$merged): void
    {
        $prima  = $this->normalizeAmount($merged['primaNeta']       ?? '0');
        $gastos = $this->normalizeAmount($merged['gastosExpedicion'] ?? '0');
        $iva    = $this->normalizeAmount($merged['iva']              ?? '0');
        $total  = $this->normalizeAmount($merged['total']            ?? '0');

        if ($gastos <= 0 || $iva <= 0) {
            $merged['gastosConIva'] = false;
            return;
        }

        $ivaConGastos = round(($prima + $gastos) * 0.19);
        $ivaSinGastos = round($prima * 0.19);

        // Tolerancia de ±10 pesos (redondeos entre aseguradoras)
        if (abs($ivaConGastos - $iva) <= 10) {
            $merged['gastosConIva'] = true;
        } elseif (abs($ivaSinGastos - $iva) <= 10) {
            $merged['gastosConIva'] = false;
        }
        // Si ninguno cuadra, conservar lo que dijo la IA
    }

    private function validateAndReExtract(array $merged, array $images, string $text, string $openaiKey, string $geminiKey, string $insurerHints): array
    {
        $this->autoDetectGastosConIva($merged);

        $fc      = $merged['_fieldConfidence'] ?? [];
        $issues  = [];

        // Fechas deben estar en YYYY-MM-DD
        foreach (['fechaInicio', 'fechaFin', 'fechaExpedicion'] as $f) {
            $v = $merged[$f] ?? '';
            if (!empty($v) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) {
                $issues[] = ['field' => $f, 'issue' => "formato_fecha_incorrecto (actual: {$v})"];
                $fc[$f]   = min($fc[$f] ?? 50, 25);
            }
        }

        // fechaInicio debe ser anterior a fechaFin
        $fi = $merged['fechaInicio'] ?? '';
        $ff = $merged['fechaFin']    ?? '';
        if ($fi && $ff && preg_match('/^\d{4}-\d{2}-\d{2}$/', $fi) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $ff)) {
            if ($fi >= $ff) {
                $issues[] = ['field' => 'fechaFin', 'issue' => "fecha_fin_antes_o_igual_a_inicio (inicio={$fi} fin={$ff})"];
                $fc['fechaFin'] = min($fc['fechaFin'] ?? 50, 20);
            }
        }

        // Número de póliza no puede ser una palabra genérica ni estar vacío
        $pol = trim($merged['numeroPoliza'] ?? '');
        if (empty($pol) || preg_match('/^(seguro|de|del|no|num|poliza|póliza|número|numero)$/i', $pol)) {
            $issues[] = ['field' => 'numeroPoliza', 'issue' => "numero_invalido (actual: '{$pol}')"];
            $fc['numeroPoliza'] = 10;
        }

        // Documentos: 7-12 dígitos
        foreach (['clienteDocumento', 'tomadorDocumento'] as $df) {
            $doc = preg_replace('/\D/', '', $merged[$df] ?? '');
            if (!empty($merged[$df]) && (strlen($doc) < 6 || strlen($doc) > 12)) {
                $issues[] = ['field' => $df, 'issue' => "documento_invalido (actual: {$merged[$df]})"];
                $fc[$df]  = min($fc[$df] ?? 50, 30);
            }
        }

        // Aseguradora vacía
        if (empty(trim($merged['aseguradora'] ?? ''))) {
            $issues[] = ['field' => 'aseguradora', 'issue' => 'aseguradora_vacia'];
            $fc['aseguradora'] = 10;
        }

        // ── Financieros: texto pdftotext tiene prioridad sobre OCR visual ──────
        // pdftotext lee dígitos exactos; la visión IA puede confundir "900" con "980".
        // Si el texto da valores que cuadran matemáticamente, se usan SIEMPRE
        // (independientemente de si la IA también cuadra — el OCR puede ser
        // internamente consistente con valores incorrectos).
        if (!empty($text)) {
            $textFin = $this->extractFinancialsFromText($text);
            $tPrima  = $this->normalizeAmount($textFin['primaNeta']        ?? '0');
            $tGastos = $this->normalizeAmount($textFin['gastosExpedicion'] ?? '0');
            $tIva    = $this->normalizeAmount($textFin['iva']              ?? '0');
            $tTotal  = $this->normalizeAmount($textFin['total']            ?? '0');
            if ($tPrima > 0 && $tIva > 0 && $tTotal > 0 && abs($tPrima + $tGastos + $tIva - $tTotal) <= 50) {
                Log::info("[PDF-ADV] Financials desde texto (autoridad): prima={$tPrima}, gastos={$tGastos}, iva={$tIva}, total={$tTotal}");
                $merged['primaNeta']        = (string)(int)$tPrima;
                $merged['gastosExpedicion'] = (string)(int)$tGastos;
                $merged['iva']              = (string)(int)$tIva;
                $merged['total']            = (string)(int)$tTotal;
                $fc['primaNeta']        = 92;
                $fc['gastosExpedicion'] = 92;
                $fc['iva']              = 92;
                $fc['total']            = 92;
            } else {
                // Texto no cuadra → verificar si la IA cuadra; si no, marcar para re-extracción
                $prima  = $this->normalizeAmount($merged['primaNeta']       ?? '');
                $gastos = $this->normalizeAmount($merged['gastosExpedicion'] ?? '0');
                $iva    = $this->normalizeAmount($merged['iva']              ?? '');
                $total  = $this->normalizeAmount($merged['total']            ?? '');
                if ($prima > 0 && $iva > 0 && $total > 0) {
                    $calculado = $prima + $gastos + $iva;
                    $diff      = abs($calculado - $total);
                    if ($diff > 50) {
                        Log::warning("[PDF-ADV] Texto y IA no cuadran: prima({$prima})+gastos({$gastos})+iva({$iva})={$calculado} ≠ total({$total})");
                        foreach (['primaNeta', 'gastosExpedicion', 'iva', 'total'] as $fk) {
                            $issues[] = ['field' => $fk, 'issue' => "valor_inconsistente (diff={$diff}pesos)"];
                            $fc[$fk]  = min($fc[$fk] ?? 50, 35);
                        }
                    } else {
                        Log::info("[PDF-ADV] Math OK (IA): {$prima}+{$gastos}+{$iva}={$calculado} ≈ {$total}");
                    }
                }
            }
        } else {
            // Sin texto: solo verificar consistencia interna de la IA
            $prima  = $this->normalizeAmount($merged['primaNeta']       ?? '');
            $gastos = $this->normalizeAmount($merged['gastosExpedicion'] ?? '0');
            $iva    = $this->normalizeAmount($merged['iva']              ?? '');
            $total  = $this->normalizeAmount($merged['total']            ?? '');
            if ($prima > 0 && $iva > 0 && $total > 0) {
                $calculado = $prima + $gastos + $iva;
                $diff      = abs($calculado - $total);
                if ($diff > 50) {
                    foreach (['primaNeta', 'gastosExpedicion', 'iva', 'total'] as $fk) {
                        $issues[] = ['field' => $fk, 'issue' => "valor_inconsistente (diff={$diff}pesos)"];
                        $fc[$fk]  = min($fc[$fk] ?? 50, 35);
                    }
                }
            }
        }

        $merged['_fieldConfidence'] = $fc;

        // Re-extraer campos problemáticos con prompt dirigido
        if (!empty($issues) && (!empty($openaiKey) || !empty($geminiKey))) {
            $fixed = $this->targetedReExtract($issues, $images, $text, $openaiKey, $insurerHints);
            foreach ($fixed as $field => $value) {
                if ($value !== null && $value !== '' && !str_starts_with($field, '_')) {
                    // Solo actualizar si el valor re-extraído supera la validación básica
                    $isValidDate = in_array($field, ['fechaInicio','fechaFin','fechaExpedicion'])
                        && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$value);
                    $isValidPol  = $field === 'numeroPoliza'
                        && strlen(preg_replace('/\D/', '', (string)$value)) >= 4;
                    $isOther     = !in_array($field, ['fechaInicio','fechaFin','fechaExpedicion','numeroPoliza']);

                    if ($isValidDate || $isValidPol || $isOther) {
                        $merged[$field]                          = $value;
                        $merged['_fieldConfidence'][$field] = 82;
                        Log::info("[PDF-ADV] Re-extraído '{$field}' = '{$this->strVal($value)}'");
                    }
                }
            }
        }

        return $merged;
    }

    private function targetedReExtract(array $issues, array $images, string $text, string $openaiKey, string $insurerHints): array
    {
        if (empty($openaiKey)) return [];

        $fieldNames = array_column($issues, 'field');
        $issueLines = implode("\n", array_map(fn($i) => "- {$i['field']}: {$i['issue']}", $issues));
        $emptyJson  = json_encode(array_fill_keys($fieldNames, ''));

        $prompt = <<<PROMPT
Los siguientes campos tienen problemas en la extracción previa:
{$issueLines}

{$insurerHints}

Analiza el documento y extrae ÚNICAMENTE estos campos con los valores correctos.
Reglas:
- Fechas en formato YYYY-MM-DD estricto.
- Número de póliza: solo el número real (sin la palabra "PÓLIZA" ni "No").
- Documentos: solo dígitos, sin puntos ni guiones.
Responde ÚNICAMENTE con este JSON (sin texto extra):
{$emptyJson}
PROMPT;

        $contentParts = [['type' => 'text', 'text' => $prompt]];
        // Agregar solo la primera imagen (más rápido)
        if (!empty($images)) {
            $url            = str_starts_with($images[0], 'data:image/') ? $images[0] : 'data:image/png;base64,' . $images[0];
            $contentParts[] = ['type' => 'image_url', 'image_url' => ['url' => $url, 'detail' => 'high']];
        }

        try {
            $resp = \Illuminate\Support\Facades\Http::withHeaders([
                'Authorization' => "Bearer {$openaiKey}",
                'Content-Type'  => 'application/json',
            ])->timeout(30)->post('https://api.openai.com/v1/chat/completions', [
                'model'       => 'gpt-4o-mini',
                'messages'    => [
                    ['role' => 'system', 'content' => 'Extrae datos específicos de una póliza colombiana. Responde SOLO con JSON.'],
                    ['role' => 'user',   'content' => $contentParts],
                ],
                'max_tokens'  => 400,
                'temperature' => 0.0,
            ]);

            if ($resp->successful()) {
                $fixed = $this->parseAiJson($resp->json('choices.0.message.content', ''));
                return $fixed ?: [];
            }
        } catch (\Exception $e) {
            Log::warning('[PDF-ADV] targetedReExtract error: ' . $e->getMessage());
        }

        return [];
    }

    // ──────────────────────────────────────────────────
    //  Text-based financial extraction (regex mirrors TestPdfExtraction.php)
    //  Used as authoritative fallback when vision-AI numbers fail math check.
    // ──────────────────────────────────────────────────

    private function extractFinancialsFromText(string $text): array
    {
        $d = [];
        $normAmt = function (string $s): string {
            $s = trim(preg_replace('/\*+/', '', $s));
            $s = preg_replace('/[,\.](\d{2})$/', '', $s);
            return preg_replace('/[^\d]/', '', $s);
        };

        $amtPat = '[0-9][0-9\.,\*]*';

        // Solidaria columnar: labels row + values row (run first)
        if (preg_match('/VALOR\s+PRIMA\s*:[\s\S]{0,400}?TOTAL\s+A\s+PAGAR\s*:[\r\n]+([^\r\n]+)/iu', $text, $m)) {
            $cols = preg_split('/\s{3,}/', $m[1]);
            $cols = array_values(array_filter(array_map('trim', $cols)));
            if (count($cols) >= 5) {
                $d['primaNeta']        = $normAmt($cols[1]);
                $d['gastosExpedicion'] = $normAmt($cols[2]);
                $d['iva']              = $normAmt($cols[3]);
                $d['total']            = $normAmt(end($cols));
                return $d;
            }
        }

        // primaNeta: PRIMA NETA tiene prioridad sobre PRIMA BRUTA
        // (en texto sin columnas PRIMA BRUTA puede ir seguida del % de agentes, no del monto)
        if (preg_match('/prima\s*neta\s*:?\s*\$?[\s\*]*(' . $amtPat . ')/iu', $text, $m))
            $d['primaNeta'] = $normAmt($m[1]);
        elseif (preg_match('/prima\s*(?:bruta|vigencia)\s*:?\s*\$?[\s\*]*(' . $amtPat . ')/iu', $text, $m))
            $d['primaNeta'] = $normAmt($m[1]);
        elseif (preg_match('/(?:valor\s*prima|total\s*prima\s*pesos)\s*:?\s*\$?[\s\*]*(' . $amtPat . ')/iu', $text, $m))
            $d['primaNeta'] = $normAmt($m[1]);
        elseif (preg_match('/\bPRIMA\b[ \t]+(' . $amtPat . ')/u', $text, $m))
            $d['primaNeta'] = $normAmt($m[1]);

        // gastosExpedicion
        if (preg_match('/(?:gastos?\s*(?:de?\s*)?expedici[oó]n|gastos?\s*exp\.?|derechos?\s*de?\s*emisi[oó]n)\s*:?\s*\$?[\s\*]*(' . $amtPat . ')/iu', $text, $m))
            $d['gastosExpedicion'] = $normAmt($m[1]);

        // iva: primero patrón directo (-layout), luego fallback para texto sin columnas (PDF.js)
        if (preg_match('/(?:valor\s+)?iva\s*:?\s*\$?[\s\*]*(' . $amtPat . ')/iu', $text, $m)) {
            $d['iva'] = $normAmt($m[1]);
        } elseif (preg_match('/\bIVA\b[\s\S]{0,350}?TOTAL\s+A\s+PAGAR[\s\S]{0,150}?\$[\s]*(' . $amtPat . ')/iu', $text, $m)) {
            $d['iva'] = $normAmt($m[1]);
        }

        // total: reversed layout (Mundial -layout), luego dos valores tras TOTAL A PAGAR (sin columnas), luego estándar
        if (preg_match('/\$\s+([\d\.]+,\d{2})[\s\S]{0,200}?total\s*a\s*pagar/iu', $text, $m)) {
            $d['total'] = $normAmt($m[1]);
        } elseif (preg_match('/total\s*a\s*pagar[\s\S]{0,100}?\$[\s\S]{0,80}?[0-9][0-9\.,]+,\d{2}[\s\S]{0,80}?\$[\s]*(' . $amtPat . ')/iu', $text, $m)) {
            $d['total'] = $normAmt($m[1]);
        } elseif (preg_match('/(?:total\s*a?\s*pagar|importe\s*total|valor\s*total|total\s*prima)\s*:?\s*\$?[\s\*]*(' . $amtPat . ')/iu', $text, $m)) {
            $d['total'] = $normAmt($m[1]);
        }

        return $d;
    }

    // ──────────────────────────────────────────────────
    //  buildVisionPrompt actualizado con soporte de hints
    //  (reemplaza la versión anterior que no aceptaba $insurerHints)
    // ──────────────────────────────────────────────────

    private function buildVisionPromptAdvanced(string $asegList, string $ramoList, string $insurerHints): string
    {
        $base = $this->buildVisionPrompt($asegList, $ramoList, $insurerHints);
        return $base;
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  FEEDBACK LOOP — guardar correcciones del usuario e inyectarlas en prompts
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * POST /saas/pdf-extract-corrections
     * Guarda las correcciones que hizo el usuario sobre los valores extraídos por IA.
     */
    public function saveCorrections(Request $request): \Illuminate\Http\JsonResponse
    {
        try {
            $brokerId    = $this->getBrokerId($request);
            $corrections = $request->input('corrections', []);
            $aseguradora = strtoupper(trim($request->input('aseguradora', '')));
            $pdfHash     = $request->input('pdf_hash', '');

            if (empty($corrections) || !is_array($corrections)) {
                return response()->json(['success' => true, 'saved' => 0]);
            }

            $saved = 0;
            foreach ($corrections as $c) {
                $field    = trim($c['field']    ?? '');
                $aiVal    = trim($c['ai_value'] ?? '');
                $corrVal  = trim($c['corrected_value'] ?? '');

                if (empty($field) || $aiVal === $corrVal) continue;

                \Illuminate\Support\Facades\DB::table('pdf_extraction_corrections')->insert([
                    'broker_id'       => $brokerId,
                    'aseguradora'     => $aseguradora ?: null,
                    'field_name'      => $field,
                    'ai_value'        => $aiVal,
                    'corrected_value' => $corrVal,
                    'pdf_hash'        => $pdfHash ?: null,
                    'created_at'      => now(),
                    'updated_at'      => now(),
                ]);
                $saved++;
            }

            Log::info("[PDF-CORRECTIONS] Broker {$brokerId} guardó {$saved} correcciones para {$aseguradora}");
            return response()->json(['success' => true, 'saved' => $saved]);
        } catch (\Exception $e) {
            Log::error('[PDF-CORRECTIONS] Error: ' . $e->getMessage());
            return response()->json(['success' => false], 500);
        }
    }

    /**
     * Carga las últimas correcciones del broker para un asegurador dado y las formatea
     * como instrucciones adicionales para inyectar en el prompt.
     */
    private function loadCorrectionsHint(int $brokerId, string $insurer): string
    {
        if (empty($insurer)) return '';

        try {
            $rows = \Illuminate\Support\Facades\DB::table('pdf_extraction_corrections')
                ->where('broker_id', $brokerId)
                ->where('aseguradora', strtoupper($insurer))
                ->whereNotNull('ai_value')
                ->whereNotNull('corrected_value')
                ->orderByDesc('created_at')
                ->limit(10)
                ->get(['field_name', 'ai_value', 'corrected_value']);

            if ($rows->isEmpty()) return '';

            // Dedup: para el mismo campo, conservar solo la corrección más reciente
            $deduped = [];
            foreach ($rows as $r) {
                if (!isset($deduped[$r->field_name])) {
                    $deduped[$r->field_name] = $r;
                }
            }

            $lines = [];
            foreach ($deduped as $r) {
                $lines[] = "  - {$r->field_name}: la IA extrajo \"{$r->ai_value}\" pero el valor correcto era \"{$r->corrected_value}\"";
            }

            return "CORRECCIONES PREVIAS DE USUARIOS PARA {$insurer} (aplica estas lecciones):\n" . implode("\n", $lines);
        } catch (\Exception $e) {
            // Si la tabla aún no existe (migración pendiente), silenciar
            return '';
        }
    }
}
