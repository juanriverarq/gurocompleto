<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogsController extends Controller
{
    public function index(Request $request)
    {
        $query = AuditLog::query();

        // Broker scope (si aplica)
        if ($request->has('broker_id')) {
            $query->where('broker_id', $request->integer('broker_id'));
        }

        // Filtros
        if ($request->filled('module')) $query->where('module', $request->string('module'));
        if ($request->filled('action')) $query->where('action', $request->string('action'));
        if ($request->filled('user_id')) $query->where('user_id', $request->integer('user_id'));
        if ($request->filled('status')) $query->where('response_status', $request->integer('status'));
        if ($request->filled('date_from')) $query->whereDate('created_at', '>=', $request->date('date_from'));
        if ($request->filled('date_to')) $query->whereDate('created_at', '<=', $request->date('date_to'));

        $perPage = (int) $request->get('per_page', 20);
        $logs = $query->orderByDesc('created_at')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $logs,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'broker_id' => 'nullable|integer',
            'user_id' => 'nullable|integer',
            'user_type' => 'nullable|string',
            'action' => 'required|string',
            'module' => 'required|string',
            'ip_address' => 'nullable|string',
            'user_agent' => 'nullable|string',
            'path' => 'nullable|string',
            'method' => 'nullable|string',
            'request_payload' => 'nullable|array',
            'response_status' => 'nullable|integer',
            'metadata' => 'nullable|array',
        ]);

        $log = AuditLog::create($data);

        return response()->json([
            'success' => true,
            'data' => $log,
        ]);
    }
}


