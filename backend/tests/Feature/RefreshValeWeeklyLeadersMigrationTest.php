<?php

namespace Tests\Feature;

use App\Models\Player;
use App\Models\User;
use App\Models\ValeContent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RefreshValeWeeklyLeadersMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function playMatchDay(string $id, Player $scorer, Player $other, string $date): void
    {
        $this->postJson('/api/match-day-events', [
            'id' => $id, 'venue' => 'Pitch 2', 'date' => $date, 'status' => 'live',
            'present_players' => [], 'guests' => [], 'groups' => [], 'games' => [],
        ])->assertCreated();
        $this->putJson("/api/match-day-events/{$id}", [
            'status' => 'ended',
            'games' => [[
                'id' => "{$id}-g1", 'status' => 'finished',
                'teams' => [['name' => 'Reds', 'players' => [$scorer->id]], ['name' => 'Blues', 'players' => [$other->id]]],
                'goals' => [['id' => "{$id}-goal1", 'teamIndex' => 0, 'playerId' => $scorer->id]],
                'cards' => [],
            ]],
        ])->assertOk();
    }

    public function test_it_counts_the_saved_leaders_across_the_whole_week(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $scorer = Player::factory()->create(['position' => 'FWD']);
        $other = Player::factory()->create(['position' => 'GK']);

        $this->playMatchDay('md1', $scorer, $other, 'Wed 1 Oct');
        $this->playMatchDay('md2', $scorer, $other, 'Sun 5 Oct');

        // What the old rules saved: the latest match day's stats only.
        ValeContent::current()->update([
            'leader_top_scorer_value' => 1,
            'leader_clean_sheet_value' => 1,
            'potw_note' => 'Set by the committee.',
        ]);

        (require database_path('migrations/2026_10_08_100000_refresh_vale_weekly_leaders.php'))->up();

        $vale = ValeContent::current();
        $this->assertSame($scorer->id, $vale->leader_top_scorer_player_id);
        $this->assertSame(2, $vale->leader_top_scorer_value);
        $this->assertSame('Reds', $vale->leader_clean_sheet_team);
        $this->assertSame(2, $vale->leader_clean_sheet_value);
        // Every other award is left as it was.
        $this->assertSame('Set by the committee.', $vale->potw_note);
    }
}
