<?php

use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Support\MatchDayFinalizer;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The clean-sheet leader is a team (by bib colour), not every player who
     * kept one — store its name and how many clean sheets it kept.
     */
    public function up(): void
    {
        Schema::table('vale_content', function (Blueprint $table) {
            $table->string('leader_clean_sheet_team')->nullable()->after('leader_clean_sheet_player_ids');
            $table->unsignedInteger('leader_clean_sheet_value')->nullable()->after('leader_clean_sheet_team');
        });

        // Re-award the match day The Vale is showing now, so it doesn't sit
        // on the old every-player list until the next match day ends.
        $vale = DB::table('vale_content')->where('id', 1)->first();
        if (! $vale || $vale->team_week_title === null) {
            return;
        }
        $event = MatchDayEvent::query()
            ->where('status', 'ended')
            ->where('title', $vale->team_week_title)
            ->where('date', $vale->team_week_date_range)
            ->orderByDesc('created_at')
            ->first();
        if (! $event) {
            return;
        }
        $team = MatchDayFinalizer::computeCleanSheetTeam($event, Player::pluck('id')->all());
        DB::table('vale_content')->where('id', 1)->update([
            'leader_clean_sheet_team' => $team['name'] ?? null,
            'leader_clean_sheet_value' => $team['value'] ?? 0,
            'leader_clean_sheet_player_ids' => json_encode($team['playerIds'] ?? []),
        ]);
    }

    public function down(): void
    {
        Schema::table('vale_content', function (Blueprint $table) {
            $table->dropColumn(['leader_clean_sheet_team', 'leader_clean_sheet_value']);
        });
    }
};
