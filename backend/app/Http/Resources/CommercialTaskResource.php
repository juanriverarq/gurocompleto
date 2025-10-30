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

        // Intentar primero con User
        if ($this->relationLoaded('assignedUser') && $this->assignedUser) {
            return [
                'id' => $this->assignedUser->id,
                'name' => $this->assignedUser->name,
                'email' => $this->assignedUser->email,
            ];
        }

        // Intentar con EmpleadoBroker
        if ($this->relationLoaded('assignedEmpleado') && $this->assignedEmpleado) {
            return [
                'id' => $this->assignedEmpleado->id,
                'name' => trim($this->assignedEmpleado->nombres . ' ' . $this->assignedEmpleado->apellidos),
                'email' => $this->assignedEmpleado->email,
            ];
        }

        // Si no se encontró en ninguna tabla
        return [
            'id' => $this->assigned_to,
            'name' => 'Usuario no encontrado (ID: ' . $this->assigned_to . ')',
            'email' => null,
        ];
    }
}