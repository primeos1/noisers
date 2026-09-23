<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('home_content', function (Blueprint $table) {
            $table->id();
            $table->string('hero_eyebrow')->nullable();
            $table->string('hero_headline')->nullable();
            $table->text('hero_subtext')->nullable();
            $table->string('hero_image_url')->nullable();
            $table->string('story_eyebrow')->nullable();
            $table->string('story_headline')->nullable();
            $table->text('story_paragraph_1')->nullable();
            $table->text('story_paragraph_2')->nullable();
            $table->string('story_image_url')->nullable();
            $table->string('atmosphere_caption')->nullable();
            $table->string('atmosphere_image_url')->nullable();
            $table->string('matchday_eyebrow')->nullable();
            $table->string('matchday_headline')->nullable();
            $table->text('matchday_body')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('home_content');
    }
};
