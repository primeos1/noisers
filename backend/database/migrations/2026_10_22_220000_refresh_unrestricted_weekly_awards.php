<?php

use App\Models\ClubSetting;
use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\ValeContent;
use App\Support\MatchDayFinalizer;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $vale = ValeContent::query()->first();
        if (! $vale || ! ClubSetting::current()->vale_auto_awards || $vale->team_week_title === null) {
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
            // Refresh the weekly team and player using all eligible participants.
            $vale->update(array_intersect_key($fields, array_flip(['team_lineup_player_ids', 'potw_player_id', 'potw_note', 'potw_rating'])));
        }
    }

    public function down(): void
    {
        // Data correction only.
    }
};