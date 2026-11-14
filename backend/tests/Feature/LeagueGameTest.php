<?php

namespace Tests\Feature;

use App\Models\LeagueResult;
use App\Models\LeagueState;
use App\Models\Player;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeagueGameTest extends TestCase
{
    use RefreshDatabase;

    private Player $me;

    /** @var int[] */
    private array $squad;

    protected function setUp(): void
    {
        parent::setUp();
        $this->me = Player::factory()->create(['active' => true]);
        $this->squad = Player::factory()->count(3)->create()->pluck('id')->all();
        LeagueState::current()->update(['draw_entrants' => array_map(fn ($id) => ['id' => $id], $this->squad)]);
    }

    private function auth(string $pin = '1234'): array
    {
        return ['passcode' => 'vale2zenith', 'player_id' => $this->me->id, 'pin' => $pin];
    }

    public function test_first_sign_in_sets_the_pin_and_a_wrong_one_is_refused(): void
    {
        $this->postJson('/api/league/game/login', ['passcode' => 'nope'] + $this->auth())->assertUnprocessable();
        $this->postJson('/api/league/game/login', $this->auth())->assertOk()->assertJsonPath('data.playerId', $this->me->id);
        $this->postJson('/api/league/game/login', $this->auth('9999'))->assertUnprocessable()->assertJsonValidationErrors('pin');
        $this->getJson('/api/league/game')->assertJsonFragment(['id' => $this->me->id, 'joined' => true]);
    }

    public function test_predictions_stay_hidden_until_kick_off_then_lock(): void
    {
        $this->postJson('/api/league/game/login', $this->auth())->assertOk();
        $this->putJson('/api/league/game/predictions', $this->auth() + ['predictions' => [['match_no' => 1, 'home' => 2, 'away' => 1]]])
            ->assertOk()->assertJsonPath('data.predictions.0.home', 2);
        $this->getJson('/api/league/game')->assertJsonCount(0, 'data.predictions');

        LeagueResult::create(['match_no' => 1, 'status' => 'live']);
        $this->getJson('/api/league/game')->assertJsonPath('data.predictions.0.away', 1);
        $this->putJson('/api/league/game/predictions', $this->auth() + ['predictions' => [['match_no' => 1, 'home' => 0, 'away' => 0]]])
            ->assertUnprocessable();
    }

    public function test_fantasy_picks_must_be_league_players_and_lock_with_the_night(): void
    {
        $this->postJson('/api/league/game/login', $this->auth())->assertOk();
        $outsider = Player::factory()->create()->id;
        $this->putJson('/api/league/game/fantasy', $this->auth() + ['night' => 1, 'pick_ids' => [$this->squad[0], $this->squad[1], $outsider], 'captain_id' => $outsider])
            ->assertUnprocessable();
        $this->putJson('/api/league/game/fantasy', $this->auth() + ['night' => 1, 'pick_ids' => $this->squad, 'captain_id' => $this->squad[2]])
            ->assertOk()->assertJsonPath('data.fantasy.0.captainId', $this->squad[2]);

        LeagueResult::create(['match_no' => 3, 'status' => 'live']); // a night 1 fixture
        $this->getJson('/api/league/game')->assertJsonPath('data.fantasy.0.pickIds', $this->squad);
        $this->putJson('/api/league/game/fantasy', $this->auth() + ['night' => 1, 'pick_ids' => $this->squad, 'captain_id' => $this->squad[0]])
            ->assertUnprocessable();
        // Next Sunday is still open.
        $this->putJson('/api/league/game/fantasy', $this->auth() + ['night' => 2, 'pick_ids' => $this->squad, 'captain_id' => $this->squad[0]])
            ->assertOk();
    }

    public function test_committee_can_reset_a_forgotten_pin(): void
    {
        $this->postJson('/api/league/game/login', $this->auth())->assertOk();
        $this->deleteJson("/api/league/game/pins/{$this->me->id}")->assertUnauthorized();
        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));
        $this->deleteJson("/api/league/game/pins/{$this->me->id}")->assertNoContent();
        $this->postJson('/api/league/game/login', $this->auth('4321'))->assertOk();
    }
}
