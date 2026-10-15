<?php

use App\Models\ClubSetting;
use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\ValeContent;
use App\Support\MatchDayFinalizer;
use Illuminate\Database\Migrations\Migration;

/**
 * There's no flop team of the week any more — only one per match day — and
 * the flop player of the week is whoever had the worst record across the
 * week's two match days, from the whole squad. Work the saved one out
 * again, leaving every other award as it is. Left alone when the committee
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

        $vale->update(MatchDayFinalizer::flopFields($event, Player::pluck('id')->all()));
    }

    public function down(): void
    {
        // Data only — nothing to undo.
    }
};
