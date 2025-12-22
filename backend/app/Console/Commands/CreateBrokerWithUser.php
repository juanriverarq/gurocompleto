<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Models\Broker;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Auth as FirebaseAuth;

class CreateBrokerWithUser extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'broker:create-with-user 
                            {name : Nombre del broker}
                            {email : Email del usuario master}
                            {--password= : Contraseña (opcional, se generará una aleatoria si no se proporciona)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Crea un nuevo broker con su usuario master';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $brokerName = $this->argument('name');
        $email = $this->argument('email');
        $password = $this->option('password') ?: Str::random(12);

        // Verificar si el email ya existe
        if (User::where('email', $email)->exists()) {
            $this->error("El email {$email} ya está registrado.");
            return 1;
        }

        $this->info("Creando broker y usuario master...");

        try {
            // Crear usuario en Firebase primero
            $this->info("Creando usuario en Firebase...");
            
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
            ]);

            $this->info("✓ Usuario master creado en BD: {$user->name} ({$user->email})");

            // Crear el broker con el owner_id
            $broker = Broker::create([
                'name' => $brokerName,
                'legal_name' => $brokerName,
                'email' => $email,
                'status' => 'active',
                'plan' => 'professional',
                'max_users' => 50,
                'max_clients' => 1000,
                'max_policies' => 5000,
                'features' => [
                    'whatsapp',
                    'voice_ai',
                    'email_campaigns',
                    'analytics',
                    'api_access'
                ],
                'trial_ends_at' => now()->addDays(7),
                'subscription_ends_at' => now()->addYear(),
                'owner_id' => $user->id,
            ]);

            $this->info("✓ Broker creado: {$broker->name} (ID: {$broker->id})");

            // Asociar el broker_id al usuario
            $user->update(['broker_id' => $broker->id]);

            $this->info("✓ Usuario master creado: {$user->name} ({$user->email})");
            $this->newLine();
            
            $this->info("=== CREDENCIALES DE ACCESO ===");
            $this->table(
                ['Campo', 'Valor'],
                [
                    ['Email', $email],
                    ['Contraseña', $password],
                    ['Tipo de Usuario', 'MASTER'],
                    ['Broker ID', $broker->id],
                    ['User ID', $user->id],
                ]
            );

            $this->newLine();
            $this->warn("⚠️  IMPORTANTE: Guarda estas credenciales en un lugar seguro.");
            $this->info("✓ Broker y usuario creados exitosamente!");

            return 0;

        } catch (\Exception $e) {
            $this->error("Error al crear el broker y usuario: " . $e->getMessage());
            return 1;
        }
    }
}