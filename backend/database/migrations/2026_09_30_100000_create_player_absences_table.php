<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A spell a player is out — injured, travelling, suspended or away for
        // another reason — from starts_on until ends_on (null: no return date yet).
        Schema::create('player_absences', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['injury', 'travel', 'suspension', 'other']);
            $table->string('reason')->nullable();
            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('player_absences');
    }
};
