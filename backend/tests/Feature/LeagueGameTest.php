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

    public function test_committee_can_reset_a_forgotten_pin(): void
    {
        $this->postJson('/api/league/game/login', $this->auth())->assertOk();
        $this->deleteJson("/api/league/game/pins/{$this->me->id}")->assertUnauthorized();
        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));
        $this->deleteJson("/api/league/game/pins/{$this->me->id}")->assertNoContent();
        $this->postJson('/api/league/game/login', $this->auth('4321'))->assertOk();
    }
}
