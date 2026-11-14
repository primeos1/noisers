<?php

namespace Tests\Feature;

use App\Models\FnlEntry;
use App\Models\LeagueResult;
use App\Models\LeagueState;
use App\Models\Player;
use App\Support\Fnl;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FnlTest extends TestCase
{
    use RefreshDatabase;

    private Player $me;

    /** @var array<string, int[]> league player ids by position */
    private array $pool = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(Fnl::deadline(1)->subDay());
        $this->me = Player::factory()->create(['active' => true]);
        $entrants = [];
        foreach (['GK' => 2, 'DEF' => 4, 'MID' => 3, 'FWD' => 4] as $pos => $n) {
            for ($i = 0; $i < $n; $i++) {
                $id = Player::factory()->create()->id;
                $this->pool[$pos][] = $id;
                $entrants[] = ['id' => $id, 'position' => $pos, 'rating' => 6.0];
            }
        }
        LeagueState::current()->update(['draw_entrants' => $entrants]);
    }

    private function auth(): array
    {
        return ['passcode' => 'vale2zenith', 'player_id' => $this->me->id, 'pin' => '1234'];
    }

    /** GK, DEF×3, MID×2, FWD×3: starting GK, 2 DEF, 1 MID, 2 FWD. */
    private function squad(array $swap = []): array
    {
        $p = $this->pool;
        $starters = [$p['GK'][0], $p['DEF'][0], $p['DEF'][1], $p['MID'][0], $p['FWD'][0], $p['FWD'][1]];
        $bench = [$p['DEF'][2], $p['MID'][1], $p['FWD'][2]];
        foreach ($swap as $out => $in) {
            $starters = array_map(fn ($id) => $id === $out ? $in : $id, $starters);
            $bench = array_map(fn ($id) => $id === $out ? $in : $id, $bench);
        }

        return ['starters' => $starters, 'bench' => $bench, 'captain_id' => $starters[4], 'vice_id' => $starters[1]];
    }

    private function signUp(): void
    {
        $this->postJson('/api/fnl/me', $this->auth())->assertOk()->assertJsonPath('data.team', null);
        $this->putJson('/api/fnl/team', $this->auth() + ['name' => 'Lekki Lions'])->assertOk()->assertJsonPath('data.team.name', 'Lekki Lions');
    }

    public function test_a_squad_must_follow_the_shape_and_budget(): void
    {
        $this->signUp();
        $bad = $this->squad();
        $bad['bench'][0] = $this->pool['FWD'][3]; // four forwards, two defenders
        $this->putJson('/api/fnl/entry', $this->auth() + ['gameweek' => 1] + $bad)->assertUnprocessable();

        $this->putJson('/api/fnl/entry', $this->auth() + ['gameweek' => 1] + $this->squad())
            ->assertOk()->assertJsonPath('data.entries.0.transferCost', 0);

        // 9 × 6.0 = 54.0 fits the budget; a pricier squad doesn't.
        LeagueState::current()->update(['draw_entrants' => array_map(fn ($e) => ['rating' => 7.0] + $e, LeagueState::current()->draw_entrants)]);
        $this->putJson('/api/fnl/entry', $this->auth() + ['gameweek' => 1] + $this->squad())->assertUnprocessable()->assertJsonValidationErrors('starters');
    }

    public function test_transfers_after_the_first_gameweek_cost_points_beyond_the_free_one(): void
    {
        $this->signUp();
        $this->putJson('/api/fnl/entry', $this->auth() + ['gameweek' => 1] + $this->squad())->assertOk();
        // Squads stay hidden until the deadline.
        $this->getJson('/api/fnl')->assertJsonCount(0, 'data.entries');

        $this->travelTo(Fnl::deadline(1)->addHour());
        $this->getJson('/api/fnl')->assertJsonPath('data.openGameweek', 2)->assertJsonCount(1, 'data.entries');
        $this->putJson('/api/fnl/entry', $this->auth() + ['gameweek' => 1] + $this->squad())->assertUnprocessable();

        $p = $this->pool;
        $two = $this->squad([$p['DEF'][2] => $p['DEF'][3], $p['FWD'][2] => $p['FWD'][3]]);
        $this->putJson('/api/fnl/entry', $this->auth() + ['gameweek' => 2] + $two)
            ->assertOk()->assertJsonPath('data.entries.1.transfers', 2)->assertJsonPath('data.entries.1.transferCost', 4);

        // A wildcard makes the same changes free, once.
        $this->putJson('/api/fnl/entry', $this->auth() + ['gameweek' => 2, 'chip' => 'wildcard'] + $two)
            ->assertOk()->assertJsonPath('data.entries.1.transferCost', 0);

        // Skipping a week rolls the free transfer over (max 2).
        $this->travelTo(Fnl::deadline(3)->addHour());
        $this->postJson('/api/fnl/me', $this->auth())->assertJsonPath('data.freeTransfers', 2);
    }

    public function test_prices_follow_ownership_from_the_last_gameweek(): void
    {
        $this->signUp();
        $this->putJson('/api/fnl/entry', $this->auth() + ['gameweek' => 1] + $this->squad())->assertOk();
        // Gameweek 1 is still on base prices.
        $this->assertEqualsCanonicalizing([0.0], collect($this->getJson('/api/fnl')->json('data.players'))->pluck('change')->unique()->values()->all());

        $this->travelTo(Fnl::deadline(1)->addHour());
        $players = collect($this->getJson('/api/fnl')->json('data.players'))->keyBy('id');
        $this->assertGreaterThan(0, $players[$this->pool['GK'][0]]['change']); // in the only squad
        $this->assertLessThan(0, $players[$this->pool['GK'][1]]['change']);   // in nobody's
        $this->assertEquals(6.0 + $players[$this->pool['GK'][0]]['change'], $players[$this->pool['GK'][0]]['price']);

        // Keeping a squad that's gone up in value is fine.
        $this->putJson('/api/fnl/entry', $this->auth() + ['gameweek' => 2] + $this->squad())->assertOk();
    }

    public function test_an_early_kick_off_locks_the_gameweek(): void
    {
        $this->signUp();
        LeagueResult::create(['match_no' => 1, 'status' => 'live']);
        $this->putJson('/api/fnl/entry', $this->auth() + ['gameweek' => 1] + $this->squad())->assertUnprocessable();
        $this->assertSame(0, FnlEntry::count());
    }

    public function test_private_leagues_are_joined_by_code(): void
    {
        $this->signUp();
        $code = $this->postJson('/api/fnl/leagues', $this->auth() + ['name' => 'Office'])->assertCreated()->json('data.leagues.0.code');

        $friend = Player::factory()->create(['active' => true]);
        $auth = ['passcode' => 'vale2zenith', 'player_id' => $friend->id, 'pin' => '5555'];
        $this->postJson('/api/fnl/me', $auth)->assertOk();
        $this->putJson('/api/fnl/team', $auth + ['name' => 'Ajah FC'])->assertOk();
        $this->postJson('/api/fnl/leagues/join', $auth + ['code' => 'NOPE00'])->assertUnprocessable();
        $this->postJson('/api/fnl/leagues/join', $auth + ['code' => strtolower($code)])->assertOk()->assertJsonCount(2, 'data.leagues.0.teamIds');
        // Codes stay private to members.
        $this->getJson('/api/fnl')->assertJsonMissingPath('data.leagues.0.code');
    }
}
