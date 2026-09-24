<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Defaults match the values previously hardcoded in useMatchTimer.ts,
        // PlayerRatings and MatchDayFinalizer, so behaviour is unchanged
        // until an admin edits them.
        Schema::table('club_settings', function (Blueprint $table) {
            $table->boolean('fines_from_match_day')->default(true);

            $table->unsignedTinyInteger('match_game_minutes')->default(10);
            $table->string('match_default_team_mode')->default('random');
            $table->string('match_default_venue')->nullable();

            $table->boolean('ratings_enabled')->default(true);
            $table->decimal('rating_new_player', 4, 2)->default(6.0);
            $table->decimal('rating_win', 4, 2)->default(0.10);
            $table->decimal('rating_loss', 4, 2)->default(0.10);
            $table->decimal('rating_goal', 4, 2)->default(0.12);
            $table->decimal('rating_assist', 4, 2)->default(0.08);
            $table->decimal('rating_own_goal', 4, 2)->default(0.08);
            $table->decimal('rating_clean_sheet_gk', 4, 2)->default(0.15);
            $table->decimal('rating_clean_sheet_def', 4, 2)->default(0.12);
            $table->decimal('rating_clean_sheet_mid', 4, 2)->default(0.05);
            $table->decimal('rating_clean_sheet_fwd', 4, 2)->default(0.0);
            $table->decimal('rating_max_swing', 4, 2)->default(0.5);

            $table->boolean('vale_auto_awards')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('club_settings', function (Blueprint $table) {
            $table->dropColumn([
                'fines_from_match_day',
                'match_game_minutes',
                'match_default_team_mode',
                'match_default_venue',
                'ratings_enabled',
                'rating_new_player',
                'rating_win',
                'rating_loss',
                'rating_goal',
                'rating_assist',
                'rating_own_goal',
                'rating_clean_sheet_gk',
                'rating_clean_sheet_def',
                'rating_clean_sheet_mid',
                'rating_clean_sheet_fwd',
                'rating_max_swing',
                'vale_auto_awards',
            ]);
        });
    }
};
