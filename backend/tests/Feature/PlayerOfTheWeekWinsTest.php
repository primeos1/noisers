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
            ->assertJsonPath('data.lineup.0.playerId', $ace->id)
            ->assertJsonPath('data.awards.playerOfTheWeek.playerId', $ace->id)
            ->assertJsonPath('data.awards.weeklyLeaders.topScorer.playerId', $ace->id)
            ->assertJsonPath('data.awards.weeklyLeaders.topScorer.value', 1);
        $this->getJson('/api/match-day-events/second/team-of-week')
            ->assertJsonPath('data.awards.playerOfTheWeek.playerId', $rival->id);

        // Looking back never rewrites the saved Vale.
        $this->getJson('/api/vale-content')->assertJsonPath('data.playerOfTheWeek.playerId', $rival->id);
    }

    /**
     * @param  array<int, int>  $reds
     * @param  array<int, int>  $blues
     * @param  array<int, array{0: int, 1: ?int}>  $redGoals  [scorer, assister]
     */
    private function playWeekDay(string $id, string $date, array $reds, array $blues, array $redGoals): void
    {
        $this->postJson('/api/match-day-events', [
            'id' => $id, 'venue' => 'Pitch 2', 'date' => $date, 'status' => 'live',
            'present_players' => [], 'guests' => [], 'groups' => [], 'games' => [],
        ])->assertCreated();
        $this->putJson("/api/match-day-events/{$id}", [
            'status' => 'ended',
            'games' => [[
                'id' => 'g1',
                'status' => 'finished',
                'teams' => [['name' => 'Reds', 'players' => $reds], ['name' => 'Blues', 'players' => $blues]],
                'goals' => array_map(fn ($g, $n) => [
                    'id' => "goal{$n}", 'teamIndex' => 0, 'playerId' => $g[0], 'assistPlayerId' => $g[1],
                ], $redGoals, array_keys($redGoals)),
                'cards' => [],
            ]],
        ])->assertOk();
    }

    public function test_the_team_of_the_week_is_the_best_six_across_wednesday_and_sunday(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $make = fn ($position) => Player::factory()->create(['position' => $position, 'secondary_position' => null])->id;
        [$gk, $def1, $def2, $def3, $mid1, $mid2, $fwd1, $fwd2, $fwd3] =
            [$make('GK'), $make('DEF'), $make('DEF'), $make('DEF'), $make('MID'), $make('MID'), $make('FWD'), $make('FWD'), $make('FWD')];

        // Wednesday: the Reds win 2–0, mid1 setting up both of fwd1's goals.
        Carbon::setTestNow('2026-09-30 19:00');
        $this->playWeekDay('wed', 'Wed 30 Sept', [$gk, $def1, $mid1, $fwd1], [$def2, $def3, $mid2, $fwd2, $fwd3], [[$fwd1, $mid1], [$fwd1, $mid1]]);
        // Sunday: def2 and fwd2 make up for it with a 1–0 win.
        Carbon::setTestNow('2026-10-04 10:00');
        $this->playWeekDay('sun', 'Sun 4 Oct', [$def2, $fwd2], [$def3, $fwd3], [[$fwd2, null]]);

        // Points added up over the week: def2 (-0.10 then +0.22) gets the
        // second defender's place; the one forward's place goes to fwd1.
        $six = [$gk, $def1, $def2, $mid1, $mid2, $fwd1];
        foreach (['wed', 'sun'] as $id) {
            $team = $this->getJson("/api/match-day-events/{$id}/team-of-week")
                ->assertJsonPath('data.weekOf', '2026-09-28')
                ->assertJsonPath('data.lineupPlayerIds', $six)
                ->assertJsonPath('data.playerOfWeek.playerId', $fwd1)
                ->assertJsonPath('data.weekMatchDays.0.id', 'wed')
                ->assertJsonPath('data.weekMatchDays.1.id', 'sun');
            $this->assertSame(['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD'], array_column($team->json('data.lineup'), 'position'));

            // Each match day has its own team and player, from that day alone.
            $this->assertSame($six, array_column($team->json('data.matchDays.0.lineup'), 'playerId'));
            $this->assertSame($fwd1, $team->json('data.matchDays.0.playerOfMatchDay.playerId'));
            $this->assertSame([$def2, $def3, $fwd2], array_column($team->json('data.matchDays.1.lineup'), 'playerId'));
            // def2 and fwd2 both earned 0.22; the goal breaks the tie.
            $this->assertSame($fwd2, $team->json('data.matchDays.1.playerOfMatchDay.playerId'));
        }

        // The Vale shows Sunday's match day, with the week's six and player.
        $this->getJson('/api/vale-content')
            ->assertJsonPath('data.teamOfTheWeek.lineupPlayerIds', $six)
            ->assertJsonPath('data.playerOfTheWeek.playerId', $fwd1);

        // One team and player of the week for the week, not one per match day.
        $this->getJson("/api/players/{$fwd1}")
            ->assertJsonPath('data.teamOfTheWeekSelections', 1)
            ->assertJsonPath('data.playerOfTheWeekWins', 1);
        $this->getJson("/api/players/{$fwd2}")
            ->assertJsonPath('data.teamOfTheWeekSelections', 0)
            ->assertJsonPath('data.playerOfTheWeekWins', 0);
        $this->getJson("/api/players/{$def3}")->assertJsonPath('data.teamOfTheWeekSelections', 0);

        // Delete Wednesday and only Sunday's players are left to pick from.
        $this->deleteJson('/api/match-day-events/wed')->assertNoContent();
        $this->getJson('/api/vale-content')
            ->assertJsonPath('data.teamOfTheWeek.lineupPlayerIds', [$def2, $def3, $fwd2])
            ->assertJsonPath('data.playerOfTheWeek.playerId', $fwd2);
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

        // Profiles carry both honours. The six has one forward's place, and
        // the week's scorer takes it.
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
