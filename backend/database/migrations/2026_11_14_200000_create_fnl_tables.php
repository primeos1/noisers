<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * FNL (Fantasy Noisers League): FPL-style squads of nine per manager,
     * one entry per gameweek (league Sunday) they changed anything in, and
     * private leagues joined by code. Replaces the simple three-pick fantasy.
     */
    public function up(): void
    {
        // Who played, cards and penalties in each league game, for FNL points.
        Schema::table('league_results', function (Blueprint $table) {
            $table->json('events')->nullable();
        });

        Schema::dropIfExists('league_fantasy_picks');

        Schema::create('fnl_teams', function (Blueprint $table) {
            $table->id();
            // The manager: a squad player, signed in with passcode + PIN.
            $table->foreignId('player_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('name', 40);
            $table->timestamps();
        });

        Schema::create('fnl_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fnl_team_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('gameweek');
            $table->json('starters');
            // In auto-sub order.
            $table->json('bench');
            $table->unsignedBigInteger('captain_id');
            $table->unsignedBigInteger('vice_id');
            $table->string('chip', 20)->nullable();
            $table->unsignedTinyInteger('transfers')->default(0);
            $table->unsignedSmallInteger('transfer_cost')->default(0);
            $table->timestamps();
            $table->unique(['fnl_team_id', 'gameweek']);
        });

        Schema::create('fnl_leagues', function (Blueprint $table) {
            $table->id();
            $table->string('name', 40);
            $table->string('code', 8)->unique();
            $table->foreignId('owner_team_id')->constrained('fnl_teams')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('fnl_league_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fnl_league_id')->constrained()->cascadeOnDelete();
            $table->foreignId('fnl_team_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['fnl_league_id', 'fnl_team_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fnl_league_members');
        Schema::dropIfExists('fnl_leagues');
        Schema::dropIfExists('fnl_entries');
        Schema::dropIfExists('fnl_teams');
        Schema::create('league_fantasy_picks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('night');
            $table->json('pick_ids');
            $table->unsignedBigInteger('captain_id');
            $table->timestamps();
            $table->unique(['player_id', 'night']);
        });
        Schema::table('league_results', function (Blueprint $table) {
            $table->dropColumn('events');
        });
    }
};
