<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\Player;
use App\Models\PlayerRatingChange;
use App\Models\User;
use App\Models\ValeContent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ClubSettingsOptionsTest extends TestCase
{
    use RefreshDatabase;

    private function endMatchDay(Player $scorer, Player $other): void
    {
        $this->postJson('/api/match-day-events', [
            'id' => 'md1',
            'title' => 'Session 1',
            'venue' => 'Pitch 2',
            'date' => 'Sun 28 Sept',
            'status' => 'live',
            'present_players' => [],
            'guests' => [],
            'groups' => [],
            'games' => [[
                'id' => 'g1',
                'status' => 'finished',
                'teams' => [
                    ['name' => 'Reds', 'players' => [$scorer->id]],
                    ['name' => 'Blues', 'players' => [$other->id]],
                ],
                'goals' => [['id' => 'goal1', 'teamIndex' => 0, 'playerId' => $scorer->id]],
                'cards' => [['id' => 'c1', 'playerId' => $other->id, 'type' => 'red', 'reason' => 'Foul']],
            ]],
        ])->assertCreated();

        $this->putJson('/api/match-day-events/md1', ['status' => 'ended'])->assertOk();
    }

    public function test_new_options_have_defaults_and_can_be_saved(): void
    {
        $this->getJson('/api/settings')
            ->assertOk()
            ->assertJsonPath('data.matchGameMinutes', 10)
            ->assertJsonPath('data.ratingsEnabled', true)
            ->assertJsonPath('data.ratingPositions.FWD.goal', 0.12)
            ->assertJsonPath('data.ratingPositions.GK.cleanSheet', 0.15)
            ->assertJsonPath('data.ratingPositions.GK.goalConceded', 0);

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->putJson('/api/settings', [
            'match_game_minutes' => 12,
            'match_default_team_mode' => 'rating',
            'match_default_venue' => 'Zenith Astro',
            'rating_positions' => ['MID' => ['goal' => 0.3]],
        ])
            ->assertOk()
            ->assertJsonPath('data.matchGameMinutes', 12)
            ->assertJsonPath('data.matchDefaultTeamMode', 'rating')
            ->assertJsonPath('data.matchDefaultVenue', 'Zenith Astro')
            ->assertJsonPath('data.ratingPositions.MID.goal', 0.3);

        $this->putJson('/api/settings', ['match_default_team_mode' => 'chaos'])->assertUnprocessable();
        $this->putJson('/api/settings', ['rating_positions' => ['GK' => ['win' => 3]]])->assertUnprocessable();
        $this->putJson('/api/settings', ['rating_positions' => ['SWEEPER' => ['win' => 0.1]]])->assertUnprocessable();
    }

    public function test_switches_turn_off_fines_ratings_and_vale_awards(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->putJson('/api/settings', [
            'fines_from_match_day' => false,
            'ratings_enabled' => false,
            'vale_auto_awards' => false,
        ])->assertOk();

        $scorer = Player::factory()->create(['position' => 'FWD', 'rating' => 6.0]);
        $other = Player::factory()->create(['position' => 'DEF', 'rating' => 6.0]);
        $this->endMatchDay($scorer, $other);

        $this->assertSame(0, Card::count());
        $this->assertSame(0, PlayerRatingChange::count());
        $this->assertEqualsWithDelta(6.0, (float) $scorer->fresh()->rating, 0.001);
        $this->assertNull(ValeContent::current()->team_week_title);
    }

    public function test_rating_weights_come_from_settings(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->putJson('/api/settings', [
            'rating_positions' => ['FWD' => ['win' => 0, 'goal' => 0.4], 'DEF' => ['loss' => 0.3]],
            'rating_max_swing' => 1,
        ])
            ->assertOk()
            ->assertJsonPath('data.ratingPositions.FWD.goal', 0.4)
            ->assertJsonPath('data.ratingPositions.MID.goal', 0.12) // other positions untouched
            ->assertJsonPath('data.ratingPositions.DEF.loss', 0.3)
            ->assertJsonPath('data.ratingPositions.DEF.ownGoal', 0.08);

        $scorer = Player::factory()->create(['position' => 'FWD', 'rating' => 6.0]);
        $other = Player::factory()->create(['position' => 'DEF', 'rating' => 6.0]);
        $this->endMatchDay($scorer, $other);

        // 0.4 raw points, scaled by headroom 2 * (9.5 - 6) / 5.5 ≈ 1.27.
        $this->assertEqualsWithDelta(6.51, (float) $scorer->fresh()->rating, 0.001);
    }

    public function test_new_players_start_at_the_configured_rating(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->putJson('/api/settings', ['rating_new_player' => 5.5])->assertOk();

        $this->postJson('/api/players', ['number' => 77, 'name' => 'New Signing', 'position' => 'MID'])
            ->assertCreated()
            ->assertJsonPath('data.rating', 5.5);
    }
}
