<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyncJob extends Model
{
    protected $table = 'sync_jobs';

    protected $fillable = [
        'batch_id', 'broker_id', 'insurer_code', 'types',
        'status', 'progress', 'error',
        'started_at', 'completed_at',
    ];

    protected $casts = [
        'types' => 'array',
        'progress' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function scopeForBatch($query, string $batchId)
    {
        return $query->where('batch_id', $batchId);
    }

    public function markProcessing(): void
    {
        $this->update(['status' => 'processing', 'started_at' => now()]);
    }

    public function markCompleted(array $progress): void
    {
        $this->update([
            'status' => 'completed',
            'progress' => $progress,
            'completed_at' => now(),
        ]);
    }

    public function markFailed(string $error, ?array $partialProgress = null): void
    {
        $data = [
            'status' => 'failed',
            'error' => $error,
            'completed_at' => now(),
        ];
        if ($partialProgress) {
            $data['progress'] = $partialProgress;
        }
        $this->update($data);
    }

    public function markCancelled(string $reason = 'Sincronización detenida por el usuario.', ?array $partialProgress = null): void
    {
        $data = [
            'status' => 'cancelled',
            'error' => $reason,
            'completed_at' => now(),
        ];
        if ($partialProgress) {
            $data['progress'] = $partialProgress;
        }
        $this->update($data);
    }

    public function updateProgress(array $progress): void
    {
        $this->update(['progress' => $progress]);
    }

    public static function overallStatus(string $batchId): string
    {
        $jobs = static::forBatch($batchId)->get();
        if ($jobs->isEmpty()) return 'not_found';

        $statuses = $jobs->pluck('status');
        $terminal = ['completed', 'failed', 'cancelled'];

        if ($statuses->every(fn($s) => in_array($s, $terminal, true))) {
            if ($statuses->every(fn($s) => $s === 'completed')) return 'completed';
            if ($statuses->every(fn($s) => $s === 'cancelled')) return 'cancelled';
            if ($statuses->every(fn($s) => $s === 'failed')) return 'failed';

            return 'partial';
        }

        if (($statuses->contains('failed') || $statuses->contains('cancelled')) && !$statuses->contains('pending') && !$statuses->contains('processing')) return 'partial';
        if ($statuses->contains('processing') || $statuses->contains('pending')) return 'processing';

        return 'partial';
    }
}
