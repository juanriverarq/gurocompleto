<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ChatbotNode;

$flowId = 6;

// Layout constants
$colWidth = 500;   // horizontal spacing between columns
$rowHeight = 220;  // vertical spacing between rows

// ============================================================
// Tree layout: Main menu center top, 10 branches spread out
// ============================================================

$positions = [];

// Row 0: Start
$positions[271] = [800, 0];       // Inicio (start)

// Row 1: Welcome
$positions[272] = [800, 200];     // Bienvenida

// Row 2: Main Menu (centered)
$positions[273] = [800, 450];     // Menú Principal

// Row 3: 10 category menus/responses spread horizontally
// Categories: Cotizaciones(275), Certificaciones(283), Consultas(286),
//             Cancelaciones(299), Reclamaciones(301), Reembolsos(309),
//             Solicitudes(313), Expediciones(320), Contacto(321), Pagos(324)

$catX = -1000; // start X offset from center
$catY = 800;   // Y for category row

// === 1. COTIZACIONES (col 0) ===
$cx = $catX;
$positions[275] = [$cx, $catY];           // Cotizaciones menu
$positions[276] = [$cx - 200, $catY + $rowHeight];  // Cot Salud submenu
$positions[277] = [$cx - 200, $catY + $rowHeight*2]; // Resp Cot Salud
$positions[278] = [$cx + 0, $catY + $rowHeight];     // Resp Cot Vida
$positions[279] = [$cx + 200, $catY + $rowHeight];   // Resp Cot Autos
$positions[280] = [$cx - 200, $catY + $rowHeight*3]; // Resp Cot Hogar
$positions[281] = [$cx + 0, $catY + $rowHeight*2];   // Resp Cot Emp
$positions[282] = [$cx + 200, $catY + $rowHeight*2]; // Resp Cot Mascotas

// === 2. CERTIFICACIONES (col 1) ===
$cx = $catX + $colWidth;
$positions[283] = [$cx, $catY];
$positions[284] = [$cx - 120, $catY + $rowHeight];  // Cert Viaje
$positions[285] = [$cx + 120, $catY + $rowHeight];  // Cert Renta

// === 3. CONSULTAS (col 2) ===
$cx = $catX + $colWidth*2;
$positions[286] = [$cx, $catY];
$positions[287] = [$cx - 350, $catY + $rowHeight];   // Pagos Sura
$positions[288] = [$cx - 250, $catY + $rowHeight];   // Directorio
$positions[289] = [$cx - 150, $catY + $rowHeight];   // Modif Póliza
$positions[290] = [$cx - 50, $catY + $rowHeight];    // Vigencia SOAT
$positions[291] = [$cx + 50, $catY + $rowHeight];    // Vencimiento
$positions[292] = [$cx + 150, $catY + $rowHeight];   // Sedes
$positions[293] = [$cx + 250, $catY + $rowHeight];   // Coberturas submenu
$positions[298] = [$cx + 350, $catY + $rowHeight];   // Pérdida Cob

// Coberturas sub-items
$positions[294] = [$cx + 150, $catY + $rowHeight*2]; // Cob Salud
$positions[295] = [$cx + 230, $catY + $rowHeight*2]; // Cob Vida
$positions[296] = [$cx + 310, $catY + $rowHeight*2]; // Cob Hogar
$positions[297] = [$cx + 390, $catY + $rowHeight*2]; // Cob Autos

// === 4. CANCELACIONES (col 3) ===
$cx = $catX + $colWidth*3;
$positions[299] = [$cx, $catY];
$positions[300] = [$cx, $catY + $rowHeight];         // Resp Cancelación (shared)

// === 5. RECLAMACIONES (col 4) ===
$cx = $catX + $colWidth*4;
$positions[301] = [$cx, $catY];
$positions[302] = [$cx - 180, $catY + $rowHeight];   // Rec Vida menu
$positions[303] = [$cx - 180, $catY + $rowHeight*2]; // Resp Rec Vida
$positions[304] = [$cx - 0, $catY + $rowHeight];     // Rec Hogar menu
$positions[305] = [$cx - 60, $catY + $rowHeight*2];  // Resp Hogar Daño
$positions[306] = [$cx + 60, $catY + $rowHeight*2];  // Resp Hogar Hurto
$positions[307] = [$cx + 180, $catY + $rowHeight];   // Resp Rec Emp
$positions[308] = [$cx + 300, $catY + $rowHeight];   // Resp Rec Autos

// === 6. REEMBOLSOS (col 5) ===
$cx = $catX + $colWidth*5;
$positions[309] = [$cx, $catY];
$positions[310] = [$cx - 150, $catY + $rowHeight];   // Terapia
$positions[311] = [$cx, $catY + $rowHeight];          // Consulta
$positions[312] = [$cx + 150, $catY + $rowHeight];   // Pagos

// === 7. SOLICITUDES (col 6) ===
$cx = $catX + $colWidth*6;
$positions[313] = [$cx, $catY];
$positions[314] = [$cx - 300, $catY + $rowHeight];   // Domicilio
$positions[315] = [$cx - 180, $catY + $rowHeight];   // Autorizaciones
$positions[316] = [$cx - 60, $catY + $rowHeight];    // Incapacidad
$positions[317] = [$cx + 60, $catY + $rowHeight];    // Medicamentos
$positions[318] = [$cx + 180, $catY + $rowHeight];   // Odonto
$positions[319] = [$cx + 300, $catY + $rowHeight];   // Muestras

// === 8. EXPEDICIONES (col 7) ===
$cx = $catX + $colWidth*7;
$positions[320] = [$cx, $catY];                      // Resp SOAT (directly)

// === 9. CONTACTO (col 8) ===
$cx = $catX + $colWidth*8;
$positions[321] = [$cx, $catY];
$positions[322] = [$cx - 120, $catY + $rowHeight];   // Líneas
$positions[323] = [$cx + 120, $catY + $rowHeight];   // Canales

// === 10. PAGOS (col 9) ===
$cx = $catX + $colWidth*9;
$positions[324] = [$cx, $catY];
$positions[325] = [$cx - 300, $catY + $rowHeight];   // Sura
$positions[326] = [$cx - 180, $catY + $rowHeight];   // Allianz
$positions[327] = [$cx - 60, $catY + $rowHeight];    // Bolívar
$positions[328] = [$cx + 60, $catY + $rowHeight];    // Mapfre
$positions[329] = [$cx + 180, $catY + $rowHeight];   // SBS
$positions[330] = [$cx + 300, $catY + $rowHeight];   // Qualitas

// === TRANSFER NODE (bottom center) ===
$positions[274] = [1200, $catY + $rowHeight*3 + 150]; // Transfer node at bottom

// ============================================================
// Apply positions
// ============================================================
$updated = 0;
foreach ($positions as $nodeId => [$x, $y]) {
    $node = ChatbotNode::find($nodeId);
    if ($node) {
        $node->update(['position_x' => $x, 'position_y' => $y]);
        $updated++;
    } else {
        echo "WARNING: Node $nodeId not found\n";
    }
}

echo "Updated $updated node positions\n";
echo "DONE\n";
