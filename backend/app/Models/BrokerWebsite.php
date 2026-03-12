<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BrokerWebsite extends Model
{
    use HasFactory;

    protected $fillable = [
        'broker_id',
        'slug',
        'custom_domain',
        'site_title',
        'site_description',
        'favicon_url',
        'og_image_url',
        'google_analytics_id',
        'template_id',
        'template_route',
        'html_content',
        'settings',
        'status',
        'published_at',
    ];

    protected $casts = [
        'settings' => 'array',
        'published_at' => 'datetime',
    ];

    public function broker()
    {
        return $this->belongsTo(Broker::class);
    }

    public function pages()
    {
        return $this->hasMany(BrokerWebsitePage::class)->orderBy('sort_order');
    }
}
