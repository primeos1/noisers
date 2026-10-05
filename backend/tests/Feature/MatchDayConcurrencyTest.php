<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MatchDayConcurrencyTest extends TestCase
{
    use RefreshDatabase;

    private int $v;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->v = $this->postJson('/api/match-day-events', [
            'id' => 'md',
            'date' => 'Sun 5 Oct',
            'status' => 'live',
            'present_players' => [],
            'guests' => [],
            'groups' => [],
            'games' => [],
        ])->assertCreated()->json('data.version');
    }

    public function test_each_save_bumps_the_version(): void
    {
        $this->putJson('/api/match-day-events/md', ['version' => $this->v, 'guests' => [['id' => 'G1', 'name' => 'Guest 1']]])
            ->assertOk()
            ->assertJsonPath('data.version', $this->v + 1);

        $this->putJson('/api/match-day-events/md', ['version' => $this->v + 1, 'venue' => 'Pitch 2'])
            ->assertOk()
            ->assertJsonPath('data.version', $this->v + 2);
    }

    public function test_a_save_from_a_stale_copy_is_refused_with_the_latest(): void
    {
        $this->putJson('/api/match-day-events/md', ['version' => $this->v, 'guests' => [['id' => 'G1', 'name' => 'Ade']]])->assertOk();

        // A second admin still on the old version tries to save over it.
        $this->putJson('/api/match-day-events/md', ['version' => $this->v, 'guests' => []])
            ->assertStatus(409)
            ->assertJsonPath('data.version', $this->v + 1)
            ->assertJsonPath('data.guests.0.name', 'Ade');

        $this->getJson('/api/match-day-events')->assertJsonPath('data.0.guests.0.name', 'Ade');
    }

    public function test_a_save_without_a_version_still_goes_through(): void
    {
        $this->putJson('/api/match-day-events/md', ['version' => $this->v, 'venue' => 'Pitch 1'])->assertOk();

        $this->putJson('/api/match-day-events/md', ['venue' => 'Pitch 3'])
            ->assertOk()
            ->assertJsonPath('data.venue', 'Pitch 3')
            ->assertJsonPath('data.version', $this->v + 2);
    }
}
