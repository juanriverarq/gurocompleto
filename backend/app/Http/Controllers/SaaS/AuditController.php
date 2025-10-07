<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class AuditController extends Controller
{
    /**
     * Lista de logs de auditoría (stub para evitar 404/ReflectionException).
     */
    public function getAuditLogs(Request $request)
    {
        $perPage = (int) ($request->query('per_page', 50));
        return response()->json([
            'success' => true,
            'data' => [],
            'pagination' => [
                'current_page' => 1,
                'per_page' => $perPage,
                'total' => 0,
                'last_page' => 1,
            ],
        ]);
    }

    /**
     * Crea un registro de auditoría (stub sin persistencia).
     */
    public function createAuditLog(Request $request)
    {
        return response()->json([
            'success' => true,
            'message' => 'Registro de auditoría recibido (stub).',
            'received' => $request->all(),
        ]);
    }
}