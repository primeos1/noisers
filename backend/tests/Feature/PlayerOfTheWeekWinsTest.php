<?php

namespace Tests\Feature;

use App\Models\Player;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlayerOfTheWeekWinsTest extends TestCase
{
    use RefreshDatabase;

    private function playMatchDay(string $id, Player $scorer, Player $other, string $date = 'Sun 28 Sept', int $goals = 1): void
    {
        $this->postJson('/api/match-day-events', [
            'id' => $id,
            'venue' => 'Pitch 2',
            'date' => $date,
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
                'goals' => array_map(
                    fn ($n) => ['id' => "goal{$n}", 'teamIndex' => 0, 'playerId' => $scorer->id],
                    range(1, $goals),
                ),
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

        $this->playMatchDay('first', $ace, $rival, 'Sun 21 Sept');
        $this->playMatchDay('second', $rival, $ace, 'Sun 28 Sept');

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

    public function test_the_team_of_the_week_is_the_best_side_across_wednesday_and_sunday(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $ace = Player::factory()->create(['position' => 'FWD']);
        $rival = Player::factory()->create(['position' => 'FWD']);

        // Wednesday's Reds win 3–0; Sunday's Reds only 1–0.
        Carbon::setTestNow('2026-09-30 19:00');
        $this->playMatchDay('wed', $ace, $rival, 'Wed 30 Sept', 3);
        Carbon::setTestNow('2026-10-04 10:00');
        $this->playMatchDay('sun', $rival, $ace, 'Sun 4 Oct', 1);

        foreach (['wed', 'sun'] as $id) {
            $this->getJson("/api/match-day-events/{$id}/team-of-week")
                ->assertJsonPath('data.title', 'Matchday 1')
                ->assertJsonPath('data.score', '3–0')
                ->assertJsonPath('data.weekOf', '2026-09-28')
                ->assertJsonPath('data.lineupPlayerIds', [$ace->id])
                ->assertJsonPath('data.weekMatchDays.0.id', 'wed')
                ->assertJsonPath('data.weekMatchDays.1.id', 'sun');
        }

        // The Vale shows Sunday's match day, with the week's best side.
        $this->getJson('/api/vale-content')
            ->assertJsonPath('data.playerOfTheWeek.playerId', $rival->id)
            ->assertJsonPath('data.teamOfTheWeek.lineupPlayerIds', [$ace->id]);

        // One team of the week for the week, not one per match day.
        $this->getJson("/api/players/{$ace->id}")->assertJsonPath('data.teamOfTheWeekSelections', 1);
        $this->getJson("/api/players/{$rival->id}")->assertJsonPath('data.teamOfTheWeekSelections', 0);

        // Delete Wednesday and Sunday's own winners become the team of the week.
        $this->deleteJson('/api/match-day-events/wed')->assertNoContent();
        $this->getJson('/api/vale-content')->assertJsonPath('data.teamOfTheWeek.lineupPlayerIds', [$rival->id]);
    }

    public function test_the_vale_counts_how_often_the_player_of_the_week_has_won(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $ace = Player::factory()->create(['position' => 'FWD']);
        $rival = Player::factory()->create(['position' => 'FWD']);

        $this->getJson('/api/vale-content')->assertJsonPath('data.playerOfTheWeek.timesWon', 0);

        $this->playMatchDay('first', $ace, $rival, 'Sun 14 Sept');
        $this->getJson('/api/vale-content')
            ->assertJsonPath('data.playerOfTheWeek.playerId', $ace->id)
            ->assertJsonPath('data.playerOfTheWeek.timesWon', 1);

        $this->playMatchDay('second', $rival, $ace, 'Sun 21 Sept');
        $this->playMatchDay('third', $ace, $rival, 'Sun 28 Sept');
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
