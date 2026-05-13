<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CommercialTaskResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'broker_id' => $this->broker_id,
            'client_id' => $this->client_id,
            'poliza_id' => $this->poliza_id,
            'assigned_to' => $this->assigned_to,
            'created_by' => $this->created_by,
            'title' => $this->title,
            'description' => $this->description,
            'type' => $this->type,
            'status' => $this->status,
            'priority' => $this->priority,
            'due_date' => $this->due_date?->toISOString(),
            'started_at' => $this->started_at?->toISOString(),
            'completed_at' => $this->completed_at?->toISOString(),
            'scheduled_for' => $this->scheduled_for?->toISOString(),
            'progress_percentage' => $this->progress_percentage,
            'notes' => $this->notes,
            'activity_log' => $this->activity_log,
            'contact_method' => $this->contact_method,
            'contact_phone' => $this->contact_phone,
            'contact_email' => $this->contact_email,
            'contact_notes' => $this->contact_notes,
            'result' => $this->result,
            'next_follow_up' => $this->next_follow_up?->toISOString(),
            'follow_up_notes' => $this->follow_up_notes,
            'has_reminder' => $this->has_reminder,
            'reminder_at' => $this->reminder_at?->toISOString(),
            'reminder_sent' => $this->reminder_sent,
            'attachments' => $this->attachments,
            'external_reference' => $this->external_reference,
            'estimated_duration_minutes' => $this->estimated_duration_minutes,
            'actual_duration_minutes' => $this->actual_duration_minutes,
            'created_at' => $this->created_at->toISOString(),
            'updated_at' => $this->updated_at->toISOString(),
            'deleted_at' => $this->deleted_at?->toISOString(),

            // Relaciones transformadas
            'client' => $this->when($this->relationLoaded('client'), function() {
                if (!$this->client) {
                    // Si el cliente fue eliminado pero tenemos el ID, devolver estructura básica
                    return $this->client_id ? [
                        'id' => $this->client_id,
                        'name' => 'Cliente eliminado (ID: ' . $this->client_id . ')',
                        'document' => 'N/A',
                        'email' => null,
                        'phone' => null,
                    ] : null;
                }
                
                return [
                    'id' => $this->client->id,
                    'name' => trim(($this->client->first_name ?? '') . ' ' . ($this->client->last_name ?? '')),
                    'document' => $this->client->document_number,
                    'email' => $this->client->email,
                    'phone' => $this->client->phone ?? $this->client->mobile_phone,
                ];
            }),

            'poliza' => $this->when($this->relationLoaded('poliza'), function() {
                if (!$this->poliza) {
                    return $this->poliza_id ? [
                        'id' => $this->poliza_id,
                        'numero_poliza' => 'Póliza eliminada (ID: ' . $this->poliza_id . ')',
                        'policy_number' => 'Póliza eliminada (ID: ' . $this->poliza_id . ')',
                        'tipo_seguro' => 'N/A',
                        'type' => 'N/A',
                        'estado' => 'eliminada',
                        'status' => 'eliminada',
                    ] : null;
                }
                
                return [
                    'id' => $this->poliza->id,
                    'numero_poliza' => $this->poliza->policy_number,
                    'policy_number' => $this->poliza->policy_number,
                    'tipo_seguro' => $this->poliza->type,
                    'type' => $this->poliza->type,
                    'estado' => $this->poliza->status,
                    'status' => $this->poliza->status,
                ];
            }),

            'assigned_user' => $this->getAssignedUserData(),

            'creator' => $this->when($this->relationLoaded('creator') && $this->creator, function() {
                return [
                    'id' => $this->creator->id,
                    'name' => $this->creator->name,
                    'email' => $this->creator->email,
                ];
            }),
        ];
    }

    /**
     * Get assigned user data from either users or empleados_broker table
     */
    private function getAssignedUserData(): ?array
    {
        // Si no hay assigned_to, retornar null
        if (!$this->assigned_to) {
            return null;
        }

        \Log::info('🔍 [DEBUG] getAssignedUserData', [
            'task_id' => $this->id,
            'assigned_to' => $this->assigned_to,
            'assignedUser_loaded' => $this->relationLoaded('assignedUser'),
            'assignedUser_exists' => $this->assignedUser ? true : false,
            'assignedEmpleado_loaded' => $this->relationLoaded('assignedEmpleado'),
            'assignedEmpleado_exists' => $this->assignedEmpleado ? true : false,
        ]);

        // Intentar primero con User (solo si pertenece al mismo broker, para evitar colisión de IDs entre brokers)
        if ($this->relationLoaded('assignedUser') && $this->assignedUser
            && $this->assignedUser->broker_id === $this->broker_id) {
            $rawName  = trim((string) ($this->assignedUser->name ?? ''));
            $rawEmail = (string) ($this->assignedUser->email ?? '');

            // Si es shadow user de empleado (email sintético), resolver nombre real
            if (str_ends_with($rawEmail, '@empleado.local')
                && preg_match('/empleado\.(\d+)/i', $rawEmail, $m)) {
                $emp = \App\Models\EmpleadoBroker::where('broker_id', $this->broker_id)
                    ->find((int) $m[1]);
                if ($emp) {
                    $fullName = trim(($emp->nombres ?? '') . ' ' . ($emp->apellidos ?? ''));
                    return [
                        'id'    => $this->assignedUser->id,
                        'name'  => $fullName ?: ($emp->email ?: $rawEmail),
                        'email' => $emp->email ?: $rawEmail,
                    ];
                }
            }

            // Si el nombre es un placeholder genérico, usar email
            $isPlaceholder = $rawName === ''
                || in_array(strtolower($rawName), ['usuario', 'user', 'admin', 'administrador', 'empleado'], true);

            return [
                'id'    => $this->assignedUser->id,
                'name'  => $isPlaceholder ? ($rawEmail ?: ('Usuario ' . $this->assignedUser->id)) : $rawName,
                'email' => $rawEmail,
            ];
        }

        // Intentar con EmpleadoBroker (solo si pertenece al mismo broker)
        if ($this->relationLoaded('assignedEmpleado') && $this->assignedEmpleado
            && $this->assignedEmpleado->broker_id === $this->broker_id) {
            return [
                'id' => $this->assignedEmpleado->id,
                'name' => trim($this->assignedEmpleado->nombres . ' ' . $this->assignedEmpleado->apellidos),
                'email' => $this->assignedEmpleado->email,
            ];
        }

        // Si no se encontró en ninguna tabla
        \Log::warning('🔍 [DEBUG] Usuario asignado no encontrado', [
            'assigned_to' => $this->assigned_to,
        ]);
        return [
            'id' => $this->assigned_to,
            'name' => 'Usuario no encontrado (ID: ' . $this->assigned_to . ')',
            'email' => null,
        ];
    }
}