<?php
/**
 * Organize chatbot node positions for visual layout
 * Run: /opt/cpanel/ea-php83/root/usr/bin/php fix_positions.php
 */
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ChatbotNode;
use Illuminate\Support\Facades\DB;

$FLOW_ID = 8;

// Layout config
$COL_WIDTH = 300;   // horizontal spacing between columns
$ROW_HEIGHT = 120;  // vertical spacing between rows
$SECTION_GAP = 180; // extra gap between sections

DB::beginTransaction();
try {

// Position map: node_id => [x, y]
$positions = [];

// ============================================================
// ROW 0: Start flow (top center)
// ============================================================
$y = 0;
$centerX = 1200;

// Start -> Welcome -> Menu Principal (vertical chain)
$positions[565] = [$centerX, $y];                   // Inicio
$y += $ROW_HEIGHT;
$positions[566] = [$centerX, $y];                   // Bienvenida
$y += $ROW_HEIGHT;
$positions[567] = [$centerX, $y];                   // Menú Principal
$y += $SECTION_GAP;

// ============================================================
// ROW 1: Two main branches + Transfer
// ============================================================
$suraX = 600;
$otrasX = 1800;
$transferX = $centerX;

$positions[569] = [$suraX, $y];                     // Menú Sura
$positions[620] = [$otrasX, $y];                     // Menú Otras
$positions[568] = [$transferX, $y];                  // Transferir a asesor

$y += $SECTION_GAP;

// ============================================================
// SURA SECTION (left side, columns 0-6)
// ============================================================
$suraBaseY = $y;

// -- Column 0: Contacto --
$col = 0;
$cy = $suraBaseY;
$positions[571] = [$col * $COL_WIDTH, $cy];          // Sura Contacto
$cy += $ROW_HEIGHT;
$positions[572] = [$col * $COL_WIDTH - 100, $cy];    // Sura Línea
$positions[573] = [$col * $COL_WIDTH + 100, $cy];    // Sura Canales

// -- Column 1: Cancelaciones --
$col = 1;
$cy = $suraBaseY;
$positions[574] = [$col * $COL_WIDTH, $cy];          // Sura Cancelaciones
$cy += $ROW_HEIGHT;
$positions[575] = [$col * $COL_WIDTH - 120, $cy];    // Cancel Info General
$positions[576] = [$col * $COL_WIDTH, $cy];           // Cancel Autos
$positions[577] = [$col * $COL_WIDTH + 120, $cy];     // Cancel Hogar/Emp

// -- Column 2: Consultas --
$col = 2;
$cy = $suraBaseY;
$positions[578] = [$col * $COL_WIDTH, $cy];          // Sura Consultas
$cy += $ROW_HEIGHT;
// Direct answers
$positions[580] = [$col * $COL_WIDTH - 250, $cy];    // Sura Pagos
$positions[581] = [$col * $COL_WIDTH - 125, $cy];    // Sura Directorio
$positions[582] = [$col * $COL_WIDTH, $cy];           // Sura Modificación
$positions[583] = [$col * $COL_WIDTH + 125, $cy];     // Sura SOAT
$positions[584] = [$col * $COL_WIDTH + 250, $cy];     // Sura Vencimiento
$cy += $ROW_HEIGHT;
$positions[585] = [$col * $COL_WIDTH - 125, $cy];     // Sura Pérdida Cob
// Sub-menus
$positions[586] = [$col * $COL_WIDTH + 50, $cy];      // Sura Coberturas
$positions[591] = [$col * $COL_WIDTH + 200, $cy];     // Sura Sedes
$cy += $ROW_HEIGHT;
// Coberturas children
$positions[587] = [$col * $COL_WIDTH - 100, $cy];     // Cob Salud
$positions[588] = [$col * $COL_WIDTH, $cy];            // Cob Vida
$positions[589] = [$col * $COL_WIDTH + 100, $cy];      // Cob Hogar
$positions[590] = [$col * $COL_WIDTH + 200, $cy];      // Cob Autos
// Sedes children
$positions[592] = [$col * $COL_WIDTH + 350, $cy];      // Sedes Salud
$positions[593] = [$col * $COL_WIDTH + 500, $cy];      // AutoSura
$cy += $ROW_HEIGHT;
$positions[579] = [$col * $COL_WIDTH, $cy];            // Volver Consultas

// -- Column 3: Cotizaciones --
$col = 3;
$cy = $suraBaseY;
$positions[594] = [$col * $COL_WIDTH, $cy];           // Sura Cotizaciones
$cy += $ROW_HEIGHT;
$positions[596] = [$col * $COL_WIDTH - 200, $cy];     // Cot Vida/Salud
$positions[597] = [$col * $COL_WIDTH - 80, $cy];      // Cot Autos
$positions[598] = [$col * $COL_WIDTH + 40, $cy];       // Cot Hogar
$positions[599] = [$col * $COL_WIDTH + 160, $cy];      // Cot Mascotas
$positions[600] = [$col * $COL_WIDTH + 280, $cy];      // Cot Empresarial
$cy += $ROW_HEIGHT;
$positions[595] = [$col * $COL_WIDTH, $cy];            // Volver Cotizaciones

// -- Column 4: Reclamaciones --
$col = 4;
$cy = $suraBaseY;
$positions[601] = [$col * $COL_WIDTH, $cy];           // Sura Reclamaciones
$cy += $ROW_HEIGHT;
$positions[603] = [$col * $COL_WIDTH - 150, $cy];     // Rec Vida
$positions[604] = [$col * $COL_WIDTH - 50, $cy];      // Rec Hogar Daños
$positions[605] = [$col * $COL_WIDTH + 50, $cy];       // Rec Hogar Hurtos
$positions[606] = [$col * $COL_WIDTH + 150, $cy];      // Rec Autos Sura
$cy += $ROW_HEIGHT;
$positions[602] = [$col * $COL_WIDTH, $cy];            // Volver Reclamaciones

// -- Column 5: Reembolsos --
$col = 5;
$cy = $suraBaseY;
$positions[607] = [$col * $COL_WIDTH, $cy];           // Sura Reembolsos
$cy += $ROW_HEIGHT;
$positions[609] = [$col * $COL_WIDTH - 100, $cy];     // Reemb Terapia
$positions[610] = [$col * $COL_WIDTH, $cy];            // Reemb Consulta
$positions[611] = [$col * $COL_WIDTH + 100, $cy];      // Reemb Pagos
$cy += $ROW_HEIGHT;
$positions[608] = [$col * $COL_WIDTH, $cy];            // Volver Reembolsos

// -- Column 6: Solicitudes --
$col = 6;
$cy = $suraBaseY;
$positions[612] = [$col * $COL_WIDTH, $cy];           // Sura Solicitudes
$cy += $ROW_HEIGHT;
$positions[614] = [$col * $COL_WIDTH - 200, $cy];     // Sol Domicilio
$positions[615] = [$col * $COL_WIDTH - 80, $cy];      // Sol Autorizaciones
$positions[616] = [$col * $COL_WIDTH + 40, $cy];       // Sol EPS
$positions[617] = [$col * $COL_WIDTH + 160, $cy];      // Sol Medicamentos
$positions[618] = [$col * $COL_WIDTH + 280, $cy];      // Sol Odonto
$positions[619] = [$col * $COL_WIDTH + 400, $cy];      // Sol Muestras
$cy += $ROW_HEIGHT;
$positions[613] = [$col * $COL_WIDTH, $cy];            // Volver Solicitudes

// Volver Sura (below Sura menu)
$positions[570] = [$suraX, $suraBaseY + 5 * $ROW_HEIGHT]; // Volver Sura

// ============================================================
// OTRAS COMPAÑÍAS SECTION (right side)
// ============================================================
$otrasBaseY = $y;
$oBase = 7; // start column offset

// -- Col 7: Asistencia (simple) --
$col = $oBase;
$cy = $otrasBaseY;
$positions[622] = [$col * $COL_WIDTH, $cy];            // Otras Asistencia

// -- Col 8: Cancelaciones --
$col = $oBase + 1;
$cy = $otrasBaseY;
$positions[623] = [$col * $COL_WIDTH, $cy];            // Otras Cancelaciones
$cy += $ROW_HEIGHT;
$positions[624] = [$col * $COL_WIDTH - 80, $cy];       // Otras Cancel Hogar
$positions[625] = [$col * $COL_WIDTH + 80, $cy];        // Otras Cancel Autos

// -- Col 9: Coberturas --
$col = $oBase + 2;
$cy = $otrasBaseY;
$positions[626] = [$col * $COL_WIDTH, $cy];            // Otras Coberturas
$cy += $ROW_HEIGHT;
$positions[627] = [$col * $COL_WIDTH - 200, $cy];      // Cob Allianz
$positions[628] = [$col * $COL_WIDTH - 100, $cy];       // Cob Bolívar
$positions[629] = [$col * $COL_WIDTH, $cy];              // Cob Qualitas
$positions[630] = [$col * $COL_WIDTH + 100, $cy];        // Cob SBS
$positions[631] = [$col * $COL_WIDTH + 200, $cy];        // Cob Mapfre

// -- Col 10: Cotizaciones --
$col = $oBase + 3;
$cy = $otrasBaseY;
$positions[632] = [$col * $COL_WIDTH, $cy];            // Otras Cotizaciones
$cy += $ROW_HEIGHT;
$positions[633] = [$col * $COL_WIDTH - 150, $cy];      // Otras Cot Salud
$positions[634] = [$col * $COL_WIDTH - 50, $cy];        // Otras Cot Autos
$positions[635] = [$col * $COL_WIDTH + 50, $cy];         // Otras Cot Hogar
$positions[636] = [$col * $COL_WIDTH + 150, $cy];        // Otras Cot Emp

// -- Col 11: Reclamaciones --
$col = $oBase + 4;
$cy = $otrasBaseY;
$positions[637] = [$col * $COL_WIDTH, $cy];            // Otras Reclamaciones
$cy += $ROW_HEIGHT;
$positions[638] = [$col * $COL_WIDTH - 120, $cy];      // Otras Rec Autos
$positions[639] = [$col * $COL_WIDTH, $cy];              // Otras Rec Hurtos
$positions[640] = [$col * $COL_WIDTH + 120, $cy];        // Otras Rec Daños

// -- Col 12: Pagos --
$col = $oBase + 5;
$cy = $otrasBaseY;
$positions[641] = [$col * $COL_WIDTH, $cy];            // Otras Pagos
$cy += $ROW_HEIGHT;
$positions[642] = [$col * $COL_WIDTH - 200, $cy];      // Pago Allianz
$positions[643] = [$col * $COL_WIDTH - 100, $cy];       // Pago Bolívar
$positions[644] = [$col * $COL_WIDTH, $cy];              // Pago Mapfre
$positions[645] = [$col * $COL_WIDTH + 100, $cy];        // Pago SBS
$positions[646] = [$col * $COL_WIDTH + 200, $cy];        // Pago Qualitas

// -- Col 13: Fecha pago --
$col = $oBase + 6;
$cy = $otrasBaseY;
$positions[647] = [$col * $COL_WIDTH, $cy];            // Otras Fecha Pago
$cy += $ROW_HEIGHT;
$positions[648] = [$col * $COL_WIDTH - 80, $cy];       // Fecha Hogar
$positions[649] = [$col * $COL_WIDTH + 80, $cy];        // Fecha Autos

// Volver Otras
$positions[621] = [$otrasX, $otrasBaseY + 3 * $ROW_HEIGHT]; // Volver Otras

// ============================================================
// APPLY POSITIONS
// ============================================================
$updated = 0;
$nodes = ChatbotNode::where('flow_id', $FLOW_ID)->get();
foreach ($nodes as $node) {
    if (isset($positions[$node->id])) {
        $node->update([
            'position_x' => $positions[$node->id][0],
            'position_y' => $positions[$node->id][1],
        ]);
        $updated++;
    } else {
        echo "⚠️  No position for: {$node->id} ({$node->name})\n";
    }
}

DB::commit();
echo "✅ Updated positions for {$updated}/{$nodes->count()} nodes\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ Error: " . $e->getMessage() . "\n";
}
