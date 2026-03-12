<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('broker_websites', function (Blueprint $table) {
            $table->string('slug', 80)->nullable()->unique()->after('broker_id');
            $table->string('custom_domain', 255)->nullable()->after('slug');
            $table->string('site_title', 255)->nullable()->after('custom_domain');
            $table->string('site_description', 500)->nullable()->after('site_title');
            $table->string('favicon_url', 500)->nullable()->after('site_description');
            $table->string('og_image_url', 500)->nullable()->after('favicon_url');
            $table->string('google_analytics_id', 50)->nullable()->after('og_image_url');
        });

        Schema::create('broker_website_pages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_website_id');
            $table->string('slug', 80)->default('home');
            $table->string('title', 255);
            $table->boolean('is_homepage')->default(false);
            $table->integer('sort_order')->default(0);
            $table->boolean('show_in_nav')->default(true);
            $table->string('template_id', 50)->nullable();
            $table->string('template_route', 255)->nullable();
            $table->longText('html_content')->nullable();
            $table->string('seo_title', 255)->nullable();
            $table->string('seo_description', 500)->nullable();
            $table->string('seo_keywords', 500)->nullable();
            $table->string('og_image', 500)->nullable();
            $table->enum('status', ['draft', 'published'])->default('draft');
            $table->timestamps();

            $table->foreign('broker_website_id')->references('id')->on('broker_websites')->onDelete('cascade');
            $table->unique(['broker_website_id', 'slug']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('broker_website_pages');

        Schema::table('broker_websites', function (Blueprint $table) {
            $table->dropColumn(['slug', 'custom_domain', 'site_title', 'site_description', 'favicon_url', 'og_image_url', 'google_analytics_id']);
        });
    }
};
