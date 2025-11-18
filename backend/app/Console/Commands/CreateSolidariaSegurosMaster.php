<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\Broker;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Auth as FirebaseAuth;

class CreateSolidariaSegurosMaster extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'broker:create-solidaria-seguros 
                            {--password= : Contraseña (opcional, se generará una aleatoria si no se proporciona)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Crea el usuario master y broker para Solidaria Seguros';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $email = 'solidariaseguros@guro.co';
        $brokerName = 'Solidaria Seguros';
        $password = $this->option('password') ?: Str::random(12);

        // Verificar si el email ya existe
        if (User::where('email', $email)->exists()) {
            $this->error("El email {$email} ya está registrado.");
            
            // Mostrar información del usuario existente
            $user = User::where('email', $email)->first();
            $this->info("Usuario existente:");
            $this->table(
                ['Campo', 'Valor'],
                [
                    ['ID', $user->id],
                    ['Nombre', $user->name],
                    ['Email', $user->email],
                    ['Tipo', $user->user_type],
                    ['Broker ID', $user->broker_id ?? 'N/A'],
                    ['Estado', $user->status],
                ]
            );
            
            return 1;
        }

        $this->info("Creando broker y usuario master para Solidaria Seguros...");
        $this->newLine();

        try {
            // Crear usuario en Firebase primero
            $this->info("⏳ Creando usuario en Firebase...");
            
            $firebase = (new Factory)
                ->withServiceAccount(base_path('firebase-admin.json'));
            
            $auth = $firebase->createAuth();
            
            $firebaseUser = $auth->createUser([
                'email' => $email,
                'password' => $password,
                'emailVerified' => true,
                'displayName' => $brokerName,
            ]);

            $this->info("✓ Usuario creado en Firebase (UID: {$firebaseUser->uid})");

            // Crear el usuario master en la base de datos
            $user = User::create([
                'name' => $brokerName,
                'email' => $email,
                'password' => Hash::make($password),
                'firebase_uid' => $firebaseUser->uid,
                'user_type' => 'MASTER',
                'status' => 'active',
                'email_verified_at' => now(),
                'provider' => 'email',
                'role' => 'super_admin',
            ]);

            $this->info("✓ Usuario master creado en BD: {$user->name} ({$user->email})");

            // Crear el broker con datos específicos de Solidaria Seguros
            $broker = Broker::create([
                'name' => 'Solidaria Seguros',
                'legal_name' => 'Solidaria Seguros',
                'document_type' => 'NIT',
                'document_number' => '900' . str_pad(rand(100000, 999999), 6, '0', STR_PAD_LEFT) . '-' . rand(1, 9), // NIT generado
                'email' => $email,
                'phone' => '+57 310 ' . rand(1000000, 9999999), // Teléfono colombiano generado
                'address' => 'Calle 100 # 19-61',
                'city' => 'Bogotá',
                'state' => 'Cundinamarca',
                'country' => 'Colombia',
                'postal_code' => '110111',
                'industry' => 'Seguros y Corretaje',
                'description' => 'Corredor de seguros especializado en soluciones integrales de protección para personas y empresas.',
                'website' => 'https://solidariaseguros.com',
                'business_hours' => [
                    'monday' => ['open' => '08:00', 'close' => '18:00'],
                    'tuesday' => ['open' => '08:00', 'close' => '18:00'],
                    'wednesday' => ['open' => '08:00', 'close' => '18:00'],
                    'thursday' => ['open' => '08:00', 'close' => '18:00'],
                    'friday' => ['open' => '08:00', 'close' => '18:00'],
                    'saturday' => ['open' => '09:00', 'close' => '13:00'],
                    'sunday' => ['closed' => true],
                ],
                'status' => 'active',
                'plan' => 'enterprise',
                'max_users' => 100,
                'max_clients' => 10000,
                'max_policies' => 50000,
                'features' => [
                    'whatsapp',
                    'voice_ai',
                    'email_campaigns',
                    'analytics',
                    'api_access',
                    'custom_branding',
                    'advanced_reports',
                    'multi_location',
                ],
                'settings' => [
                    'currency' => 'COP',
                    'timezone' => 'America/Bogota',
                    'language' => 'es',
                    'date_format' => 'd/m/Y',
                ],
                'brand_colors' => [
                    'primary' => '#1e40af',
                    'secondary' => '#64748b',
                    'accent' => '#10b981',
                ],
                'trial_ends_at' => null, // No está en trial
                'subscription_ends_at' => now()->addYears(5),
                'owner_id' => $user->id,
                'last_activity_at' => now(),
            ]);

            $this->info("✓ Broker creado: {$broker->name} (ID: {$broker->id})");
            $this->info("  - NIT: {$broker->document_number}");
            $this->info("  - Teléfono: {$broker->phone}");

            // Asociar el broker_id al usuario
            $user->update(['broker_id' => $broker->id]);

            $this->newLine();
            $this->info("=== CREDENCIALES DE ACCESO - SOLIDARIA SEGUROS ===");
            $this->table(
                ['Campo', 'Valor'],
                [
                    ['Email', $email],
                    ['Contraseña', $password],
                    ['Tipo de Usuario', 'MASTER'],
                    ['Rol', 'super_admin'],
                    ['Broker ID', $broker->id],
                    ['User ID', $user->id],
                    ['NIT', $broker->document_number],
                    ['Plan', 'Enterprise'],
                ]
            );

            $this->newLine();
            $this->warn("⚠️  IMPORTANTE: Guarda estas credenciales en un lugar seguro.");
            $this->info("✓ Broker Solidaria Seguros y usuario master creados exitosamente!");
            $this->newLine();
            $this->info("🚀 El usuario puede acceder a: https://guro.co");

            return 0;

        } catch (\Exception $e) {
            $this->error("Error al crear el broker y usuario: " . $e->getMessage());
            $this->error("Stack trace: " . $e->getTraceAsString());
            
            // Intentar limpiar si se creó el usuario en Firebase pero falló después
            if (isset($firebaseUser)) {
                try {
                    $auth->deleteUser($firebaseUser->uid);
                    $this->info("✓ Usuario de Firebase limpiado después del error");
                } catch (\Exception $cleanupError) {
                    $this->warn("⚠️  No se pudo limpiar el usuario de Firebase: " . $cleanupError->getMessage());
                }
            }
            
            return 1;
        }
    }
}
