<?php

namespace App\Services;

use Kreait\Firebase\Contract\Auth as FirebaseAuthContract;
use App\Models\EmpleadoBroker;

class FirebaseCustomTokenService
{
    public function __construct(private FirebaseAuthContract $firebaseAuth)
    {
    }

    /**
     * Genera un Firebase Custom Token para un empleado
     */
    public function createForEmpleado(EmpleadoBroker $empleado): string
    {
        $uid = 'empleado:' . $empleado->id;
        $claims = [
            'user_type' => 'EMPLEADO',
            'empleado_id' => $empleado->id,
            'broker_id' => $empleado->broker_id,
        ];

        return $this->firebaseAuth->createCustomToken($uid, $claims)->toString();
    }
}


