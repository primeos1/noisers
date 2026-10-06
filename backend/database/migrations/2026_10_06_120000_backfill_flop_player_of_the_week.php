<?php

use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\ValeContent;
use App\Support\MatchDayFinalizer;
use Illuminate\Database\Migrations\Migration;

/**
 * The flop player of the week used to be left empty when nobody lost (e.g.
 * a day of draws). Now there's always one, so fill it in for the match day
 * The Vale is showing — only where it's still empty, never over a pick.
 */
return new class extends Migration
{
    public function up(): void
    {
        $vale = ValeContent::query()->first();
        if (! $vale || $vale->flop_player_id !== null || $vale->team_week_title === null) {
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
