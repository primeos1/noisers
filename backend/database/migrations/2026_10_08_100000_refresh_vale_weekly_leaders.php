<?php

use App\Models\ClubSetting;
use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\ValeContent;
use App\Support\MatchDayFinalizer;
use Illuminate\Database\Migrations\Migration;

/**
 * The Vale's stat leaders now count the whole week, not just the match day
 * it shows. Work the saved ones out again across that week, leaving every
 * other award as it is. Left alone when the committee keeps The Vale by hand.
 */
return new class extends Migration
{
    public function up(): void
    {
        $settings = ClubSetting::query()->first();
        $vale = ValeContent::query()->first();
        if (($settings && ! $settings->vale_auto_awards) || ! $vale || $vale->team_week_title === null) {
            return;
        }

        $event = MatchDayEvent::query()
            ->where('title', $vale->team_week_title)
            ->where('date', $vale->team_week_date_range)
            ->first();
        if (! $event) {
            return;
        }

        $fields = MatchDayFinalizer::weeklyAwardFields($event, Player::pluck('id')->all());
        if ($fields !== null) {
            $vale->update(array_intersect_key($fields, array_flip([
                'leader_top_scorer_player_id',
                'leader_top_scorer_value',
                'leader_top_assist_player_id',
                'leader_top_assist_value',
                'leader_top_saves_player_id',
                'leader_top_saves_value',
                'leader_clean_sheet_player_ids',
                'leader_clean_sheet_team',
                'leader_clean_sheet_value',
            ])));
        }
    }

    public function down(): void
    {
        // Data only — nothing to undo.
    }
};
