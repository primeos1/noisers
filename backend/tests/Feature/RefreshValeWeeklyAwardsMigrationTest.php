<?php

namespace Tests\Feature;

use App\Models\Player;
use App\Models\User;
use App\Models\ValeContent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RefreshValeWeeklyAwardsMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_clears_a_week_saved_before_both_its_match_days_had_ended(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $scorer = Player::factory()->create(['position' => 'FWD']);
        $other = Player::factory()->create(['position' => 'FWD']);

        $this->postJson('/api/match-day-events', [
            'id' => 'md1', 'venue' => 'Pitch 2', 'date' => 'Sun 4 Oct', 'status' => 'live',
            'present_players' => [], 'guests' => [], 'groups' => [], 'games' => [],
        ])->assertCreated();
        $this->putJson('/api/match-day-events/md1', [
            'status' => 'ended',
            'games' => [[
                'id' => 'g1', 'status' => 'finished',
                'teams' => [['name' => 'Reds', 'players' => [$scorer->id]], ['name' => 'Blues', 'players' => [$other->id]]],
                'goals' => [['id' => 'goal1', 'teamIndex' => 0, 'playerId' => $scorer->id]],
                'cards' => [],
            ]],
        ])->assertOk();

        // What the old rules saved: a team and player of the week after one match day.
        ValeContent::current()->update([
            'team_lineup_player_ids' => [$scorer->id, $other->id],
            'potw_player_id' => $scorer->id,
            'potw_note' => '1 goal and 0 assists across 1 game at Matchday 1.',
        ]);

        (require database_path('migrations/2026_10_07_150000_refresh_vale_weekly_awards.php'))->up();

        $vale = ValeContent::current();
        $this->assertSame([], $vale->team_lineup_player_ids);
        $this->assertNull($vale->potw_player_id);
        $this->assertNull($vale->potw_note);
        // The rest of the match day's awards are untouched.
        $this->assertSame('Matchday 1', $vale->team_week_title);
        $this->assertSame($scorer->id, $vale->leader_top_scorer_player_id);
    }
}
