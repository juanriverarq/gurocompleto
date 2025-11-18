<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Poliza;
use App\Models\Anexo;

class AnexosController extends Controller
{
    private function getBrokerId(Request $request)
    {
        if ($request->has('authenticated_broker_id')) return (int)$request->get('authenticated_broker_id');
        $user = $request->user() ?: Auth::user();
        if ($user && $user->broker_id) return (int)$user->broker_id;
        throw new \Exception('Usuario no autenticado o sin broker asignado');
    }

    public function index(Request $request, int $polizaId)
    {
        $brokerId = $this->getBrokerId($request);
        $poliza = Poliza::where('broker_id', $brokerId)->find($polizaId);
        if (!$poliza) return response()->json(['success'=>false,'message'=>'Póliza no encontrada'],404);

        $anexos = Anexo::where('broker_id',$brokerId)->where('poliza_id',$poliza->id)->orderByDesc('created_at')->get();
        return response()->json(['success'=>true,'data'=>$anexos]);
    }

    public function store(Request $request, int $polizaId)
    {
        $brokerId = $this->getBrokerId($request);
        $poliza = Poliza::where('broker_id', $brokerId)->find($polizaId);
        if (!$poliza) return response()->json(['success'=>false,'message'=>'Póliza no encontrada'],404);

        $validated = $request->validate([
            // Requeridos mínimos
            'anexo' => 'required|string|max:255',
            'estado' => 'required|in:ACTIVA,VENCIDA,CANCELADA,SUSPENDIDA,PENDIENTE',
            'fecha_expedicion' => 'required|date',
            'fecha_inicio' => 'required|date',
            'fecha_fin' => 'required|date|after_or_equal:fecha_inicio',

            // Opcionales
            'aseguradora' => 'nullable|string|max:255',
            'ramo' => 'nullable|string|max:255',
            'riesgo' => 'nullable|string|max:1000',
            'fawf' => 'nullable|string|max:255',
            'renovable' => 'nullable|boolean',
            'motivo' => 'nullable|string|max:500',
            'fecha_recepcion' => 'nullable|date',
            'prima' => 'nullable|numeric|min:0',
            'porcentaje_iva' => 'nullable|numeric|min:0|max:100',
            'pri_a_pre' => 'nullable|numeric|min:0',
            'iva' => 'nullable|numeric|min:0',
            'porcentaje_comision' => 'nullable|numeric|min:0|max:100',
            'comision' => 'nullable|numeric|min:0',
            'total' => 'nullable|numeric|min:0',
            'periodicidad_pago' => 'nullable|string|in:mensual,trimestral,semestral,anual',
            'forma_pago' => 'nullable|string|in:efectivo,transferencia,cheque,tarjeta,financiacion',
            'observaciones' => 'nullable|string',
            'accesorios' => 'nullable|string',
        ]);

        $anexo = Anexo::create([
            'broker_id' => $brokerId,
            'poliza_id' => $poliza->id,
            'anexo_number' => $validated['anexo'],
            'risk' => $validated['riesgo'] ?? '',
            'insurance_company' => $validated['aseguradora'] ?? $poliza->insurance_company,
            'branch' => $validated['ramo'] ?? $poliza->type,
            'issue_date' => $validated['fecha_expedicion'] ?? null,
            'start_date' => $validated['fecha_inicio'],
            'end_date' => $validated['fecha_fin'],
            'reception_date' => $validated['fecha_recepcion'] ?? null,
            'renewable' => (bool)($validated['renovable'] ?? false),
            'prima_neta' => $validated['prima'] ?? 0,
            'vat_percentage' => $validated['porcentaje_iva'] ?? null,
            'pri_a_pre' => $validated['pri_a_pre'] ?? null,
            'gastos_expedicion' => $validated['gastos_expedicion'] ?? null,
            'iva' => $validated['iva'] ?? 0,
            'commission_percentage' => $validated['porcentaje_comision'] ?? null,
            'commission_amount' => $validated['comision'] ?? null,
            'total_amount' => $validated['total'] ?? null,
            'payment_frequency' => isset($validated['periodicidad_pago']) ? $this->mapPaymentFrequencyFromFrontend($validated['periodicidad_pago']) : null,
            'payment_method' => isset($validated['forma_pago']) ? $this->mapPaymentMethodFromFrontend($validated['forma_pago']) : null,
            'observaciones' => $validated['observaciones'] ?? null,
            'accesorios' => $validated['accesorios'] ?? null,
            'motivo' => $validated['motivo'] ?? null,
            'fawf' => $validated['fawf'] ?? null,
            'status' => $validated['estado'],
            'created_by' => Auth::id(),
        ]);

        return response()->json(['success'=>true,'message'=>'Anexo creado','data'=>$anexo],201);
    }

    public function update(Request $request, int $polizaId, int $anexoId)
    {
        $brokerId = $this->getBrokerId($request);
        $poliza = Poliza::where('broker_id', $brokerId)->find($polizaId);
        if (!$poliza) return response()->json(['success'=>false,'message'=>'Póliza no encontrada'],404);
        $anexo = Anexo::where('broker_id',$brokerId)->where('poliza_id',$poliza->id)->find($anexoId);
        if (!$anexo) return response()->json(['success'=>false,'message'=>'Anexo no encontrado'],404);

        $validated = $request->validate([
            'aseguradora' => 'sometimes|nullable|string|max:255',
            'ramo' => 'sometimes|nullable|string|max:255',
            'anexo' => 'sometimes|required|string|max:255',
            'riesgo' => 'sometimes|nullable|string|max:1000',
            'fawf' => 'nullable|string|max:255',
            'motivo' => 'nullable|string|max:500',
            'fecha_expedicion' => 'sometimes|required|date',
            'fecha_inicio' => 'sometimes|required|date',
            'fecha_fin' => 'sometimes|required|date|after_or_equal:fecha_inicio',
            'fecha_recepcion' => 'nullable|date',
            'renovable' => 'nullable|boolean',
            'prima' => 'nullable|numeric|min:0',
            'porcentaje_iva' => 'nullable|numeric|min:0|max:100',
            'pri_a_pre' => 'nullable|numeric|min:0',
            'iva' => 'nullable|numeric|min:0',
            'porcentaje_comision' => 'nullable|numeric|min:0|max:100',
            'comision' => 'nullable|numeric|min:0',
            'total' => 'nullable|numeric|min:0',
            'periodicidad_pago' => 'nullable|string|in:mensual,trimestral,semestral,anual',
            'forma_pago' => 'nullable|string|in:efectivo,transferencia,cheque,tarjeta,financiacion',
            'observaciones' => 'nullable|string',
            'accesorios' => 'nullable|string',
            'estado' => 'sometimes|required|in:ACTIVA,VENCIDA,CANCELADA,SUSPENDIDA,PENDIENTE',
        ]);

        $anexo->update([
            'anexo_number' => $validated['anexo'] ?? $anexo->anexo_number,
            'risk' => $validated['riesgo'] ?? $anexo->risk,
            'insurance_company' => $validated['aseguradora'] ?? $anexo->insurance_company,
            'branch' => $validated['ramo'] ?? $anexo->branch,
            'issue_date' => $validated['fecha_expedicion'] ?? $anexo->issue_date,
            'start_date' => $validated['fecha_inicio'] ?? $anexo->start_date,
            'end_date' => $validated['fecha_fin'] ?? $anexo->end_date,
            'reception_date' => $validated['fecha_recepcion'] ?? $anexo->reception_date,
            'renewable' => array_key_exists('renovable', $validated) ? (bool)$validated['renovable'] : $anexo->renewable,
            'prima_neta' => isset($validated['prima']) ? $validated['prima'] : ($anexo->prima_neta ?? 0),
            'vat_percentage' => $validated['porcentaje_iva'] ?? $anexo->vat_percentage,
            'pri_a_pre' => $validated['pri_a_pre'] ?? $anexo->pri_a_pre,
            'gastos_expedicion' => $validated['gastos_expedicion'] ?? $anexo->gastos_expedicion,
            'iva' => isset($validated['iva']) ? $validated['iva'] : ($anexo->iva ?? 0),
            'commission_percentage' => $validated['porcentaje_comision'] ?? $anexo->commission_percentage,
            'commission_amount' => $validated['comision'] ?? $anexo->commission_amount,
            'total_amount' => $validated['total'] ?? $anexo->total_amount,
            'payment_frequency' => isset($validated['periodicidad_pago']) ? $this->mapPaymentFrequencyFromFrontend($validated['periodicidad_pago']) : $anexo->payment_frequency,
            'payment_method' => isset($validated['forma_pago']) ? $this->mapPaymentMethodFromFrontend($validated['forma_pago']) : $anexo->payment_method,
            'observaciones' => $validated['observaciones'] ?? $anexo->observaciones,
            'accesorios' => $validated['accesorios'] ?? $anexo->accesorios,
            'motivo' => $validated['motivo'] ?? $anexo->motivo,
            'fawf' => $validated['fawf'] ?? $anexo->fawf,
            'status' => $validated['estado'] ?? $anexo->status,
            'updated_by' => Auth::id(),
        ]);

        return response()->json(['success'=>true,'message'=>'Anexo actualizado','data'=>$anexo]);
    }

    private function mapPaymentFrequencyFromFrontend(?string $frequency): ?string
    {
        if (!$frequency) return null;
        $mapping = [
            'mensual' => 'monthly',
            'trimestral' => 'quarterly',
            'semestral' => 'biannual',
            'anual' => 'annual',
        ];
        $key = strtolower($frequency);
        return $mapping[$key] ?? null;
    }

    private function mapPaymentMethodFromFrontend(?string $method): ?string
    {
        if (!$method) return null;
        $mapping = [
            'efectivo' => 'cash',
            'transferencia' => 'transfer',
            'cheque' => 'check',
            'tarjeta' => 'card',
            'financiacion' => 'financing',
        ];
        $key = strtolower($method);
        return $mapping[$key] ?? null;
    }

    public function destroy(Request $request, int $polizaId, int $anexoId)
    {
        $brokerId = $this->getBrokerId($request);
        $poliza = Poliza::where('broker_id', $brokerId)->find($polizaId);
        if (!$poliza) return response()->json(['success'=>false,'message'=>'Póliza no encontrada'],404);
        $anexo = Anexo::where('broker_id',$brokerId)->where('poliza_id',$poliza->id)->find($anexoId);
        if (!$anexo) return response()->json(['success'=>false,'message'=>'Anexo no encontrado'],404);

        $anexo->delete();
        return response()->json(['success'=>true,'message'=>'Anexo eliminado']);
    }

    /**
     * Upload documents to anexo (stores in anexo.documents JSON field and poliza.documents)
     */
    public function uploadDocuments(Request $request, int $polizaId, int $anexoId)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $poliza = Poliza::where('broker_id', $brokerId)->find($polizaId);
            if (!$poliza) return response()->json(['success'=>false,'message'=>'Póliza no encontrada'],404);
            
            $anexo = Anexo::where('broker_id',$brokerId)->where('poliza_id',$poliza->id)->find($anexoId);
            if (!$anexo) return response()->json(['success'=>false,'message'=>'Anexo no encontrado'],404);

            $request->validate([
                'files' => 'required|array',
                'files.*' => 'file|max:20480', // 20MB
            ]);

            // Usar el controlador de documentos de pólizas para subir a Firebase
            $polizaDocsController = app(\App\Http\Controllers\SaaS\PolizaDocumentsController::class);
            
            // Crear un request temporal con los archivos
            $uploadRequest = new Request();
            $uploadRequest->files->set('files', $request->file('files'));
            $uploadRequest->merge(['type' => 'anexo']);
            $uploadRequest->setUserResolver($request->getUserResolver());
            $uploadRequest->merge(['authenticated_broker_id' => $brokerId]);
            
            // Subir archivos usando el controlador de documentos de pólizas
            $uploadResponse = $polizaDocsController->upload($uploadRequest, $polizaId);
            $uploadData = json_decode($uploadResponse->getContent(), true);
            
            if (!$uploadData['success']) {
                return response()->json(['success'=>false,'message'=>'Error al subir archivos'],500);
            }

            // Agregar los archivos al anexo también
            $existingDocs = $anexo->documents ?? [];
            if (!is_array($existingDocs)) {
                $existingDocs = [];
            }
            
            $newDocs = $uploadData['data'] ?? [];
            foreach ($newDocs as &$doc) {
                $doc['anexo_id'] = $anexoId;
                $doc['anexo_number'] = $anexo->anexo_number;
            }
            
            $anexo->documents = array_values(array_merge($existingDocs, $newDocs));
            $anexo->save();

            return response()->json([
                'success'=>true,
                'message'=>'Archivos subidos exitosamente',
                'data'=>$newDocs
            ]);

        } catch (\Exception $e) {
            \Log::error('Error uploading anexo documents', [
                'poliza_id' => $polizaId,
                'anexo_id' => $anexoId,
                'error' => $e->getMessage()
            ]);
            return response()->json(['success'=>false,'message'=>'Error al subir archivos: '.$e->getMessage()],500);
        }
    }
}


