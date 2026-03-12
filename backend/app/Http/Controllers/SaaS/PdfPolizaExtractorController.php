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

    private function buildVisionPrompt(string $asegList, string $ramoList): string
    {
        return <<<PROMPT
Analiza las imágenes de este documento de póliza de seguros colombiana. Extrae TODOS los datos visibles.

CATÁLOGOS DEL BROKER (usa coincidencia exacta o la más cercana):
- Aseguradoras: [{$asegList}]
- Ramos: [{$ramoList}]

REGLAS:
1. ASEGURADORA: Identifica la compañía del logo, encabezado o pie de página. Usa el catálogo.
2. NÚMERO DE PÓLIZA: Busca "Póliza No.", "Poliza", números con formato XX-XX-XXXXXXXXX.
3. RAMO: Del título del documento (ej: "RESPONSABILIDAD CIVIL PROFESIONAL" → busca en catálogo).
4. FECHAS: formato YYYY-MM-DD. Si hay fechas de expedición, inicio vigencia y fin vigencia, extrae las 3.
5. MONTOS: Solo números enteros sin símbolos. \$1.234.567,00 → 1234567. Si hay asteriscos como \$ ***0.00 → 0.
6. DOCUMENTOS: Solo números sin puntos ni guiones. 272.973 → 272973.
7. TIPO DOC: Lee la abreviatura que aparece ANTES del número de documento. CC=Cédula Ciudadanía, CE=Cédula Extranjería, NIT, PAS=Pasaporte, TI=Tarjeta Identidad. Si dice "CE 272.973" el tipo es "CE", NO "CC".
8. TOMADOR vs ASEGURADO: Si son la misma persona, copia en ambos Y en cliente.
9. Separa nombre y apellido: "CARLOS HERNAN JARRIN GUILLEN" → nombre="CARLOS HERNAN", apellido="JARRIN GUILLEN".
10. Si un dato NO es visible, devuelve "".
11. PLACAS: formato ABC123, devolver como array.

RESPONDE ÚNICAMENTE con JSON (sin markdown, sin explicaciones):
{
  "numeroPoliza": "", "aseguradora": "", "ramo": "",
  "primaNeta": "", "iva": "", "total": "",
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
        // Truncate text to avoid token limits
        $text = mb_substr($text, 0, 10000);

        $asegList = implode(', ', array_slice($aseguradoras, 0, 50));
        $ramoList = implode(', ', array_slice($ramos, 0, 50));

        return <<<PROMPT
Eres un experto en extracción de datos de pólizas de seguros colombianas. Analiza el texto extraído de un PDF y extrae TODOS los datos.

CATÁLOGOS DEL BROKER (usa coincidencia exacta o la más cercana):
- Aseguradoras: [{$asegList}]
- Ramos: [{$ramoList}]

REGLAS CRÍTICAS DE EXTRACCIÓN:

1. ASEGURADORA: Identifica la compañía aseguradora del documento. Nombres pueden estar pegados o abreviados:
   - "SEGURESTADO" o "SEGUR ESTADO" = "Seguros del Estado"
   - "SURAMERICANA" = "SURA"
   - "AXACOLPATRIA" = "AXA Colpatria"
   - Busca en encabezados, pies de página, firmas autorizadas y marcas de agua.
   - Usa la coincidencia más cercana del catálogo.

2. NÚMERO DE PÓLIZA: Busca patrones como "POLIZA No.", "Póliza", número con formato XX-XX-XXXXXXXXX, o números largos cercanos a la palabra póliza. Ejemplo: "41-03-101016116".

3. RAMO: Identifica el tipo de seguro del título o encabezado del documento:
   - "RESPONSABILIDAD CIVIL PROFESIONAL" → "Responsabilidad Civil"
   - "SEGURO DE AUTOMOVILES" → "Automóviles" o "Autos"
   - "TODO RIESGO HOGAR" → "Hogar"
   - Usa la coincidencia más cercana del catálogo de ramos.

4. FECHAS (formato YYYY-MM-DD estricto):
   - En pólizas colombianas las fechas suelen estar en formato DD MM YYYY o DD/MM/YYYY.
   - Cuando hay 5 fechas seguidas (ej: "04 03 2026 01 02 2026 01 02 2027 04 03 2026 01 02 2027"), el orden típico es:
     * 1ra = Fecha de expedición
     * 2da = Inicio vigencia del seguro
     * 3ra = Fin vigencia del seguro
     * 4ta = Inicio vigencia del anexo
     * 5ta = Fin vigencia del anexo
   - Usa: fechaExpedicion=1ra, fechaInicio=2da, fechaFin=3ra.

5. MONTOS: Extrae solo números enteros sin decimales ni símbolos.
   - \$1.234.567,00 → 1234567
   - Valores con asteriscos como "\$ *****437,726,250.00" → 437726250
   - "PRIMA: \$ *************0.00" significa prima = 0
   - Si prima es 0, pon "0" (no dejes vacío).

6. DOCUMENTOS (cédula/NIT): Solo números sin puntos ni guiones. "272.973" → "272973". "12.345.678-9" → "123456789".

7. TIPO DOCUMENTO: CC=Cédula de Ciudadanía, CE=Cédula de Extranjería, NIT, PAS=Pasaporte, TI=Tarjeta de Identidad.

8. TOMADOR vs ASEGURADO vs CLIENTE:
   - TOMADOR = quien contrata y paga la póliza.
   - ASEGURADO = persona/bien protegido.
   - Si son la misma persona, copia los datos en clienteNombre/clienteApellido/clienteDocumento.
   - Separa nombre y apellido: "CARLOS HERNAN JARRIN GUILLEN" → nombre="CARLOS HERNAN", apellido="JARRIN GUILLEN".

9. TEXTO DESORDENADO: Los PDFs pueden tener texto invertido, columnas mezcladas o basura como "NUMOC NEMIGER .A.V.I". Ignora ese texto basura y enfócate en los datos estructurados.

10. PLACAS: Formato ABC123 o ABC-123 para vehículos colombianos. Devolver como array.

11. INTERMEDIARIO/AGENCIA: Si aparece "AGENCIA DE SEGUROS..." con una clave numérica, NO lo pongas como vendedor. Es el intermediario.

12. Si un dato NO está presente, devuelve cadena vacía "".

RESPONDE ÚNICAMENTE con este JSON (sin texto adicional, sin markdown, sin explicaciones):
{
  "numeroPoliza": "",
  "aseguradora": "",
  "ramo": "",
  "primaNeta": "",
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
}
