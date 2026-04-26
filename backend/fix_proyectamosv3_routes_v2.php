<?php
/**
 * Fix v2: Rebuild ALL option next_node_id + next_node_id chains using node names
 * Run: /opt/cpanel/ea-php83/root/usr/bin/php fix_proyectamosv3_routes_v2.php
 */
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$FLOW_ID = 36;

// Build name -> id map
$nodes = DB::table('chatbot_nodes')->where('flow_id', $FLOW_ID)->get();
$byName = [];
foreach ($nodes as $n) {
    $byName[$n->name] = $n->id;
}

echo "Loaded " . count($byName) . " nodes\n";

// ========== 1. Fix next_node_id chains (message -> next message, start -> welcome, etc) ==========
$chains = [
    'Inicio' => 'Bienvenida',
    'Bienvenida' => 'Menú Principal',
    // Media chains
    'Salud Reemb - Consulta Msg' => 'Salud Reemb - Video',
    'Salud Med - Renovar Msg' => 'Salud Med - Renovar Video',
    'Salud Med - Domicilio Msg' => 'Salud Med - Domicilio PDF',
    // Asistencia
    'Asistencia' => 'Volver (Asistencia)',
    'Canales de Contacto' => 'Volver (Canales)',
];

// Terminal messages -> back nodes
$terminalToBack = [
    // Autos
    ['targets' => ['Autos - Cotizar','Autos - Modificar','Autos - Cancelar',
        'Autos Cob - Sura','Autos Cob - Allianz','Autos Cob - SBS','Autos Cob - Qualitas','Autos Cob - Bolívar','Autos Cob - Mapfre',
        'Autos Rec - Sura','Autos Rec - Allianz','Autos Rec - SBS','Autos Rec - Qualitas','Autos Rec - Bolívar','Autos Rec - Mapfre'],
     'back' => 'Volver (Autos)'],
    // Salud
    ['targets' => ['Salud - Cotizar','Salud - Modificar','Salud - Cancelar',
        'Salud Cob - Sura','Salud Cob - Allianz','Salud Cob - SBS','Salud Cob - Bolívar','Salud Cob - Mapfre',
        'Salud Rec Sura - Autorización','Salud Reemb - Terapias','Salud Reemb - Video',
        'Salud Rec - Allianz','Salud Rec - SBS','Salud Rec - Bolívar','Salud Rec - Mapfre',
        'Salud Med - Renovar Video','Salud Med - Domicilio PDF'],
     'back' => 'Volver (Salud)'],
    // Vida
    ['targets' => ['Vida - Cotizar','Vida - Modificar','Vida - Cancelar',
        'Vida Cob - Sura','Vida Cob - Allianz','Vida Cob - Bolívar','Vida Cob - Mapfre',
        'Vida Rec - Renta Diaria','Vida Rec - Maternidad','Vida Rec - Enfermedades','Vida Rec - Invalidez',
        'Vida Rec - Allianz','Vida Rec - Bolívar','Vida Rec - Mapfre'],
     'back' => 'Volver (Vida)'],
    // Empresariales
    ['targets' => ['Empresariales - Cotizar','Empresariales - Modificar','Empresariales - Cancelar',
        'Emp Cob - Sura','Emp Cob - Allianz','Emp Cob - SBS','Emp Cob - Bolívar','Emp Cob - Mapfre',
        'Emp Rec Sura - Daños','Emp Rec Sura - Hurto',
        'Emp Rec - Allianz','Emp Rec - SBS','Emp Rec - Bolívar','Emp Rec - Mapfre'],
     'back' => 'Volver (Empresariales)'],
    // Otros
    ['targets' => ['Otros - Arrendamiento','Otros - Viaje','Otros - Cumplimiento','Otros - Mascotas','Otros - SOAT',
        'Hogar - Cotizar','Hogar - Modificar','Hogar - Cancelar',
        'Hogar Cob - Sura','Hogar Cob - Bolívar','Hogar Cob - Allianz','Hogar Cob - Mapfre','Hogar Cob - SBS',
        'Hogar Rec - Daños','Hogar Rec - Hurto'],
     'back' => 'Volver (Otros)'],
    // Cartera
    ['targets' => ['Cartera - Sura','Cartera - Allianz','Cartera - Bolívar','Cartera - Mapfre','Cartera - SBS','Cartera - Qualitas'],
     'back' => 'Volver (Cartera)'],
    // Certificados
    ['targets' => ['Cert - Viaje','Cert - Datos Genéricos','Cert - Endoso','Cert - ARL','Cert - Carátula'],
     'back' => 'Volver (Certificados)'],
    // Otras consultas
    ['targets' => ['Consulta - Longevo','Consulta - Carnet Sura','Consulta - Sedes','Consulta - Vacunación','Consulta - AutoSura',
        'Dir - Sura','Dir - Allianz','Dir - Bolívar','Dir - Mapfre','Dir - SBS'],
     'back' => 'Volver (Otras Consultas)'],
];

DB::beginTransaction();
try {
    // Fix direct chains
    foreach ($chains as $from => $to) {
        if (isset($byName[$from]) && isset($byName[$to])) {
            DB::table('chatbot_nodes')->where('id', $byName[$from])->update(['next_node_id' => $byName[$to]]);
            echo "Chain: {$from} -> {$to}\n";
        }
    }

    // Fix terminal -> back
    foreach ($terminalToBack as $group) {
        $backId = $byName[$group['back']] ?? null;
        if (!$backId) { echo "WARN: back node not found: {$group['back']}\n"; continue; }
        foreach ($group['targets'] as $target) {
            $targetId = $byName[$target] ?? null;
            if (!$targetId) { echo "WARN: target not found: {$target}\n"; continue; }
            DB::table('chatbot_nodes')->where('id', $targetId)->update(['next_node_id' => $backId]);
        }
        echo "Back group: " . count($group['targets']) . " nodes -> {$group['back']}\n";
    }

    // ========== 2. Fix option_routes -> next_node_id in options ==========
    // Map: question node name -> [option_value => target_node_name]
    $optionMap = [
        'Menú Principal' => [
            'autos' => 'Menú Autos',
            'salud' => 'Menú Salud',
            'vida' => 'Menú Vida y Rentas',
            'empresariales' => 'Menú Empresariales',
            'otros_seguros' => 'Menú Otros Seguros',
            'cartera' => 'Menú Cartera',
            'certificados' => 'Menú Certificados',
            'asistencia' => 'Asistencia',
            'otras_consultas' => 'Menú Otras Consultas',
            'canales_contacto' => 'Canales de Contacto',
            'asesor' => 'Transferir a asesor',
        ],
        'Menú Autos' => [
            'autos_cotizar' => 'Autos - Cotizar',
            'autos_modificar' => 'Autos - Modificar',
            'autos_cancelar' => 'Autos - Cancelar',
            'autos_coberturas' => 'Autos - Coberturas',
            'autos_reclamaciones' => 'Autos - Reclamaciones',
            'menu_principal' => 'Menú Principal',
        ],
        'Autos - Coberturas' => [
            'autos_cob_sura' => 'Autos Cob - Sura',
            'autos_cob_allianz' => 'Autos Cob - Allianz',
            'autos_cob_sbs' => 'Autos Cob - SBS',
            'autos_cob_qualitas' => 'Autos Cob - Qualitas',
            'autos_cob_bolivar' => 'Autos Cob - Bolívar',
            'autos_cob_mapfre' => 'Autos Cob - Mapfre',
            'menu_autos' => 'Menú Autos',
        ],
        'Autos - Reclamaciones' => [
            'autos_rec_sura' => 'Autos Rec - Sura',
            'autos_rec_allianz' => 'Autos Rec - Allianz',
            'autos_rec_sbs' => 'Autos Rec - SBS',
            'autos_rec_qualitas' => 'Autos Rec - Qualitas',
            'autos_rec_bolivar' => 'Autos Rec - Bolívar',
            'autos_rec_mapfre' => 'Autos Rec - Mapfre',
            'menu_autos' => 'Menú Autos',
        ],
        'Volver (Autos)' => [
            'menu_autos' => 'Menú Autos',
            'menu_principal' => 'Menú Principal',
        ],
        'Menú Salud' => [
            'salud_cotizar' => 'Salud - Cotizar',
            'salud_modificar' => 'Salud - Modificar',
            'salud_cancelar' => 'Salud - Cancelar',
            'salud_coberturas' => 'Salud - Coberturas',
            'salud_reclamaciones' => 'Salud - Reclamaciones',
            'salud_medicamentos' => 'Salud - Medicamentos POS',
            'menu_principal' => 'Menú Principal',
        ],
        'Salud - Coberturas' => [
            'salud_cob_sura' => 'Salud Cob - Sura',
            'salud_cob_allianz' => 'Salud Cob - Allianz',
            'salud_cob_sbs' => 'Salud Cob - SBS',
            'salud_cob_bolivar' => 'Salud Cob - Bolívar',
            'salud_cob_mapfre' => 'Salud Cob - Mapfre',
            'menu_salud' => 'Menú Salud',
        ],
        'Salud - Reclamaciones' => [
            'salud_rec_sura' => 'Salud Rec - Sura',
            'salud_rec_allianz' => 'Salud Rec - Allianz',
            'salud_rec_sbs' => 'Salud Rec - SBS',
            'salud_rec_bolivar' => 'Salud Rec - Bolívar',
            'salud_rec_mapfre' => 'Salud Rec - Mapfre',
            'menu_salud' => 'Menú Salud',
        ],
        'Salud Rec - Sura' => [
            'salud_rec_sura_autorizacion' => 'Salud Rec Sura - Autorización',
            'salud_rec_sura_reembolso' => 'Salud Rec Sura - Reembolso',
            'salud_reclamaciones' => 'Salud - Reclamaciones',
        ],
        'Salud Rec Sura - Reembolso' => [
            'salud_reemb_terapias' => 'Salud Reemb - Terapias',
            'salud_reemb_consulta' => 'Salud Reemb - Consulta Msg',
            'salud_rec_sura' => 'Salud Rec - Sura',
        ],
        'Salud - Medicamentos POS' => [
            'salud_med_renovar' => 'Salud Med - Renovar Msg',
            'salud_med_domicilio' => 'Salud Med - Domicilio Msg',
            'menu_salud' => 'Menú Salud',
        ],
        'Volver (Salud)' => [
            'menu_salud' => 'Menú Salud',
            'menu_principal' => 'Menú Principal',
        ],
        'Menú Vida y Rentas' => [
            'vida_cotizar' => 'Vida - Cotizar',
            'vida_modificar' => 'Vida - Modificar',
            'vida_cancelar' => 'Vida - Cancelar',
            'vida_coberturas' => 'Vida - Coberturas',
            'vida_reclamaciones' => 'Vida - Reclamaciones',
            'menu_principal' => 'Menú Principal',
        ],
        'Vida - Coberturas' => [
            'vida_cob_sura' => 'Vida Cob - Sura',
            'vida_cob_allianz' => 'Vida Cob - Allianz',
            'vida_cob_bolivar' => 'Vida Cob - Bolívar',
            'vida_cob_mapfre' => 'Vida Cob - Mapfre',
            'menu_vida' => 'Menú Vida y Rentas',
        ],
        'Vida - Reclamaciones' => [
            'vida_rec_sura' => 'Vida Rec - Sura',
            'vida_rec_allianz' => 'Vida Rec - Allianz',
            'vida_rec_bolivar' => 'Vida Rec - Bolívar',
            'vida_rec_mapfre' => 'Vida Rec - Mapfre',
            'menu_vida' => 'Menú Vida y Rentas',
        ],
        'Vida Rec - Sura' => [
            'vida_rec_renta_diaria' => 'Vida Rec - Renta Diaria',
            'vida_rec_maternidad' => 'Vida Rec - Maternidad',
            'vida_rec_enfermedades' => 'Vida Rec - Enfermedades',
            'vida_rec_invalidez' => 'Vida Rec - Invalidez',
            'vida_reclamaciones' => 'Vida - Reclamaciones',
        ],
        'Volver (Vida)' => [
            'menu_vida' => 'Menú Vida y Rentas',
            'menu_principal' => 'Menú Principal',
        ],
        'Menú Empresariales' => [
            'emp_cotizar' => 'Empresariales - Cotizar',
            'emp_modificar' => 'Empresariales - Modificar',
            'emp_cancelar' => 'Empresariales - Cancelar',
            'emp_coberturas' => 'Empresariales - Coberturas',
            'emp_reclamaciones' => 'Empresariales - Reclamaciones',
            'menu_principal' => 'Menú Principal',
        ],
        'Empresariales - Coberturas' => [
            'emp_cob_sura' => 'Emp Cob - Sura',
            'emp_cob_allianz' => 'Emp Cob - Allianz',
            'emp_cob_sbs' => 'Emp Cob - SBS',
            'emp_cob_bolivar' => 'Emp Cob - Bolívar',
            'emp_cob_mapfre' => 'Emp Cob - Mapfre',
            'menu_empresariales' => 'Menú Empresariales',
        ],
        'Empresariales - Reclamaciones' => [
            'emp_rec_sura' => 'Emp Rec - Sura',
            'emp_rec_allianz' => 'Emp Rec - Allianz',
            'emp_rec_sbs' => 'Emp Rec - SBS',
            'emp_rec_bolivar' => 'Emp Rec - Bolívar',
            'emp_rec_mapfre' => 'Emp Rec - Mapfre',
            'menu_empresariales' => 'Menú Empresariales',
        ],
        'Emp Rec - Sura' => [
            'emp_rec_sura_danos' => 'Emp Rec Sura - Daños',
            'emp_rec_sura_hurto' => 'Emp Rec Sura - Hurto',
            'emp_reclamaciones' => 'Empresariales - Reclamaciones',
        ],
        'Volver (Empresariales)' => [
            'menu_empresariales' => 'Menú Empresariales',
            'menu_principal' => 'Menú Principal',
        ],
        'Menú Otros Seguros' => [
            'otros_arrendamiento' => 'Otros - Arrendamiento',
            'otros_viaje' => 'Otros - Viaje',
            'otros_cumplimiento' => 'Otros - Cumplimiento',
            'otros_mascotas' => 'Otros - Mascotas',
            'otros_hogar' => 'Otros - Hogar',
            'otros_soat' => 'Otros - SOAT',
            'menu_principal' => 'Menú Principal',
        ],
        'Otros - Hogar' => [
            'hogar_cotizar' => 'Hogar - Cotizar',
            'hogar_modificar' => 'Hogar - Modificar',
            'hogar_cancelar' => 'Hogar - Cancelar',
            'hogar_coberturas' => 'Hogar - Coberturas',
            'hogar_reclamaciones' => 'Hogar - Reclamaciones',
            'menu_otros_seguros' => 'Menú Otros Seguros',
        ],
        'Hogar - Coberturas' => [
            'hogar_cob_sura' => 'Hogar Cob - Sura',
            'hogar_cob_bolivar' => 'Hogar Cob - Bolívar',
            'hogar_cob_allianz' => 'Hogar Cob - Allianz',
            'hogar_cob_mapfre' => 'Hogar Cob - Mapfre',
            'hogar_cob_sbs' => 'Hogar Cob - SBS',
            'menu_hogar' => 'Otros - Hogar',
        ],
        'Hogar - Reclamaciones' => [
            'hogar_rec_danos' => 'Hogar Rec - Daños',
            'hogar_rec_hurto' => 'Hogar Rec - Hurto',
            'menu_hogar' => 'Otros - Hogar',
        ],
        'Volver (Otros)' => [
            'menu_otros_seguros' => 'Menú Otros Seguros',
            'menu_principal' => 'Menú Principal',
        ],
        'Menú Cartera' => [
            'cartera_sura' => 'Cartera - Sura',
            'cartera_allianz' => 'Cartera - Allianz',
            'cartera_bolivar' => 'Cartera - Bolívar',
            'cartera_mapfre' => 'Cartera - Mapfre',
            'cartera_sbs' => 'Cartera - SBS',
            'cartera_qualitas' => 'Cartera - Qualitas',
            'menu_principal' => 'Menú Principal',
        ],
        'Volver (Cartera)' => [
            'menu_cartera' => 'Menú Cartera',
            'menu_principal' => 'Menú Principal',
        ],
        'Menú Certificados' => [
            'cert_viaje' => 'Cert - Viaje',
            'cert_renta_salud' => 'Cert - Datos Genéricos',
            'cert_eps' => 'Cert - Datos Genéricos',
            'cert_renta_pension' => 'Cert - Datos Genéricos',
            'cert_renta_educativa' => 'Cert - Datos Genéricos',
            'cert_endoso' => 'Cert - Endoso',
            'cert_arl' => 'Cert - ARL',
            'cert_caratula' => 'Cert - Carátula',
            'menu_principal' => 'Menú Principal',
        ],
        'Volver (Certificados)' => [
            'menu_certificados' => 'Menú Certificados',
            'menu_principal' => 'Menú Principal',
        ],
        'Volver (Asistencia)' => [
            'menu_principal' => 'Menú Principal',
        ],
        'Menú Otras Consultas' => [
            'consulta_longevo' => 'Consulta - Longevo',
            'consulta_carnet' => 'Consulta - Carnet Sura',
            'consulta_directorio' => 'Consulta - Directorio Médico',
            'consulta_sedes' => 'Consulta - Sedes',
            'consulta_vacunacion' => 'Consulta - Vacunación',
            'consulta_autosura' => 'Consulta - AutoSura',
            'menu_principal' => 'Menú Principal',
        ],
        'Consulta - Directorio Médico' => [
            'dir_sura' => 'Dir - Sura',
            'dir_allianz' => 'Dir - Allianz',
            'dir_bolivar' => 'Dir - Bolívar',
            'dir_mapfre' => 'Dir - Mapfre',
            'dir_sbs' => 'Dir - SBS',
            'menu_otras_consultas' => 'Menú Otras Consultas',
        ],
        'Volver (Otras Consultas)' => [
            'menu_otras_consultas' => 'Menú Otras Consultas',
            'menu_principal' => 'Menú Principal',
        ],
        'Volver (Canales)' => [
            'menu_principal' => 'Menú Principal',
        ],
    ];

    $fixedNodes = 0;
    foreach ($optionMap as $nodeName => $routes) {
        $nodeId = $byName[$nodeName] ?? null;
        if (!$nodeId) { echo "WARN: node not found: {$nodeName}\n"; continue; }

        $raw = DB::table('chatbot_nodes')->where('id', $nodeId)->value('config');
        $config = json_decode($raw, true);
        $options = $config['options'] ?? [];
        $changed = false;

        foreach ($options as &$opt) {
            $val = $opt['value'] ?? '';
            if (isset($routes[$val])) {
                $targetName = $routes[$val];
                $targetId = $byName[$targetName] ?? null;
                if ($targetId) {
                    $opt['next_node_id'] = $targetId;
                    $changed = true;
                } else {
                    echo "WARN: target node not found: {$targetName}\n";
                }
            }
        }
        unset($opt);

        if ($changed) {
            $config['options'] = $options;
            DB::table('chatbot_nodes')->where('id', $nodeId)->update([
                'config' => json_encode($config),
            ]);
            echo "✅ {$nodeName}: " . count($options) . " options wired\n";
            $fixedNodes++;
        }
    }

    DB::commit();
    echo "\n✅ Done! Fixed {$fixedNodes} question nodes\n";

} catch (\Throwable $e) {
    DB::rollBack();
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
