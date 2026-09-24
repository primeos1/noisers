<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The "Club in numbers" band under the hero: its copy, background
        // photo, and which live (computed) stats it shows alongside the
        // custom tiles in home_stats.
        Schema::table('home_content', function (Blueprint $table) {
            $table->boolean('stats_enabled')->default(true);
            $table->string('stats_eyebrow')->nullable();
            $table->string('stats_headline')->nullable();
            $table->string('stats_image_url', 2048)->nullable();
            $table->json('stats_live')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('home_content', function (Blueprint $table) {
            $table->dropColumn(['stats_enabled', 'stats_eyebrow', 'stats_headline', 'stats_image_url', 'stats_live']);
        });
    }
};
