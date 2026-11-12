<?php

namespace Tests\Feature;

use App\Models\LeagueGoal;
use App\Models\LeagueResult;
use App\Models\LeagueState;
use App\Models\Player;
use App\Models\User;
use App\Support\LeagueMatchDaySync;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeagueMatchDaySyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_league_sundays_are_recognised_by_date(): void
    {
        $this->assertSame(1, LeagueMatchDaySync::nightFor('Sun 15 Nov'));
        $this->assertSame(5, LeagueMatchDaySync::nightFor('Sun 13 Dec'));
        $this->assertNull(LeagueMatchDaySync::nightFor('Wed 18 Nov'));
        $this->assertNull(LeagueMatchDaySync::nightFor('Sun 8 Nov'));
        $this->assertSame(range(10, 18), LeagueMatchDaySync::matchNumbers(2));
    }

    public function test_a_league_sunday_feeds_the_league_tables(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $home = Player::factory()->create(['position' => 'FWD']);
        $away = Player::factory()->create(['position' => 'GK']);

        $this->postJson('/api/match-day-events', [
            'id' => 'league-1',
            'date' => 'Sun 15 Nov',
            'status' => 'live',
            'present_players' => [$home->id, $away->id],
            'guests' => [],
            'groups' => [],
            'games' => [],
        ])->assertCreated()->assertJsonPath('data.leagueNight', 1);

        $game = [
            'id' => 'g1',
            'leagueMatchNo' => 1,
            'status' => 'live',
            'teams' => [
                ['name' => 'Home', 'players' => [$home->id]],
                ['name' => 'Away', 'players' => [$away->id, 'guest-1']],
            ],
            'goals' => [
                ['id' => 'a', 'teamIndex' => 0, 'playerId' => $home->id, 'ownGoal' => false, 'minute' => 3],
                ['id' => 'b', 'teamIndex' => 1, 'playerId' => 'guest-1', 'ownGoal' => false, 'minute' => 7],
            ],
            'cards' => [],
            'saves' => [
                ['id' => 's1', 'teamIndex' => 1, 'playerId' => $away->id, 'minute' => 2],
                ['id' => 's2', 'teamIndex' => 1, 'playerId' => $away->id, 'minute' => 5],
            ],
        ];
        $this->putJson('/api/match-day-events/league-1', ['games' => [$game]])->assertOk();

        $result = LeagueResult::where('match_no', 1)->first();
        $this->assertSame('live', $result->status);
        $this->assertEquals([$away->id => 2], $result->saves);
        $this->assertSame(1, LeagueState::current()->live_night);
        $this->assertSame(1, LeagueGoal::where('match_no', 1)->where('side', 'home')->where('player_id', $home->id)->count());
        // A guest's goal still counts, with the scorer unknown.
        $this->assertSame(1, LeagueGoal::where('match_no', 1)->where('side', 'away')->whereNull('player_id')->count());

        $this->putJson('/api/match-day-events/league-1', ['games' => [['status' => 'finished'] + $game], 'status' => 'ended'])->assertOk();
        $this->assertSame('final', LeagueResult::where('match_no', 1)->value('status'));
        $this->assertNull(LeagueState::current()->live_night);
    }

    public function test_a_removed_game_frees_its_fixture_and_other_days_are_ignored(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $game = ['id' => 'g1', 'leagueMatchNo' => 2, 'status' => 'live', 'teams' => [['name' => 'A', 'players' => []], ['name' => 'B', 'players' => []]], 'goals' => [], 'cards' => []];

        $this->postJson('/api/match-day-events', [
            'id' => 'league-1', 'date' => 'Sun 15 Nov', 'status' => 'live', 'present_players' => [], 'guests' => [], 'groups' => [], 'games' => [$game],
        ])->assertCreated();
        $this->assertTrue(LeagueResult::where('match_no', 2)->exists());

        $this->putJson('/api/match-day-events/league-1', ['games' => []])->assertOk();
        $this->assertFalse(LeagueResult::where('match_no', 2)->exists());

        // A Wednesday match day never touches the league, whatever its games say.
        $this->postJson('/api/match-day-events', [
            'id' => 'wed', 'date' => 'Wed 18 Nov', 'status' => 'live', 'present_players' => [], 'guests' => [], 'groups' => [], 'games' => [$game],
        ])->assertCreated()->assertJsonPath('data.leagueNight', null);
        $this->assertFalse(LeagueResult::where('match_no', 2)->exists());
    }
}
