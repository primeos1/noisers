<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('match_day_events', function (Blueprint $table) {
            // String primary key so the frontend's existing client-generated
            // slug ids (see matchDay.ts's slugify/uniqueEventId) keep working
            // unchanged — the id doesn't need to change shape to move server-side.
            $table->string('id')->primary();
            $table->string('title');
            $table->string('venue')->nullable();
            $table->string('date');
            $table->enum('status', ['live', 'ended'])->default('live');
            $table->json('present_players');
            $table->json('guests');
            $table->json('groups');
            $table->json('games');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('match_day_events');
    }
};
