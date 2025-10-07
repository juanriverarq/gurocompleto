<?php

namespace App\Traits;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\AuthService;

trait RequiresAuth
{
    /**
     * Obtener el usuario autenticado usando AuthService
     */
    protected function getAuthenticatedUser(Request $request)
    {
        return AuthService::getAuthenticatedUser($request);
    }
    
    /**
     * Obtener el broker_id del usuario autenticado
     */
    protected function getBrokerId(Request $request): ?int
    {
        return AuthService::getBrokerId($request);
    }
    
    /**
     * Obtener el broker completo del usuario autenticado
     */
    protected function getBroker(Request $request)
    {
        return AuthService::getBroker($request);
    }
    
    /**
     * Validar autenticación y devolver respuesta de error si falla
     */
    protected function validateAuthOrFail(Request $request): ?JsonResponse
    {
        $validation = AuthService::validateAuth($request);
        
        if (!$validation['success']) {
            if ($validation['code'] === 401) {
                return AuthService::unauthorizedResponse($validation['message']);
            } else {
                return AuthService::noBrokerResponse();
            }
        }
        
        return null; // Auth válida, continuar
    }
    
    /**
     * Wrapper común para métodos que requieren autenticación
     */
    protected function executeWithAuth(Request $request, callable $callback)
    {
        // Validar autenticación
        $authError = $this->validateAuthOrFail($request);
        if ($authError) {
            return $authError;
        }
        
        // Obtener datos de autenticación
        $user = $this->getAuthenticatedUser($request);
        $brokerId = $this->getBrokerId($request);
        $broker = $this->getBroker($request);
        
        // Ejecutar callback con datos de autenticación
        return $callback($user, $brokerId, $broker);
    }
}
