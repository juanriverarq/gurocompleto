<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\WhatsAppInstance;
use App\Models\Broker;
use App\Models\User;

class TestBrokerInstances extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'whatsapp:test-broker-filter';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Probar el filtrado de instancias WhatsApp por broker';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🔍 Probando filtrado de instancias por broker...');
        
        // Obtener todos los brokers
        $brokers = Broker::all();
        $this->info("📊 Total de brokers: " . $brokers->count());
        
        foreach ($brokers as $broker) {
            $this->line("\n🏢 Broker ID {$broker->id}: {$broker->name}");
            
            // Obtener instancias de este broker
            $instances = WhatsAppInstance::where('broker_id', $broker->id)->get();
            $this->info("  📱 Instancias de WhatsApp: " . $instances->count());
            
            foreach ($instances as $instance) {
                $this->line("    • ID: {$instance->id}, Instance ID: {$instance->instance_id}, Status: {$instance->status}");
            }
            
            // Obtener usuarios de este broker
            $users = User::where('broker_id', $broker->id)->get();
            $this->info("  👥 Usuarios: " . $users->count());
            
            foreach ($users as $user) {
                $this->line("    • {$user->nombres} {$user->apellidos} ({$user->email})");
            }
        }
        
        // Instancias sin broker asignado (posible problema)
        $orphanInstances = WhatsAppInstance::whereNull('broker_id')->get();
        if ($orphanInstances->count() > 0) {
            $this->warn("\n⚠️ Instancias sin broker asignado: " . $orphanInstances->count());
            foreach ($orphanInstances as $instance) {
                $this->line("  • ID: {$instance->id}, Instance ID: {$instance->instance_id}");
            }
        }
        
        $this->info("\n✅ Verificación completada.");
        return 0;
    }
}