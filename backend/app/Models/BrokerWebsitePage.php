<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BrokerWebsitePage extends Model
{
    use HasFactory;

    protected $fillable = [
        'broker_website_id',
        'slug',
        'title',
        'is_homepage',
        'sort_order',
        'show_in_nav',
        'template_id',
        'template_route',
        'html_content',
        'seo_title',
        'seo_description',
        'seo_keywords',
        'og_image',
        'status',
    ];

    protected $casts = [
        'is_homepage' => 'boolean',
        'show_in_nav' => 'boolean',
    ];

    public function website()
    {
        return $this->belongsTo(BrokerWebsite::class, 'broker_website_id');
    }
}
