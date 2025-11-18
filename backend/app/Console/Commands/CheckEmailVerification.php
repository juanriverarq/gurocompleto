<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;

class CheckEmailVerification extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'email:check-verification {email?}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Verifica el estado de verificación de emails en la base de datos';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $email = $this->argument('email');

        if ($email) {
            // Verificar un usuario específico
            $this->checkSpecificUser($email);
        } else {
            // Mostrar estadísticas generales
            $this->showStatistics();
        }

        return 0;
    }

    /**
     * Verificar un usuario específico
     */
    private function checkSpecificUser($email)
    {
        $this->info("Buscando usuario: $email");

        $user = User::where('email', $email)->first();

        if (!$user) {
            $this->error("✗ Usuario no encontrado");
            return;
        }

        $this->info("✓ Usuario encontrado");
        
        $this->table(
            ['Campo', 'Valor'],
            [
                ['ID', $user->id],
                ['Nombre', $user->name],
                ['Email', $user->email],
                ['Firebase UID', $user->firebase_uid ?? 'N/A'],
                ['Provider', $user->provider],
                ['Tipo Usuario', $user->user_type],
                ['Estado', $user->status],
                ['Email Verificado', $user->hasVerifiedEmail() ? '✓ SÍ' : '✗ NO'],
                ['Fecha Verificación', $user->email_verified_at ?? 'No verificado'],
                ['Creado', $user->created_at],
                ['Último Login', $user->last_login_at ?? 'Nunca'],
            ]
        );

        if (!$user->hasVerifiedEmail()) {
            if ($this->confirm('¿Deseas marcar este email como verificado?')) {
                $user->markEmailAsVerified();
                $this->info("✓ Email marcado como verificado");
            }
        }
    }

    /**
     * Mostrar estadísticas generales
     */
    private function showStatistics()
    {
        $this->info("=== ESTADÍSTICAS DE VERIFICACIÓN DE EMAILS ===\n");

        // Estadísticas generales
        $total = User::count();
        $verificados = User::whereNotNull('email_verified_at')->count();
        $noVerificados = User::whereNull('email_verified_at')->count();
        $porcentaje = $total > 0 ? round(($verificados / $total) * 100, 2) : 0;

        $this->table(
            ['Métrica', 'Valor'],
            [
                ['Total de usuarios', $total],
                ['Emails verificados', "$verificados ($porcentaje%)"],
                ['Emails NO verificados', $noVerificados],
            ]
        );

        // Usuarios por proveedor
        $this->newLine();
        $this->info("USUARIOS POR PROVEEDOR:");
        $providers = User::selectRaw('provider, COUNT(*) as total')
            ->selectRaw('SUM(CASE WHEN email_verified_at IS NOT NULL THEN 1 ELSE 0 END) as verificados')
            ->groupBy('provider')
            ->get();

        $providerData = $providers->map(function($prov) {
            return [
                $prov->provider,
                $prov->total,
                $prov->verificados,
                $prov->total > 0 ? round(($prov->verificados / $prov->total) * 100, 2) . '%' : '0%'
            ];
        })->toArray();

        $this->table(
            ['Provider', 'Total', 'Verificados', '% Verificados'],
            $providerData
        );

        // Mostrar usuarios NO verificados si hay pocos
        if ($noVerificados > 0 && $noVerificados <= 20) {
            $this->newLine();
            $this->warn("USUARIOS CON EMAIL NO VERIFICADO:");
            
            $usuariosNoVerificados = User::whereNull('email_verified_at')
                ->select('id', 'name', 'email', 'provider', 'created_at')
                ->orderBy('created_at', 'desc')
                ->get();

            $data = $usuariosNoVerificados->map(function($user) {
                return [
                    $user->id,
                    $user->name,
                    $user->email,
                    $user->provider,
                    $user->created_at->format('Y-m-d H:i')
                ];
            })->toArray();

            $this->table(
                ['ID', 'Nombre', 'Email', 'Provider', 'Creado'],
                $data
            );

            if ($this->confirm('¿Deseas marcar todos estos emails como verificados?', false)) {
                User::whereNull('email_verified_at')->update(['email_verified_at' => now()]);
                $this->info("✓ Todos los emails han sido marcados como verificados");
            }
        } elseif ($noVerificados > 20) {
            $this->newLine();
            $this->warn("Hay $noVerificados usuarios sin verificar. Usa 'php artisan email:check-verification email@ejemplo.com' para verificar usuarios específicos.");
        }
    }
}
