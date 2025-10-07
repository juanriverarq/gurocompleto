<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;

class CheckUsers extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'check:users';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Verificar usuarios y Firebase UIDs';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('=== VERIFICACIÓN DE USUARIOS ===');
        
        // 1. Primer usuario
        $firstUser = User::first();
        $this->info("\n1. PRIMER USUARIO EN LA BASE DE DATOS:");
        $this->line("   ID: {$firstUser->id}");
        $this->line("   Nombre: {$firstUser->name}");
        $this->line("   Email: {$firstUser->email}");
        $this->line("   Firebase UID: {$firstUser->firebase_uid}");
        $this->line("   Broker ID: {$firstUser->broker_id}");
        $this->line("   Tipo: {$firstUser->user_type}");

        // 2. Usuario chseguros.com.co@gmail.com
        $chsegurosUser = User::where('email', 'chseguros.com.co@gmail.com')->first();
        if ($chsegurosUser) {
            $this->info("\n2. USUARIO chseguros.com.co@gmail.com:");
            $this->line("   ID: {$chsegurosUser->id}");
            $this->line("   Nombre: {$chsegurosUser->name}");
            $this->line("   Firebase UID: {$chsegurosUser->firebase_uid}");
            $this->line("   Broker ID: {$chsegurosUser->broker_id}");
            $this->line("   Tipo: {$chsegurosUser->user_type}");
        } else {
            $this->warn("\n2. USUARIO chseguros.com.co@gmail.com NO ENCONTRADO");
        }

        // 3. Buscar usuarios con Firebase UID duplicados
        $duplicates = User::select('firebase_uid', \DB::raw('COUNT(*) as count'))
            ->whereNotNull('firebase_uid')
            ->groupBy('firebase_uid')
            ->having('count', '>', 1)
            ->get();

        if ($duplicates->count() > 0) {
            $this->info("\n3. USUARIOS CON FIREBASE UID DUPLICADOS:");
            foreach ($duplicates as $dup) {
                $this->line("   Firebase UID: {$dup->firebase_uid} - Cantidad: {$dup->count}");
                $users = User::where('firebase_uid', $dup->firebase_uid)->get();
                foreach ($users as $user) {
                    $this->line("      - {$user->name} ({$user->email}) - ID: {$user->id}");
                }
            }
        } else {
            $this->info("\n3. NO HAY FIREBASE UIDs DUPLICADOS");
        }

        // 4. Total de usuarios
        $totalUsers = User::count();
        $this->info("\n4. TOTAL DE USUARIOS: {$totalUsers}");

        // 5. Usuarios con broker_id 5
        $broker5Users = User::where('broker_id', 5)->get();
        $this->info("\n5. USUARIOS CON BROKER_ID 5:");
        foreach ($broker5Users as $user) {
            $this->line("   - {$user->name} ({$user->email}) - ID: {$user->id}");
        }
        
        // 6. Verificar si hay múltiples usuarios con el mismo email
        $duplicateEmails = User::select('email', \DB::raw('COUNT(*) as count'))
            ->groupBy('email')
            ->having('count', '>', 1)
            ->get();
            
        if ($duplicateEmails->count() > 0) {
            $this->info("\n6. EMAILS DUPLICADOS:");
            foreach ($duplicateEmails as $dup) {
                $this->line("   Email: {$dup->email} - Cantidad: {$dup->count}");
            }
        } else {
            $this->info("\n6. NO HAY EMAILS DUPLICADOS");
        }

        $this->info("\n=== FIN DE VERIFICACIÓN ===");
        
        return Command::SUCCESS;
    }
}
