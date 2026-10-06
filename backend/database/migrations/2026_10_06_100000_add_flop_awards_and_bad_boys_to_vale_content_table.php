<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The Vale gains a flop player of the week, and the single "roughest
     * player" becomes "bad boys of the week" — everyone booked that match
     * day, as [{playerId, yellowCards, redCards}], most cards first.
     */
    public function up(): void
    {
        Schema::table('vale_content', function (Blueprint $table) {
            $table->unsignedInteger('flop_player_id')->nullable()->after('improved_curr_rating');
            $table->text('flop_note')->nullable()->after('flop_player_id');
            $table->json('leader_bad_boys')->nullable()->after('leader_clean_sheet_value');
        });

        foreach (DB::table('vale_content')->whereNotNull('leader_roughest_player_id')->get() as $row) {
            DB::table('vale_content')->where('id', $row->id)->update([
                'leader_bad_boys' => json_encode([[
                    'playerId' => (int) $row->leader_roughest_player_id,
                    'yellowCards' => (int) $row->leader_roughest_yellow,
                    'redCards' => (int) $row->leader_roughest_red,
                ]]),
            ]);
        }

        Schema::table('vale_content', function (Blueprint $table) {
            $table->dropColumn(['leader_roughest_player_id', 'leader_roughest_yellow', 'leader_roughest_red']);
        });
    }

    public function down(): void
    {
        Schema::table('vale_content', function (Blueprint $table) {
            $table->unsignedInteger('leader_roughest_player_id')->nullable();
            $table->unsignedInteger('leader_roughest_yellow')->nullable();
            $table->unsignedInteger('leader_roughest_red')->nullable();
        });

        foreach (DB::table('vale_content')->whereNotNull('leader_bad_boys')->get() as $row) {
            $top = json_decode($row->leader_bad_boys, true)[0] ?? null;
            if ($top) {
                DB::table('vale_content')->where('id', $row->id)->update([
                    'leader_roughest_player_id' => $top['playerId'],
                    'leader_roughest_yellow' => $top['yellowCards'],
                    'leader_roughest_red' => $top['redCards'],
                ]);
            }
        }

        Schema::table('vale_content', function (Blueprint $table) {
            $table->dropColumn(['flop_player_id', 'flop_note', 'leader_bad_boys']);
        });
    }
};
