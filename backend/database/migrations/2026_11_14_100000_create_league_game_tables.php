<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The league's free-to-play games: score predictions per fixture and a
     * three-player fantasy pick per Sunday. Players sign in with the squad
     * passcode plus a personal PIN they set the first time.
     */
    public function up(): void
    {
        Schema::create('league_game_players', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('pin_hash');
            $table->timestamps();
        });

        Schema::create('league_predictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('match_no');
            $table->unsignedTinyInteger('home');
            $table->unsignedTinyInteger('away');
            $table->timestamps();
            $table->unique(['player_id', 'match_no']);
        });

        Schema::create('league_fantasy_picks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('night');
            // The three picked league players, in slot order: GK/DEF, MID, FWD.
            $table->json('pick_ids');
            $table->unsignedBigInteger('captain_id');
            $table->timestamps();
            $table->unique(['player_id', 'night']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('league_fantasy_picks');
        Schema::dropIfExists('league_predictions');
        Schema::dropIfExists('league_game_players');
    }
};
