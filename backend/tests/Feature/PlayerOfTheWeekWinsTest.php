<?php

namespace Tests\Feature;

use App\Models\Player;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlayerOfTheWeekWinsTest extends TestCase
{
    use RefreshDatabase;

    private function playMatchDay(string $id, Player $scorer, Player $other): void
    {
        $this->postJson('/api/match-day-events', [
            'id' => $id,
            'venue' => 'Pitch 2',
            'date' => 'Sun 28 Sept',
            'status' => 'live',
            'present_players' => [],
            'guests' => [],
            'groups' => [],
            'games' => [],
        ])->assertCreated();

        $this->putJson("/api/match-day-events/{$id}", [
            'games' => [[
                'id' => 'g1',
                'status' => 'finished',
                'teams' => [
                    ['name' => 'Reds', 'players' => [$scorer->id]],
                    ['name' => 'Blues', 'players' => [$other->id]],
                ],
                'goals' => [['id' => 'goal1', 'teamIndex' => 0, 'playerId' => $scorer->id]],
                'cards' => [],
            ]],
        ])->assertOk();

        $this->putJson("/api/match-day-events/{$id}", ['status' => 'ended'])->assertOk();
    }

    public function test_an_older_match_day_shows_its_own_awards_not_the_latest(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $ace = Player::factory()->create(['position' => 'FWD']);
        $rival = Player::factory()->create(['position' => 'FWD']);

        $this->playMatchDay('first', $ace, $rival);
        $this->playMatchDay('second', $rival, $ace);

        $this->getJson('/api/vale-content')->assertJsonPath('data.playerOfTheWeek.playerId', $rival->id);

        $this->getJson('/api/match-day-events/first/team-of-week')
            ->assertJsonPath('data.title', 'Matchday 1')
            ->assertJsonPath('data.awards.playerOfTheWeek.playerId', $ace->id)
            ->assertJsonPath('data.awards.weeklyLeaders.topScorer.playerId', $ace->id)
            ->assertJsonPath('data.awards.weeklyLeaders.topScorer.value', 1);
        $this->getJson('/api/match-day-events/second/team-of-week')
            ->assertJsonPath('data.awards.playerOfTheWeek.playerId', $rival->id);

        // Looking back never rewrites the saved Vale.
        $this->getJson('/api/vale-content')->assertJsonPath('data.playerOfTheWeek.playerId', $rival->id);
    }

    public function test_the_vale_counts_how_often_the_player_of_the_week_has_won(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $ace = Player::factory()->create(['position' => 'FWD']);
        $rival = Player::factory()->create(['position' => 'FWD']);

        $this->getJson('/api/vale-content')->assertJsonPath('data.playerOfTheWeek.timesWon', 0);

        $this->playMatchDay('first', $ace, $rival);
        $this->getJson('/api/vale-content')
            ->assertJsonPath('data.playerOfTheWeek.playerId', $ace->id)
            ->assertJsonPath('data.playerOfTheWeek.timesWon', 1);

        $this->playMatchDay('second', $rival, $ace);
        $this->playMatchDay('third', $ace, $rival);
        $this->getJson('/api/vale-content')
            ->assertJsonPath('data.playerOfTheWeek.playerId', $ace->id)
            ->assertJsonPath('data.playerOfTheWeek.timesWon', 2);

        // Profiles carry both honours: the winning side each week is the scorer's.
        $this->getJson("/api/players/{$ace->id}")
            ->assertJsonPath('data.playerOfTheWeekWins', 2)
            ->assertJsonPath('data.teamOfTheWeekSelections', 2);
        $this->getJson("/api/players/{$rival->id}")
            ->assertJsonPath('data.playerOfTheWeekWins', 1)
            ->assertJsonPath('data.teamOfTheWeekSelections', 1);

        // The committee hands this week to someone else: the count follows.
        $this->putJson('/api/vale-content', ['potw_player_id' => $rival->id])
            ->assertJsonPath('data.playerOfTheWeek.timesWon', 2);
    }
}
