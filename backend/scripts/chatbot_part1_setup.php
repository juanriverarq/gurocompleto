<?php
// Part 1: Create Chatbot, Departments, Flow
use App\Models\Chatbot;
use App\Models\ChatbotFlow;
use App\Models\ChatbotNode;
use App\Models\ChatbotTrigger;
use App\Models\WhatsAppDepartment;
use Illuminate\Support\Facades\DB;

$brokerId = 37;
DB::beginTransaction();
try {
    // Departments
    $depts = [
        'Salud' => 'Cotizaciones, expediciones, modificaciones, siniestros de salud',
        'Vida y Cumplimiento' => 'Vida individual, vida grupo, cumplimiento',
        'Hogar y ARL' => 'Hogar, cumplimiento, ARL',
        'Autos' => 'Cotizaciones, expediciones, siniestros de autos',
        'Empresariales' => 'Pólizas empresariales',
        'Cartera' => 'Legalización de pólizas, abonos y pagos',
    ];
    $hours = [
        'monday'=>['start'=>'07:30','end'=>'17:00'],
        'tuesday'=>['start'=>'07:30','end'=>'17:00'],
        'wednesday'=>['start'=>'07:30','end'=>'17:00'],
        'thursday'=>['start'=>'07:30','end'=>'17:00'],
        'friday'=>['start'=>'07:30','end'=>'16:00'],
    ];
    $deptIds = [];
    foreach ($depts as $name => $desc) {
        $d = WhatsAppDepartment::updateOrCreate(
            ['broker_id'=>$brokerId,'name'=>$name],
            ['description'=>$desc,'is_active'=>true,'auto_assign'=>true,'business_hours'=>$hours]
        );
        $deptIds[$name] = $d->id;
        echo "Dept: $name ID:{$d->id}\n";
    }

    // Chatbot
    $chatbot = Chatbot::updateOrCreate(
        ['broker_id'=>$brokerId,'name'=>'Proyectamos Seguros'],
        [
            'description'=>'Chatbot atención Proyectamos Seguros - Multimarca',
            'is_active'=>true,
            'welcome_message'=>"¡Hola! 👋 Bienvenid@ a *Proyectamos Seguros*, es un gusto poderte atender.",
            'fallback_message'=>"No entendí tu mensaje. Escribe *menu* para ver las opciones.",
            'goodbye_message'=>"¡Gracias por comunicarte con Proyectamos Seguros! 😊",
            'out_of_hours_message'=>"Hola, no estamos disponibles.\nUrgencias:\n📞 José Muñoz: 3104493791\n📞 Sandra Alvarez: 3217000303\n🕐 L-J 7:30-5pm | V 7:30-4pm",
            'ai_enabled'=>false,'typing_delay_ms'=>500,'response_delay_ms'=>1000,
            'session_timeout_minutes'=>30,'max_fallback_count'=>3,
            'business_hours_enabled'=>true,'business_hours'=>$hours,'timezone'=>'America/Bogota',
        ]
    );
    echo "Chatbot ID:{$chatbot->id}\n";

    // Clean old flows
    ChatbotFlow::where('chatbot_id',$chatbot->id)->each(function($f){
        ChatbotNode::where('flow_id',$f->id)->delete();
        ChatbotTrigger::where('flow_id',$f->id)->delete();
        $f->delete();
    });

    $flow = ChatbotFlow::create([
        'chatbot_id'=>$chatbot->id,'name'=>'Menú Principal',
        'description'=>'Flujo principal Proyectamos Seguros',
        'is_default'=>true,'priority'=>100,'is_active'=>true,
    ]);
    echo "Flow ID:{$flow->id}\n";

    // Save IDs for part 2
    $ids = ['chatbot'=>$chatbot->id,'flow'=>$flow->id,'depts'=>$deptIds];
    file_put_contents('/tmp/chatbot_ids.json', json_encode($ids));
    echo "IDs saved to /tmp/chatbot_ids.json\n";

    DB::commit();
    echo "Part 1 DONE\n";
} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: ".$e->getMessage()."\n";
}
