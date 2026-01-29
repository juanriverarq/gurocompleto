<?php

namespace App\Console\Commands;

use App\Models\Broker;
use App\Models\Subscription;
use App\Models\SubscriptionIntent;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ProcessSubscriptionBilling extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'billing:process-subscriptions 
                            {--dry-run : Solo mostrar qué se haría sin ejecutar cambios}
                            {--notify-only : Solo enviar notificaciones sin procesar cobros}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Procesa suscripciones: verifica trials expirados, suscripciones próximas a vencer y genera cobros recurrentes';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $dryRun = $this->option('dry-run');
        $notifyOnly = $this->option('notify-only');
        
        $this->info('=== Procesando Suscripciones ===');
        $this->info('Fecha: ' . now()->format('Y-m-d H:i:s'));
        
        if ($dryRun) {
            $this->warn('MODO DRY-RUN: No se realizarán cambios');
        }
        
        // 1. Procesar trials expirados
        $this->processExpiredTrials($dryRun);
        
        // 2. Notificar suscripciones próximas a vencer (5, 3, 1 días)
        $this->notifyUpcomingExpirations($dryRun);
        
        // 3. Procesar suscripciones vencidas (cambiar estado)
        if (!$notifyOnly) {
            $this->processExpiredSubscriptions($dryRun);
        }
        
        // 4. Generar cobros recurrentes para suscripciones activas
        if (!$notifyOnly) {
            $this->generateRecurringCharges($dryRun);
        }
        
        $this->info('=== Proceso completado ===');
        
        return Command::SUCCESS;
    }

    /**
     * Procesar trials que han expirado
     */
    private function processExpiredTrials(bool $dryRun): void
    {
        $this->info("\n--- Procesando Trials Expirados ---");
        
        $expiredTrials = Broker::where('status', 'trial')
            ->whereNotNull('trial_ends_at')
            ->where('trial_ends_at', '<', now())
            ->get();
        
        $this->info("Trials expirados encontrados: {$expiredTrials->count()}");
        
        foreach ($expiredTrials as $broker) {
            $this->line("  - Broker #{$broker->id}: {$broker->name} (Trial terminó: {$broker->trial_ends_at})");
            
            if (!$dryRun) {
                // Cambiar estado a 'trial_expired'
                $broker->update(['status' => 'trial_expired']);
                
                Log::info('Trial expirado procesado', [
                    'broker_id' => $broker->id,
                    'broker_name' => $broker->name,
                    'trial_ends_at' => $broker->trial_ends_at,
                ]);
            }
        }
    }

    /**
     * Notificar suscripciones próximas a vencer
     */
    private function notifyUpcomingExpirations(bool $dryRun): void
    {
        $this->info("\n--- Notificando Suscripciones Próximas a Vencer ---");
        
        $daysToNotify = [5, 3, 1];
        
        foreach ($daysToNotify as $days) {
            $targetDate = now()->addDays($days)->startOfDay();
            $endOfDay = $targetDate->copy()->endOfDay();
            
            // Buscar suscripciones que vencen en exactamente $days días
            $subscriptions = Subscription::where('status', 'active')
                ->whereNotNull('current_period_end')
                ->whereBetween('current_period_end', [$targetDate, $endOfDay])
                ->with('user')
                ->get();
            
            if ($subscriptions->count() > 0) {
                $this->info("  Suscripciones que vencen en {$days} días: {$subscriptions->count()}");
                
                foreach ($subscriptions as $subscription) {
                    $userName = $subscription->user?->name ?? 'Usuario desconocido';
                    $this->line("    - Suscripción #{$subscription->id}: {$userName}");
                    
                    if (!$dryRun) {
                        // TODO: Enviar notificación por email/push
                        Log::info('Notificación de vencimiento enviada', [
                            'subscription_id' => $subscription->id,
                            'user_id' => $subscription->user_id,
                            'days_remaining' => $days,
                            'expires_at' => $subscription->current_period_end,
                        ]);
                    }
                }
            }
        }
        
        // También notificar brokers con suscripción próxima a vencer
        foreach ($daysToNotify as $days) {
            $targetDate = now()->addDays($days)->startOfDay();
            $endOfDay = $targetDate->copy()->endOfDay();
            
            $brokers = Broker::where('status', 'active')
                ->whereNotNull('subscription_ends_at')
                ->whereBetween('subscription_ends_at', [$targetDate, $endOfDay])
                ->get();
            
            if ($brokers->count() > 0) {
                $this->info("  Brokers con suscripción que vence en {$days} días: {$brokers->count()}");
                
                foreach ($brokers as $broker) {
                    $this->line("    - Broker #{$broker->id}: {$broker->name}");
                    
                    if (!$dryRun) {
                        Log::info('Notificación de vencimiento de broker enviada', [
                            'broker_id' => $broker->id,
                            'broker_name' => $broker->name,
                            'days_remaining' => $days,
                            'expires_at' => $broker->subscription_ends_at,
                        ]);
                    }
                }
            }
        }
    }

    /**
     * Procesar suscripciones que han vencido
     */
    private function processExpiredSubscriptions(bool $dryRun): void
    {
        $this->info("\n--- Procesando Suscripciones Vencidas ---");
        
        // Suscripciones vencidas (tabla subscriptions)
        $expiredSubscriptions = Subscription::where('status', 'active')
            ->whereNotNull('current_period_end')
            ->where('current_period_end', '<', now())
            ->get();
        
        $this->info("Suscripciones vencidas encontradas: {$expiredSubscriptions->count()}");
        
        foreach ($expiredSubscriptions as $subscription) {
            $this->line("  - Suscripción #{$subscription->id} (Venció: {$subscription->current_period_end})");
            
            if (!$dryRun) {
                // Cambiar estado a 'expired'
                $subscription->update(['status' => 'expired']);
                
                // También actualizar el broker asociado
                $broker = Broker::find($subscription->broker_id);
                if ($broker && $broker->status === 'active') {
                    $broker->update(['status' => 'subscription_expired']);
                }
                
                Log::info('Suscripción expirada procesada', [
                    'subscription_id' => $subscription->id,
                    'user_id' => $subscription->user_id,
                    'broker_id' => $subscription->broker_id,
                    'expired_at' => $subscription->current_period_end,
                ]);
            }
        }
        
        // Brokers con suscripción vencida
        $expiredBrokers = Broker::where('status', 'active')
            ->whereNotNull('subscription_ends_at')
            ->where('subscription_ends_at', '<', now())
            ->get();
        
        $this->info("Brokers con suscripción vencida: {$expiredBrokers->count()}");
        
        foreach ($expiredBrokers as $broker) {
            $this->line("  - Broker #{$broker->id}: {$broker->name} (Venció: {$broker->subscription_ends_at})");
            
            if (!$dryRun) {
                $broker->update(['status' => 'subscription_expired']);
                
                Log::info('Broker con suscripción expirada procesado', [
                    'broker_id' => $broker->id,
                    'broker_name' => $broker->name,
                    'expired_at' => $broker->subscription_ends_at,
                ]);
            }
        }
    }

    /**
     * Generar cobros recurrentes para suscripciones activas
     */
    private function generateRecurringCharges(bool $dryRun): void
    {
        $this->info("\n--- Generando Cobros Recurrentes ---");
        
        // Buscar suscripciones que vencen hoy y necesitan renovación
        $today = now()->startOfDay();
        $endOfDay = now()->endOfDay();
        
        $subscriptionsToRenew = Subscription::where('status', 'active')
            ->whereNotNull('current_period_end')
            ->whereBetween('current_period_end', [$today, $endOfDay])
            ->where('auto_renew', true) // Solo las que tienen renovación automática
            ->get();
        
        $this->info("Suscripciones para renovar hoy: {$subscriptionsToRenew->count()}");
        
        foreach ($subscriptionsToRenew as $subscription) {
            $this->line("  - Suscripción #{$subscription->id}");
            
            if (!$dryRun) {
                // Crear una nueva intención de pago para la renovación
                $newIntent = SubscriptionIntent::create([
                    'user_id' => $subscription->user_id,
                    'broker_id' => $subscription->broker_id,
                    'period' => $subscription->period,
                    'users_count' => $subscription->users_count,
                    'storage_gb' => $subscription->storage_gb,
                    'modules' => $subscription->modules,
                    'totals' => $subscription->totals,
                    'status' => 'pending',
                    'is_renewal' => true,
                    'previous_subscription_id' => $subscription->id,
                ]);
                
                Log::info('Intención de renovación creada', [
                    'intent_id' => $newIntent->id,
                    'subscription_id' => $subscription->id,
                    'user_id' => $subscription->user_id,
                    'amount' => $subscription->totals['total'] ?? 0,
                ]);
                
                // TODO: Aquí se podría integrar con pasarela de pago para cobro automático
                // Por ahora solo creamos la intención y el usuario debe pagar manualmente
            }
        }
    }
}
