<?php

use App\Models\ClubSetting;
use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\ValeContent;
use App\Support\MatchDayFinalizer;
use Illuminate\Database\Migrations\Migration;

/**
 * A side's players are now its drawn roster, so a player from another team
 * who stood in for one game no longer counts as one of them — which can
 * change the team of the week picked from the teams of the match day. Work
 * The Vale's awards out again. Left alone when the committee keeps The
 * Vale by hand.
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
            $vale->update($fields);
        }
    }

    public function down(): void
    {
        // Data only — nothing to undo.
    }
};
