<?php

namespace Tests\Feature;

use App\Models\Player;
use App\Models\PlayerAbsence;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlayerAbsencesTest extends TestCase
{
    use RefreshDatabase;

    public function test_writes_require_a_committee_sign_in(): void
    {
        $player = Player::factory()->create();
        $body = ['player_id' => $player->id, 'type' => 'injury', 'starts_on' => '2026-09-30'];

        $this->postJson('/api/player-absences', $body)->assertUnauthorized();
        $this->putJson('/api/player-absences/1', $body)->assertUnauthorized();
        $this->deleteJson('/api/player-absences/1')->assertUnauthorized();
    }

    public function test_committee_can_tag_a_player_out_and_edit_the_period(): void
    {
        $this->travelTo('2026-09-30 12:00');
        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));
        $player = Player::factory()->create();

        $id = $this->postJson('/api/player-absences', [
            'player_id' => $player->id,
            'type' => 'injury',
            'reason' => 'Hamstring strain',
            'starts_on' => '2026-09-28',
            'ends_on' => '2026-10-20',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.endsOn', '2026-10-20')
            ->json('data.id');

        // No return date yet.
        $this->putJson("/api/player-absences/{$id}", ['ends_on' => null])
            ->assertOk()
            ->assertJsonPath('data.endsOn', null)
            ->assertJsonPath('data.status', 'active');

        // A return date before the start is refused, even in a partial patch.
        $this->putJson("/api/player-absences/{$id}", ['ends_on' => '2026-09-01'])->assertUnprocessable();
        $this->postJson('/api/player-absences', [
            'player_id' => $player->id, 'type' => 'travel', 'starts_on' => '2026-10-10', 'ends_on' => '2026-10-01',
        ])->assertUnprocessable();
        $this->postJson('/api/player-absences', [
            'player_id' => $player->id, 'type' => 'holiday', 'starts_on' => '2026-10-10',
        ])->assertUnprocessable();

        $this->getJson('/api/player-absences')->assertOk()->assertJsonCount(1, 'data');

        $this->deleteJson("/api/player-absences/{$id}")->assertNoContent();
        $this->assertSame(0, PlayerAbsence::count());
    }

    public function test_status_follows_the_dates(): void
    {
        $this->travelTo('2026-09-30 12:00');
        $player = Player::factory()->create();
        $make = fn ($from, $to) => PlayerAbsence::create(['player_id' => $player->id, 'type' => 'travel', 'starts_on' => $from, 'ends_on' => $to]);

        $this->assertSame('upcoming', $make('2026-10-05', '2026-10-12')->status());
        $this->assertSame('active', $make('2026-09-20', '2026-09-30')->status());
        $this->assertSame('active', $make('2026-09-20', null)->status());
        $this->assertSame('ended', $make('2026-09-01', '2026-09-29')->status());
    }

    public function test_removing_a_player_removes_their_absences(): void
    {
        $player = Player::factory()->create();
        PlayerAbsence::create(['player_id' => $player->id, 'type' => 'suspension', 'starts_on' => '2026-09-30']);

        $player->delete();

        $this->assertSame(0, PlayerAbsence::count());
    }
}
