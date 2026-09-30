<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const FLAT = [
        'win' => 'rating_win',
        'loss' => 'rating_loss',
        'goal' => 'rating_goal',
        'assist' => 'rating_assist',
        'own_goal' => 'rating_own_goal',
        'yellow_card' => 'rating_yellow_card',
        'red_card' => 'rating_red_card',
    ];

    private const CLEAN_SHEET = [
        'GK' => 'rating_clean_sheet_gk',
        'DEF' => 'rating_clean_sheet_def',
        'MID' => 'rating_clean_sheet_mid',
        'FWD' => 'rating_clean_sheet_fwd',
    ];

    public function up(): void
    {
        // Every rating weight becomes per position (GK/DEF/MID/FWD), stored as
        // JSON. Each position starts from the club's current flat weights, so
        // ratings move exactly as before until an admin tunes a position.
        Schema::table('club_settings', function (Blueprint $table) {
            $table->json('rating_position_weights')->nullable();
        });

        foreach (DB::table('club_settings')->get() as $row) {
            $weights = [];
            foreach (self::CLEAN_SHEET as $position => $column) {
                foreach (self::FLAT as $key => $flat) {
                    $weights[$position][$key] = (float) $row->{$flat};
                }
                $weights[$position]['clean_sheet'] = (float) $row->{$column};
                $weights[$position]['goal_conceded'] = 0.0;
            }
            DB::table('club_settings')->where('id', $row->id)->update(['rating_position_weights' => json_encode($weights)]);
        }

        Schema::table('club_settings', function (Blueprint $table) {
            $table->dropColumn([...array_values(self::FLAT), ...array_values(self::CLEAN_SHEET)]);
        });
    }

    public function down(): void
    {
        $defaults = ['win' => 0.10, 'loss' => 0.10, 'goal' => 0.12, 'assist' => 0.08, 'own_goal' => 0.08, 'yellow_card' => 0.05, 'red_card' => 0.15];
        $cleanSheet = ['GK' => 0.15, 'DEF' => 0.12, 'MID' => 0.05, 'FWD' => 0.0];

        Schema::table('club_settings', function (Blueprint $table) use ($defaults, $cleanSheet) {
            foreach (self::FLAT as $key => $column) {
                $table->decimal($column, 4, 2)->default($defaults[$key]);
            }
            foreach (self::CLEAN_SHEET as $position => $column) {
                $table->decimal($column, 4, 2)->default($cleanSheet[$position]);
            }
        });

        // Flat weights can't hold per-position differences, so take the
        // midfielder's as the closest thing to "everyone".
        foreach (DB::table('club_settings')->get() as $row) {
            $weights = json_decode($row->rating_position_weights ?? 'null', true);
            if (! is_array($weights)) {
                continue;
            }
            $update = [];
            foreach (self::FLAT as $key => $column) {
                $update[$column] = $weights['MID'][$key] ?? $defaults[$key];
            }
            foreach (self::CLEAN_SHEET as $position => $column) {
                $update[$column] = $weights[$position]['clean_sheet'] ?? $cleanSheet[$position];
            }
            DB::table('club_settings')->where('id', $row->id)->update($update);
        }

        Schema::table('club_settings', function (Blueprint $table) {
            $table->dropColumn('rating_position_weights');
        });
    }
};
