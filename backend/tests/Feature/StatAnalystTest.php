<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\Player;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StatAnalystTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create(['role' => 'analyst']));
    }

    private function openMatchDay(string $id): void
    {
        $this->postJson('/api/match-day-events', [
            'id' => $id,
            'date' => 'Wed 18 Nov',
            'status' => 'live',
            'present_players' => [],
            'guests' => [],
            'groups' => [],
            'games' => [],
        ])->assertCreated();
    }

    public function test_the_analyst_can_open_and_record_a_match_day(): void
    {
        $this->openMatchDay('md-analyst');

        $this->putJson('/api/match-day-events/md-analyst', [
            'guests' => [['id' => 'g1', 'name' => 'Guest 1']],
        ])->assertOk();
    }

    public function test_the_analyst_cannot_delete_a_match_day(): void
    {
        $this->openMatchDay('md-keep');

        $this->deleteJson('/api/match-day-events/md-keep')->assertForbidden();
    }

    public function test_the_analyst_is_kept_out_of_everything_else(): void
    {
        $player = Player::factory()->create();
        $card = Card::factory()->create(['player_id' => $player->id]);

        $this->getJson('/api/dashboard')->assertForbidden();
        $this->getJson('/api/settings/passcode')->assertForbidden();
        $this->deleteJson("/api/players/{$player->id}")->assertForbidden();
        $this->deleteJson("/api/cards/{$card->id}")->assertForbidden();
        $this->putJson('/api/settings', [])->assertForbidden();
        $this->putJson('/api/vale-content', [])->assertForbidden();
        $this->putJson('/api/home-content', [])->assertForbidden();
        $this->putJson('/api/league/matchday', [])->assertForbidden();
        $this->getJson('/api/training-sessions')->assertForbidden();
        $this->getJson('/api/media')->assertForbidden();
    }
}
