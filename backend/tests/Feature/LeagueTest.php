<?php

namespace Tests\Feature;

use App\Models\Player;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeagueTest extends TestCase
{
    use RefreshDatabase;

    public function test_league_keeper_saves_are_stored_validated_and_reset(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $keeper = Player::factory()->create(['position' => 'GK']);
        $defender = Player::factory()->create(['position' => 'DEF']);
        $this->putJson('/api/league/entrants', ['player_ids' => [$keeper->id, $defender->id], 'keeper_ids' => [$keeper->id]])->assertOk();
        $this->putJson('/api/league/matches/1', ['status' => 'live', 'saves' => [$keeper->id => 7]])
            ->assertOk()->assertJsonPath('data.results.0.saves.'.$keeper->id, 7);
        $this->putJson('/api/league/matches/1', ['status' => 'final'])
            ->assertOk()->assertJsonPath('data.results.0.saves.'.$keeper->id, 7);
        $this->putJson('/api/league/matches/1', ['status' => 'final', 'saves' => [$defender->id => 2]])->assertUnprocessable();
        $this->putJson('/api/league/matches/1', ['status' => 'final', 'saves' => [$keeper->id => -1]])->assertUnprocessable();
        $this->putJson('/api/league/matches/1', ['status' => 'scheduled'])->assertOk();
        $this->assertEmpty($this->getJson('/api/league')->json('data.results.0.saves'));
    }

    public function test_writes_need_a_committee_sign_in(): void
    {
        $this->putJson('/api/league/entrants', ['player_ids' => []])->assertUnauthorized();
        $this->postJson('/api/league/draw', [])->assertUnauthorized();
        $this->putJson('/api/league/matches/1', ['status' => 'live'])->assertUnauthorized();
    }

    public function test_the_draw_seed_stays_secret_until_the_draw_starts(): void
    {
        $this->travelTo('2026-11-07 12:00:00');
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $players = Player::factory()->count(8)->create();

        $this->putJson('/api/league/entrants', ['player_ids' => $players->pluck('id')->all()])
            ->assertOk()
            ->assertJsonCount(8, 'data.entrants');

        $draw = $this->postJson('/api/league/draw', ['starts_at' => '2026-11-08T20:00:00+01:00'])
            ->assertCreated()
            ->json('data.draw');
        $this->assertNull($draw['seed']);
        $this->assertFalse($draw['revealed']);
        $this->assertSame(64, strlen($draw['hash']));

        // Sealed: the players can't change and nobody can see the seed.
        $this->putJson('/api/league/entrants', ['player_ids' => []])->assertUnprocessable();
        $this->assertStringNotContainsString('draw_seed', $this->getJson('/api/league')->getContent());

        // A player's rating changing after the seal doesn't change the draw.
        $players[0]->update(['rating' => 9.4]);

        $this->travelTo('2026-11-08 19:00:01');
        $after = $this->getJson('/api/league')->assertOk()->json('data');
        $this->assertTrue($after['draw']['revealed']);
        $this->assertSame($draw['hash'], hash('sha256', $after['draw']['seed']));
        $this->assertNotEquals(9.4, collect($after['entrants'])->firstWhere('id', $players[0]->id)['rating']);

        // Too late to quietly redo it.
        $this->deleteJson('/api/league/draw')->assertUnprocessable();
        $this->deleteJson('/api/league/draw?force=1')->assertUnprocessable();
        $this->putJson('/api/league/entrants', ['player_ids' => []])->assertUnprocessable();
        $this->postJson('/api/league/draw', ['starts_at' => '2026-11-09T20:00:00Z'])->assertUnprocessable();
        $locked = $this->getJson('/api/league')->assertOk()->json('data');
        $this->assertSame($after['draw'], $locked['draw']);
        $this->assertSame($after['entrants'], $locked['entrants']);
    }

    public function test_a_pending_draw_can_still_be_cancelled(): void
    {
        $this->travelTo('2026-11-07 12:00:00');
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $players = Player::factory()->count(6)->create();
        $this->putJson('/api/league/entrants', ['player_ids' => $players->pluck('id')->all()])->assertOk();
        $this->postJson('/api/league/draw', ['starts_at' => '2026-11-08T20:00:00Z'])->assertCreated();
        $this->deleteJson('/api/league/draw')->assertOk()->assertJsonPath('data.draw', null);
    }

    public function test_sealing_needs_six_players_and_a_future_start(): void
    {
        $this->travelTo('2026-11-07 12:00:00');
        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));
        $players = Player::factory()->count(5)->create();
        $this->putJson('/api/league/entrants', ['player_ids' => $players->pluck('id')->all()])->assertOk();

        $this->postJson('/api/league/draw', ['starts_at' => '2026-11-08T20:00:00Z'])->assertUnprocessable();

        $more = Player::factory()->create();
        $this->putJson('/api/league/entrants', ['player_ids' => [...$players->pluck('id')->all(), $more->id]])->assertOk();
        $this->postJson('/api/league/draw', ['starts_at' => '2026-11-06T20:00:00Z'])->assertUnprocessable();
        $this->postJson('/api/league/draw', ['starts_at' => '2026-11-08T20:00:00Z'])->assertCreated();
    }

    public function test_a_league_keeper_plays_in_goal_without_changing_their_squad_position(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $player = Player::factory()->create(['position' => 'DEF']);

        $this->putJson('/api/league/entrants', ['player_ids' => [$player->id], 'keeper_ids' => [$player->id]])
            ->assertOk()
            ->assertJsonPath('data.entrants.0.position', 'GK')
            ->assertJsonPath('data.keeperIds', [$player->id]);
        $this->assertSame('DEF', $player->fresh()->position);
    }

    public function test_goals_drive_the_score(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        [$a, $b] = Player::factory()->count(2)->create();

        $this->putJson('/api/league/matchday', ['night' => 1])->assertOk()->assertJsonPath('data.liveNight', 1);

        // Logging a goal kicks the game off if nobody did.
        $this->postJson('/api/league/matches/1/goals', ['side' => 'home', 'player_id' => $a->id, 'assist_player_id' => $b->id])
            ->assertCreated()
            ->assertJsonPath('data.results.0.status', 'live')
            ->assertJsonPath('data.results.0.homeScore', 1);
        $goalId = $this->postJson('/api/league/matches/1/goals', ['side' => 'away', 'own_goal' => true, 'player_id' => $a->id])
            ->json('data.goals.1.id');

        $this->putJson('/api/league/matches/1', ['status' => 'final'])
            ->assertOk()
            ->assertJsonPath('data.results.0.status', 'final')
            ->assertJsonPath('data.results.0.awayScore', 1);

        $this->deleteJson("/api/league/goals/{$goalId}")->assertOk()->assertJsonPath('data.results.0.awayScore', 0);

        // Resetting the match wipes its goals.
        $this->putJson('/api/league/matches/1', ['status' => 'scheduled'])
            ->assertOk()
            ->assertJsonPath('data.results.0.homeScore', 0)
            ->assertJsonCount(0, 'data.goals');

        $this->putJson('/api/league/matches/46', ['status' => 'live'])->assertNotFound();
    }
}
