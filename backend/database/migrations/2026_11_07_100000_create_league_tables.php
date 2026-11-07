<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The Noisers League (league.noisersfc.com). Its own tables, so nothing
     * here touches club match days, ratings or the Vale.
     */
    public function up(): void
    {
        // One row: who's in, the sealed draw, and which Sunday is live.
        Schema::create('league_state', function (Blueprint $table) {
            $table->id();
            // Squad player ids marked present for the league.
            $table->json('entrant_ids')->nullable();
            // Entrants who play in goal for the league, whatever their squad position.
            $table->json('keeper_ids')->nullable();
            // The draw: the seed stays secret until starts_at, only its
            // SHA-256 is public before that (commit, then reveal).
            $table->text('draw_seed')->nullable();
            $table->string('draw_hash', 64)->nullable();
            $table->timestamp('draw_starts_at')->nullable();
            $table->float('draw_speed')->default(1);
            // The players the draw runs on, frozen when it was sealed.
            $table->json('draw_entrants')->nullable();
            // The Sunday (1-5) the admin has started, null when no match day is on.
            $table->unsignedTinyInteger('live_night')->nullable();
            $table->timestamps();
        });

        // CP Odogwu (id 47, a defender who also keeps) is a keeper for the league.
        DB::table('league_state')->insert(['id' => 1, 'keeper_ids' => json_encode([47]), 'draw_speed' => 1, 'created_at' => now(), 'updated_at' => now()]);

        // Status of each of the 45 fixtures, by their number in the schedule.
        // Scores come from league_goals, so the two can never disagree.
        Schema::create('league_results', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('match_no')->unique();
            $table->enum('status', ['scheduled', 'live', 'final'])->default('scheduled');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });

        Schema::create('league_goals', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('match_no')->index();
            // The side the goal counts for.
            $table->enum('side', ['home', 'away']);
            $table->foreignId('player_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('assist_player_id')->nullable()->constrained('players')->nullOnDelete();
            $table->boolean('own_goal')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('league_goals');
        Schema::dropIfExists('league_results');
        Schema::dropIfExists('league_state');
    }
};
