<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ChatbotNode;
use App\Models\ChatbotFlow;
use Illuminate\Support\Facades\DB;

// Find flow dynamically
$flow = ChatbotFlow::whereHas('chatbot', fn($q) => $q->where('broker_id', 53))->where('is_default', true)->first();
if (!$flow) { echo "❌ Flow not found\n"; exit(1); }
$FLOW_ID = $flow->id;
echo "Flow ID: {$FLOW_ID}\n";

// Get all nodes indexed by name
$allNodes = ChatbotNode::where('flow_id', $FLOW_ID)->get();
$byName = [];
foreach ($allNodes as $n) { $byName[$n->name] = $n->id; }

function nid($byName, $name) {
    if (!isset($byName[$name])) { echo "⚠️  Name not found: {$name}\n"; return -1; }
    return $byName[$name];
}

$COL_WIDTH = 1200;
$ROW_HEIGHT = 1200;
$SECTION_GAP = 1800;

DB::beginTransaction();
try {

$p = []; // name => [x, y]
$y = 0;
$centerX = 5000;

// Start -> Welcome -> Menu Principal
$p['Inicio'] = [$centerX, $y];
$y += $ROW_HEIGHT;
$p['Bienvenida'] = [$centerX, $y];
$y += $ROW_HEIGHT;
$p['Menú Principal'] = [$centerX, $y];
$y += $SECTION_GAP;

$suraX = 2400;
$otrasX = 7200;
$p['Menú Sura'] = [$suraX, $y];
$p['Menú Otras'] = [$otrasX, $y];
$p['Transferir a asesor'] = [$centerX, $y];
$y += $SECTION_GAP;

// ============ SURA ============
$suraBaseY = $y;

// Col 0: Contacto
$col = 0; $cy = $suraBaseY;
$p['Sura Contacto'] = [$col * $COL_WIDTH, $cy];
$cy += $ROW_HEIGHT;
$p['Sura Línea'] = [$col * $COL_WIDTH - 400, $cy];
$p['Sura Canales'] = [$col * $COL_WIDTH + 400, $cy];

// Col 1: Cancelaciones
$col = 1; $cy = $suraBaseY;
$p['Sura Cancelaciones'] = [$col * $COL_WIDTH, $cy];
$cy += $ROW_HEIGHT;
$p['Cancel Info General'] = [$col * $COL_WIDTH - 500, $cy];
$p['Cancel Autos'] = [$col * $COL_WIDTH, $cy];
$p['Cancel Hogar/Emp'] = [$col * $COL_WIDTH + 500, $cy];

// Col 2: Consultas
$col = 2; $cy = $suraBaseY;
$p['Sura Consultas'] = [$col * $COL_WIDTH, $cy];
$cy += $ROW_HEIGHT;
$p['Sura Pagos'] = [$col * $COL_WIDTH - 1000, $cy];
$p['Sura Directorio'] = [$col * $COL_WIDTH - 500, $cy];
$p['Sura Modificación'] = [$col * $COL_WIDTH, $cy];
$p['Sura SOAT'] = [$col * $COL_WIDTH + 500, $cy];
$p['Sura Vencimiento'] = [$col * $COL_WIDTH + 1000, $cy];
$cy += $ROW_HEIGHT;
$p['Sura Pérdida Cob'] = [$col * $COL_WIDTH - 500, $cy];
$p['Sura Coberturas'] = [$col * $COL_WIDTH + 200, $cy];
$p['Sura Sedes'] = [$col * $COL_WIDTH + 800, $cy];
$cy += $ROW_HEIGHT;
$p['Cob Salud'] = [$col * $COL_WIDTH - 400, $cy];
$p['Cob Vida'] = [$col * $COL_WIDTH, $cy];
$p['Cob Hogar'] = [$col * $COL_WIDTH + 400, $cy];
$p['Cob Autos'] = [$col * $COL_WIDTH + 800, $cy];
$p['Sedes Salud'] = [$col * $COL_WIDTH + 1400, $cy];
$p['AutoSura'] = [$col * $COL_WIDTH + 2000, $cy];
$cy += $ROW_HEIGHT;
$p['Volver Consultas'] = [$col * $COL_WIDTH, $cy];

// Col 3: Cotizaciones
$col = 3; $cy = $suraBaseY;
$p['Sura Cotizaciones'] = [$col * $COL_WIDTH, $cy];
$cy += $ROW_HEIGHT;
$p['Cot Vida/Salud'] = [$col * $COL_WIDTH - 800, $cy];
$p['Cot Autos'] = [$col * $COL_WIDTH - 400, $cy];
$p['Cot Hogar'] = [$col * $COL_WIDTH, $cy];
$p['Cot Mascotas'] = [$col * $COL_WIDTH + 400, $cy];
$p['Cot Empresarial'] = [$col * $COL_WIDTH + 800, $cy];
$cy += $ROW_HEIGHT;
$p['Volver Cotizaciones'] = [$col * $COL_WIDTH, $cy];

// Col 4: Reclamaciones
$col = 4; $cy = $suraBaseY;
$p['Sura Reclamaciones'] = [$col * $COL_WIDTH, $cy];
$cy += $ROW_HEIGHT;
$p['Rec Vida'] = [$col * $COL_WIDTH - 600, $cy];
$p['Rec Hogar Daños'] = [$col * $COL_WIDTH - 200, $cy];
$p['Rec Hogar Hurtos'] = [$col * $COL_WIDTH + 200, $cy];
$p['Rec Autos Sura'] = [$col * $COL_WIDTH + 600, $cy];
$cy += $ROW_HEIGHT;
$p['Volver Reclamaciones'] = [$col * $COL_WIDTH, $cy];

// Col 5: Reembolsos
$col = 5; $cy = $suraBaseY;
$p['Sura Reembolsos'] = [$col * $COL_WIDTH, $cy];
$cy += $ROW_HEIGHT;
$p['Reemb Terapia'] = [$col * $COL_WIDTH - 400, $cy];
$p['Reemb Consulta'] = [$col * $COL_WIDTH, $cy];
$p['Reemb Pagos'] = [$col * $COL_WIDTH + 400, $cy];
$cy += $ROW_HEIGHT;
$p['Volver Reembolsos'] = [$col * $COL_WIDTH, $cy];

// Col 6: Solicitudes
$col = 6; $cy = $suraBaseY;
$p['Sura Solicitudes'] = [$col * $COL_WIDTH, $cy];
$cy += $ROW_HEIGHT;
$p['Sol Domicilio'] = [$col * $COL_WIDTH - 800, $cy];
$p['Sol Autorizaciones'] = [$col * $COL_WIDTH - 400, $cy];
$p['Sol EPS'] = [$col * $COL_WIDTH, $cy];
$p['Sol Medicamentos'] = [$col * $COL_WIDTH + 400, $cy];
$p['Sol Odonto'] = [$col * $COL_WIDTH + 800, $cy];
$p['Sol Muestras'] = [$col * $COL_WIDTH + 1200, $cy];
$cy += $ROW_HEIGHT;
$p['Volver Solicitudes'] = [$col * $COL_WIDTH, $cy];

// Volver Sura
$p['Volver Sura'] = [$suraX, $suraBaseY + 5 * $ROW_HEIGHT];

// ============ OTRAS ============
$otrasBaseY = $suraBaseY;
$oBase = 8;

$col = $oBase;
$p['Otras Asistencia'] = [$col * $COL_WIDTH, $otrasBaseY];

$col = $oBase + 1;
$p['Otras Cancelaciones'] = [$col * $COL_WIDTH, $otrasBaseY];
$p['Otras Cancel Hogar'] = [$col * $COL_WIDTH - 400, $otrasBaseY + $ROW_HEIGHT];
$p['Otras Cancel Autos'] = [$col * $COL_WIDTH + 400, $otrasBaseY + $ROW_HEIGHT];

$col = $oBase + 2;
$p['Otras Coberturas'] = [$col * $COL_WIDTH, $otrasBaseY];
$cy = $otrasBaseY + $ROW_HEIGHT;
$p['Cob Allianz'] = [$col * $COL_WIDTH - 800, $cy];
$p['Cob Bolívar'] = [$col * $COL_WIDTH - 400, $cy];
$p['Cob Qualitas'] = [$col * $COL_WIDTH, $cy];
$p['Cob SBS'] = [$col * $COL_WIDTH + 400, $cy];
$p['Cob Mapfre'] = [$col * $COL_WIDTH + 800, $cy];

$col = $oBase + 3;
$p['Otras Cotizaciones'] = [$col * $COL_WIDTH, $otrasBaseY];
$cy = $otrasBaseY + $ROW_HEIGHT;
$p['Otras Cot Salud'] = [$col * $COL_WIDTH - 600, $cy];
$p['Otras Cot Autos'] = [$col * $COL_WIDTH - 200, $cy];
$p['Otras Cot Hogar'] = [$col * $COL_WIDTH + 200, $cy];
$p['Otras Cot Emp'] = [$col * $COL_WIDTH + 600, $cy];

$col = $oBase + 4;
$p['Otras Reclamaciones'] = [$col * $COL_WIDTH, $otrasBaseY];
$cy = $otrasBaseY + $ROW_HEIGHT;
$p['Otras Rec Autos'] = [$col * $COL_WIDTH - 500, $cy];
$p['Otras Rec Hurtos'] = [$col * $COL_WIDTH, $cy];
$p['Otras Rec Daños'] = [$col * $COL_WIDTH + 500, $cy];

$col = $oBase + 5;
$p['Otras Pagos'] = [$col * $COL_WIDTH, $otrasBaseY];
$cy = $otrasBaseY + $ROW_HEIGHT;
$p['Pago Allianz'] = [$col * $COL_WIDTH - 800, $cy];
$p['Pago Bolívar'] = [$col * $COL_WIDTH - 400, $cy];
$p['Pago Mapfre'] = [$col * $COL_WIDTH, $cy];
$p['Pago SBS'] = [$col * $COL_WIDTH + 400, $cy];
$p['Pago Qualitas'] = [$col * $COL_WIDTH + 800, $cy];

$col = $oBase + 6;
$p['Otras Fecha Pago'] = [$col * $COL_WIDTH, $otrasBaseY];
$cy = $otrasBaseY + $ROW_HEIGHT;
$p['Fecha Hogar'] = [$col * $COL_WIDTH - 400, $cy];
$p['Fecha Autos'] = [$col * $COL_WIDTH + 400, $cy];

$p['Volver Otras'] = [$otrasX, $otrasBaseY + 3 * $ROW_HEIGHT];

// ============ APPLY ============
$updated = 0;
$nodes = ChatbotNode::where('flow_id', $FLOW_ID)->get();
foreach ($nodes as $node) {
    if (isset($p[$node->name])) {
        $node->update([
            'position_x' => $p[$node->name][0],
            'position_y' => $p[$node->name][1],
        ]);
        $updated++;
    } else {
        echo "⚠️  No position for: {$node->id} ({$node->name})\n";
    }
}

DB::commit();
echo "✅ Updated {$updated}/{$nodes->count()} nodes with 10x vertical, 4x horizontal spacing\n";

} catch (\Exception $e) {
    DB::rollBack();
    echo "❌ Error: " . $e->getMessage() . "\n";
}
