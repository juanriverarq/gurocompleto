<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UploadCsv extends Model
{
    protected $table = 'uploads_csv';

    protected $guarded = [];

    protected $casts = [
        'detected_columns' => 'array',
        'mapping' => 'array',
        'sample_rows' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}