<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\User;

class CampaignTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'broker_id',
        'name',
        'content',
        'category',
        'description',
        'variables',
        'variables_list',
        'is_active',
        'is_default',
        'usage_count',
        'created_by',
        'updated_by'
    ];

    protected $casts = [
        'variables' => 'array',
        'variables_list' => 'array',
        'is_active' => 'boolean',
        'is_default' => 'boolean',
        'usage_count' => 'integer'
    ];

    /**
     * Get the broker that owns the template
     */
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    /**
     * Get the user who created the template
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who last updated the template
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Scope for active templates
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope for default templates
     */
    public function scopeDefault($query)
    {
        return $query->where('is_default', true);
    }

    /**
     * Scope for specific category
     */
    public function scopeCategory($query, $category)
    {
        return $query->where('category', $category);
    }

    /**
     * Increment usage count
     */
    public function incrementUsage(): void
    {
        $this->increment('usage_count');
    }

    /**
     * Get variables as array
     */
    public function getVariablesArray(): array
    {
        return $this->variables ?? [];
    }

    /**
     * Get variables list as array
     */
    public function getVariablesList(): array
    {
        return $this->variables_list ?? [];
    }

    /**
     * Extract variables from content
     */
    public function extractVariables(): array
    {
        $matches = [];
        preg_match_all('/\{\{(\w+)\}\}/', $this->content, $matches);
        return array_unique($matches[1] ?? []);
    }

    /**
     * Replace variables in content
     */
    public function replaceVariables(array $data): string
    {
        $content = $this->content;

        foreach ($data as $key => $value) {
            $content = str_replace("{{{$key}}}", $value, $content);
        }

        return $content;
    }

    /**
     * Validate that all required variables are provided
     */
    public function validateVariables(array $data): bool
    {
        $requiredVars = $this->extractVariables();
        $providedVars = array_keys($data);

        return empty(array_diff($requiredVars, $providedVars));
    }

    /**
     * Get sample data for preview
     */
    public function getSampleData(): array
    {
        return [
            'nombre' => 'Juan Pérez',
            'cliente' => 'Juan Pérez',
            'telefono' => '+57 300 123 4567',
            'email' => 'juan.perez@email.com',
            'empresa' => 'Empresa XYZ',
            'poliza' => 'POL-2024-001',
            'fecha' => date('d/m/Y'),
            'monto' => '$1,500,000',
            'aseguradora' => 'Seguros ABC',
            'vencimiento' => date('d/m/Y', strtotime('+30 days')),
            'recordatorio' => 'Recordatorio de pago',
            'promocion' => 'Descuento del 20%',
            'codigo' => 'ABC123',
            'enlace' => 'https://tu-sistema.com/pagar',
            'asesor' => 'María González'
        ];
    }
}
