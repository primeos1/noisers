<?php

use App\Models\ClubSetting;
use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\ValeContent;
use App\Support\MatchDayFinalizer;
use Illuminate\Database\Migrations\Migration;

/**
 * The weekly awards changed shape: weeks are two match days by number, and
 * a week has no team or player of the week until both have ended. The Vale
 * still holds what the old rules saved for the match day it shows, so work
 * its awards out again under the new ones. Left alone when the committee
 * keeps The Vale by hand.
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
