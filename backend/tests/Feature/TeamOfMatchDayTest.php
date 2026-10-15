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
}
