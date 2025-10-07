<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\SaaS\SaasPoliza;
use App\Models\SaaS\SaasCliente;
use App\Models\SaaS\BrokerTenant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ValidateMultiTenantSecurity extends Command
{
    protected $signature = 'security:validate-multitenant';
    protected $description = 'Validar la seguridad multi-tenant del sistema GURO';

    public function handle()
    {
        $this->info('🔒 Iniciando validación de seguridad multi-tenant...');
        $this->newLine();

        $errors = 0;
        $warnings = 0;

        // Test 1: Verificar que todos los brokers tienen datos aislados
        $errors += $this->testBrokerIsolation();
        
        // Test 2: Verificar Global Scopes
        $errors += $this->testGlobalScopes();
        
        // Test 3: Verificar que no se puede cambiar broker_id
        $errors += $this->testBrokerIdImmutability();
        
        // Test 4: Verificar que todas las pólizas tienen broker_id
        $errors += $this->testDataIntegrity();
        
        // Test 5: Verificar middleware SaasAuth
        $warnings += $this->testMiddlewareConfiguration();

        // Test 6: Verificar que usuarios MASTER sin brokers no accedan a pólizas
        $errors += $this->testMasterUsersWithoutBrokers() ? 0 : 1;

        $this->newLine();
        
        if ($errors > 0) {
            $this->error("❌ VALIDACIÓN FALLIDA: {$errors} error(es) crítico(s) encontrado(s)");
            $this->error("🚨 EL SISTEMA TIENE VULNERABILIDADES DE SEGURIDAD");
            return 1;
        } elseif ($warnings > 0) {
            $this->warn("⚠️  VALIDACIÓN COMPLETADA: {$warnings} advertencia(s) encontrada(s)");
            $this->info("✅ No se encontraron vulnerabilidades críticas");
            return 0;
        } else {
            $this->info("✅ VALIDACIÓN EXITOSA: Sistema multi-tenant seguro");
            $this->info("🛡️  Todas las verificaciones de seguridad pasaron");
            return 0;
        }
    }

    private function testBrokerIsolation(): int
    {
        $this->info('Test 1: Verificando aislamiento entre brokers...');
        
        $brokers = BrokerTenant::where('estado', 'ACTIVO')->get();
        
        if ($brokers->count() < 2) {
            $this->warn('⚠️  Se necesitan al menos 2 brokers para probar aislamiento');
            return 0;
        }

        $errors = 0;

        foreach ($brokers as $broker) {
            // Contar pólizas sin filtro global scope
            $totalPolizas = SaasPoliza::withoutGlobalScope('broker_filter')->count();
            $polizasBroker = SaasPoliza::withoutGlobalScope('broker_filter')
                ->where('broker_id', $broker->id)
                ->count();

            if ($totalPolizas > 0 && $polizasBroker == $totalPolizas) {
                $this->error("❌ Broker {$broker->nombre} puede ver TODAS las pólizas del sistema");
                $errors++;
            } else {
                $this->info("✅ Broker {$broker->nombre}: {$polizasBroker} pólizas (aislado correctamente)");
            }
        }

        return $errors;
    }

    private function testGlobalScopes(): int
    {
        $this->info('Test 2: Verificando Global Scopes automáticos...');
        
        $errors = 0;

        try {
            // Simular request con broker_id
            app()->instance('request', new \Illuminate\Http\Request());
            $request = app('request');
            $request->merge(['broker_id' => 'test-broker-id']);

            // Verificar que SaasPoliza aplica el scope
            $query = SaasPoliza::toSql();
            if (strpos($query, 'broker_id') === false) {
                $this->error('❌ SaasPoliza no aplica Global Scope automáticamente');
                $errors++;
            } else {
                $this->info('✅ SaasPoliza aplica Global Scope correctamente');
            }

            // Verificar que SaasCliente aplica el scope
            $query = SaasCliente::toSql();
            if (strpos($query, 'broker_id') === false) {
                $this->error('❌ SaasCliente no aplica Global Scope automáticamente');
                $errors++;
            } else {
                $this->info('✅ SaasCliente aplica Global Scope correctamente');
            }

        } catch (\Exception $e) {
            $this->error("❌ Error probando Global Scopes: " . $e->getMessage());
            $errors++;
        }

        return $errors;
    }

    private function testBrokerIdImmutability(): int
    {
        $this->info('Test 3: Verificando inmutabilidad de broker_id...');
        
        $errors = 0;

        try {
            // Buscar una póliza existente
            $poliza = SaasPoliza::withoutGlobalScope('broker_filter')->first();
            
            if ($poliza) {
                $originalBrokerId = $poliza->broker_id;
                
                try {
                    $poliza->broker_id = 'broker-falso';
                    $poliza->save();
                    
                    $this->error('❌ Se pudo cambiar broker_id de póliza - VULNERABILIDAD CRÍTICA');
                    $errors++;
                    
                } catch (\Exception $e) {
                    if (strpos($e->getMessage(), 'No se permite cambiar el broker_id') !== false) {
                        $this->info('✅ broker_id de pólizas está protegido correctamente');
                    } else {
                        $this->error("❌ Error inesperado: " . $e->getMessage());
                        $errors++;
                    }
                }
            } else {
                $this->warn('⚠️  No hay pólizas para probar inmutabilidad');
            }

        } catch (\Exception $e) {
            $this->error("❌ Error probando inmutabilidad: " . $e->getMessage());
            $errors++;
        }

        return $errors;
    }

    private function testDataIntegrity(): int
    {
        $this->info('Test 4: Verificando integridad de datos...');
        
        $errors = 0;

        // Verificar que todas las pólizas tienen broker_id
        $polizasSinBroker = SaasPoliza::withoutGlobalScope('broker_filter')
            ->whereNull('broker_id')
            ->count();

        if ($polizasSinBroker > 0) {
            $this->error("❌ {$polizasSinBroker} póliza(s) sin broker_id - VULNERABILIDAD CRÍTICA");
            $errors++;
        } else {
            $this->info('✅ Todas las pólizas tienen broker_id asignado');
        }

        // Verificar que todas las pólizas tienen broker_id válido
        $polizasBrokerInvalido = SaasPoliza::withoutGlobalScope('broker_filter')
            ->leftJoin('broker_tenants', 'saas_polizas.broker_id', '=', 'broker_tenants.id')
            ->whereNull('broker_tenants.id')
            ->count();

        if ($polizasBrokerInvalido > 0) {
            $this->error("❌ {$polizasBrokerInvalido} póliza(s) con broker_id inválido");
            $errors++;
        } else {
            $this->info('✅ Todas las pólizas tienen broker_id válido');
        }

        // Verificar clientes
        $clientesSinBroker = SaasCliente::withoutGlobalScope('broker_filter')
            ->whereNull('broker_id')
            ->count();

        if ($clientesSinBroker > 0) {
            $this->error("❌ {$clientesSinBroker} cliente(s) sin broker_id - VULNERABILIDAD CRÍTICA");
            $errors++;
        } else {
            $this->info('✅ Todos los clientes tienen broker_id asignado');
        }

        return $errors;
    }

    private function testMiddlewareConfiguration(): int
    {
        $this->info('Test 5: Verificando configuración de middleware...');
        
        $warnings = 0;

        // Verificar que el middleware SaasAuth existe
        $middlewarePath = app_path('Http/Middleware/SaasAuth.php');
        if (!file_exists($middlewarePath)) {
            $this->error('❌ Middleware SaasAuth no encontrado');
            return 1;
        }

        // Verificar que el middleware contiene validaciones críticas
        $middlewareContent = file_get_contents($middlewarePath);
        
        $requiredChecks = [
            'Log::warning' => 'Logs de auditoría',
            'broker_id' => 'Validación de broker_id',
            'request->merge' => 'Inyección de broker_id al request'
        ];

        foreach ($requiredChecks as $check => $description) {
            if (strpos($middlewareContent, $check) === false) {
                $this->warn("⚠️  {$description} no encontrado en middleware");
                $warnings++;
            } else {
                $this->info("✅ {$description} configurado correctamente");
            }
        }

        return $warnings;
    }

    /**
     * Verificar que usuarios MASTER sin brokers no puedan acceder a pólizas
     */
    private function testMasterUsersWithoutBrokers(): bool
    {
        $this->info('Test 6: Verificando que usuarios MASTER sin brokers no accedan a pólizas...');
        
        // Obtener usuarios MASTER sin brokers
        $mastersWithoutBrokers = \App\Models\User::where('tipo_usuario', 'MASTER')
            ->whereDoesntHave('brokers', function($query) {
                $query->where('estado', 'ACTIVO');
            })
            ->get();
        
        if ($mastersWithoutBrokers->isEmpty()) {
            $this->info('✅ No hay usuarios MASTER sin brokers activos');
            return true;
        }
        
        $this->warn("⚠️  Encontrados {$mastersWithoutBrokers->count()} usuarios MASTER sin brokers activos:");
        
        foreach ($mastersWithoutBrokers as $user) {
            $this->warn("   - {$user->name} ({$user->email}) - ID: {$user->id}");
        }
        
        // Simular request de API sin broker_id (como si fuera un usuario sin broker)
        $request = \Illuminate\Http\Request::create('/api/saas/polizas', 'GET');
        app()->instance('request', $request);
        
        // Probar que no puedan acceder a pólizas
        $polizasCount = \App\Models\SaaS\SaasPoliza::count();
        
        if ($polizasCount > 0) {
            $this->error("❌ PROBLEMA CRÍTICO: Usuarios sin broker pueden ver {$polizasCount} pólizas");
            return false;
        }
        
        $this->info('✅ Global Scope bloquea correctamente a usuarios sin broker');
        return true;
    }
} 