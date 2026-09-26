<?php

namespace Tests\Feature;

use App\Models\Player;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CmsEndpointsTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_reads_do_not_require_auth(): void
    {
        foreach ([
            '/api/home-content',
            '/api/vale-content',
            '/api/highlights',
            '/api/players',
            '/api/cards',
            '/api/match-day-events',
            '/api/settings',
        ] as $path) {
            $this->getJson($path)->assertOk();
        }
    }

    public function test_writes_require_auth(): void
    {
        $this->putJson('/api/home-content', ['hero_headline' => 'x'])->assertUnauthorized();
        $this->postJson('/api/highlights', [])->assertUnauthorized();
        $this->putJson('/api/vale-content', [])->assertUnauthorized();
        $this->postJson('/api/players', [])->assertUnauthorized();
        $this->postJson('/api/match-day-events', [])->assertUnauthorized();
        $this->putJson('/api/settings', [])->assertUnauthorized();
    }

    public function test_committee_can_edit_home_content(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));

        $res = $this->putJson('/api/home-content', [
            'hero_headline' => 'New headline',
            'hero_subtext' => 'New subtext',
        ])->assertOk();

        $this->assertSame('New headline', $res->json('data.hero.headline'));

        $this->assertSame('New headline', $this->getJson('/api/home-content')->json('data.hero.headline'));
    }

    public function test_committee_can_edit_the_stats_section(): void
    {
        $this->getJson('/api/home-content')
            ->assertJsonPath('data.statsSection.enabled', true)
            ->assertJsonPath('data.statsSection.live', ['squad', 'match_days', 'games', 'goals']);

        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));

        $this->putJson('/api/home-content', [
            'stats_enabled' => false,
            'stats_headline' => 'Numbers up',
            'stats_live' => ['goals', 'squad'],
        ])
            ->assertOk()
            ->assertJsonPath('data.statsSection.enabled', false)
            ->assertJsonPath('data.statsSection.headline', 'Numbers up')
            ->assertJsonPath('data.statsSection.live', ['goals', 'squad']);

        $this->putJson('/api/home-content', ['stats_live' => ['wins']])->assertUnprocessable();
    }

    public function test_committee_can_manage_highlights(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));

        $created = $this->postJson('/api/highlights', [
            'type' => 'photo',
            'media_url' => 'https://example.com/a.jpg',
            'caption' => 'A goal',
            'category' => 'Goals',
        ])->assertCreated();

        $id = $created->json('data.id');
        $this->assertNotNull($id);

        $this->putJson("/api/highlights/{$id}", ['category' => 'Saves'])
            ->assertOk()
            ->assertJsonPath('data.category', 'Saves');

        $this->assertCount(1, $this->getJson('/api/highlights')->json('data'));

        $this->deleteJson("/api/highlights/{$id}")->assertNoContent();
        $this->assertCount(0, $this->getJson('/api/highlights')->json('data'));
    }

    public function test_committee_can_manage_squad(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));

        $created = $this->postJson('/api/players', [
            'number' => 42,
            'name' => 'New Player',
            'position' => 'FWD',
            'rating' => 6.0,
        ])->assertCreated();

        $this->assertSame(42, $created->json('data.number'));
        $this->assertSame(0, $created->json('data.goals'));
        $id = $created->json('data.id');

        $this->putJson("/api/players/{$id}", ['name' => 'Renamed Player'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Renamed Player');

        $this->deleteJson("/api/players/{$id}")->assertNoContent();
        $this->getJson("/api/players/{$id}")->assertNotFound();
    }

    public function test_committee_can_manage_cards_by_player_id(): void
    {
        $player = Player::factory()->create(['number' => 9]);
        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));

        $created = $this->postJson('/api/cards', [
            'player_id' => $player->id,
            'type' => 'yellow',
            'reason' => 'Dissent',
            'fine_amount' => 2000,
        ])->assertCreated();

        $this->assertSame($player->id, $created->json('data.playerId'));

        $id = $created->json('data.id');
        $this->putJson("/api/cards/{$id}", ['paid' => true])
            ->assertOk()
            ->assertJsonPath('data.paid', true);
    }

    public function test_settings_is_admin_only(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));
        $this->putJson('/api/settings', ['yellow_card_fine' => 1000])->assertForbidden();

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->putJson('/api/settings', ['yellow_card_fine' => 1000])->assertOk();
    }

    public function test_match_day_lifecycle_and_team_of_week_endpoint(): void
    {
        $a = Player::factory()->create(['number' => 10]);
        $b = Player::factory()->create(['number' => 20]);
        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));

        $this->postJson('/api/match-day-events', [
            'id' => 'e2e-test-day',
            'title' => 'E2E Test Day',
            'venue' => 'Zenith',
            'date' => 'Mon 1 Jan',
            'status' => 'live',
            'present_players' => [$a->id, $b->id],
            'guests' => [],
            'groups' => [],
            'games' => [],
        ])->assertCreated();

        $this->putJson('/api/match-day-events/e2e-test-day', [
            'status' => 'ended',
            'games' => [[
                'id' => 'g1',
                'teams' => [
                    ['name' => 'Team A', 'players' => [$a->id]],
                    ['name' => 'Team B', 'players' => [$b->id]],
                ],
                'goals' => [
                    ['id' => 'go1', 'teamIndex' => 0, 'playerId' => $a->id, 'ownGoal' => false, 'minute' => 5],
                ],
                'cards' => [],
                'status' => 'finished',
            ]],
        ])->assertOk();

        // Finalize should have rewritten The Vale from this match day.
        $vale = $this->getJson('/api/vale-content');
        $this->assertSame('E2E Test Day', $vale->json('data.teamOfTheWeek.title'));
        $this->assertSame($a->id, $vale->json('data.playerOfTheWeek.playerId'));

        // Public, per-event lookup should agree, independent of the singleton.
        $team = $this->getJson('/api/match-day-events/e2e-test-day/team-of-week')->assertOk();
        $this->assertSame('E2E Test Day', $team->json('data.title'));
        $this->assertSame([$a->id], $team->json('data.lineupPlayerIds'));
        $this->assertSame('Team B', $team->json('data.rivalTeam'));
    }
}
