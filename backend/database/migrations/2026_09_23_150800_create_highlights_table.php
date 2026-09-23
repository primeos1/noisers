<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('highlights', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['photo', 'video'])->default('photo');
            $table->string('media_url');
            $table->string('alt')->nullable();
            $table->string('caption')->nullable();
            $table->enum('category', ['Goals', 'Saves', 'Skills', 'Matchday', 'Behind the scenes']);
            $table->date('occurred_on')->nullable();
            $table->boolean('tall')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('highlights');
    }
};
