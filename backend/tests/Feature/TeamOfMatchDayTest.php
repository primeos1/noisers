<?php

namespace Tests\Feature;

use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Support\MatchDayFinalizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TeamOfMatchDayTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_stand_in_from_another_team_is_not_in_the_team_of_the_match_day(): void
    {
        [$a, $b, $c, $d, $sub] = Player::factory()->count(5)->create()->pluck('id')->all();
        $game = fn ($reds, $goals) => [
            'id' => uniqid('g'),
            'status' => 'finished',
            'teams' => [['name' => 'Reds', 'players' => $reds], ['name' => 'Blues', 'players' => [$c, $d]]],
            'goals' => array_map(fn () => ['id' => uniqid('x'), 'teamIndex' => 0, 'playerId' => $a, 'ownGoal' => false], range(1, $goals)),
            'cards' => [],
        ];
        // $sub, drawn for Greens, stood in for $b in Reds' second game.
        $event = new MatchDayEvent([
            'groups' => [
                ['name' => 'Reds', 'players' => [$a, $b]],
                ['name' => 'Blues', 'players' => [$c, $d]],
                ['name' => 'Greens', 'players' => [$sub]],
            ],
            'games' => [$game([$a, $b], 2), $game([$a, $sub], 1)],
        ]);

        $day = MatchDayFinalizer::computeTeamOfMatchDay($event, [$a, $b, $c, $d, $sub]);

        $this->assertSame('Reds', $day['team']['name']);
        $this->assertEqualsCanonicalizing([$a, $b], $day['lineupPlayerIds']);
    }

    public function test_teams_level_on_wins_and_goal_difference_are_split_by_goals_scored(): void
    {
        [$a, $b, $c] = Player::factory()->count(3)->create()->pluck('id')->all();
        $game = fn ($home, $away, $homeGoals, $awayGoals) => [
            'id' => uniqid('g'),
            'status' => 'finished',
            'teams' => [['name' => $home, 'players' => []], ['name' => $away, 'players' => []]],
            'goals' => [
                ...array_map(fn () => ['id' => uniqid('x'), 'teamIndex' => 0, 'playerId' => $a, 'ownGoal' => false], range(1, $homeGoals) ?: []),
                ...array_map(fn () => ['id' => uniqid('x'), 'teamIndex' => 1, 'playerId' => $b, 'ownGoal' => false], $awayGoals ? range(1, $awayGoals) : []),
            ],
            'cards' => [],
        ];
        // Greys and Greens each lose once by one goal, but Greys score more —
        // listed first, Greens would land on top without the goals tiebreak.
        $event = new MatchDayEvent([
            'groups' => [
                ['name' => 'Greens', 'players' => [$a]],
                ['name' => 'Greys', 'players' => [$b]],
                ['name' => 'Blacks', 'players' => [$c]],
            ],
            'games' => [$game('Blacks', 'Greens', 1, 0), $game('Blacks', 'Greys', 3, 2)],
        ]);

        $flop = MatchDayFinalizer::computeFlopTeamOfMatchDay($event, [$a, $b, $c]);

        $this->assertSame('Greens', $flop['name']);
    }
}
