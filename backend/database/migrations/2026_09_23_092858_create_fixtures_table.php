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
        Schema::create('fixtures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('season_id')->constrained()->cascadeOnDelete();
            $table->string('opponent');
            $table->string('competition');
            $table->dateTime('kickoff_at');
            $table->enum('venue', ['Home', 'Away']);
            $table->string('location')->nullable();
            $table->enum('status', ['scheduled', 'completed', 'postponed', 'cancelled'])->default('scheduled');
            $table->unsignedTinyInteger('score_for')->nullable();
            $table->unsignedTinyInteger('score_against')->nullable();
            $table->timestamps();

            $table->index('kickoff_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fixtures');
    }
};
