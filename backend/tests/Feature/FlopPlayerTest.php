<?php

namespace Tests\Feature;

use App\Models\MatchDayEvent;
use App\Support\MatchDayFinalizer;
use Tests\TestCase;

class FlopPlayerTest extends TestCase
{
    private function game(array $red, array $blue, array $goals = []): array
    {
        return [
            'id' => uniqid('g'),
            'status' => 'finished',
            'teams' => [['name' => 'Reds', 'players' => $red], ['name' => 'Blues', 'players' => $blue]],
            'goals' => $goals,
            'cards' => [],
        ];
    }

    public function test_there_is_a_flop_even_when_every_game_is_drawn(): void
    {
        // 1–1 then 0–0: nobody lost, so the fewest goal involvements decides.
        $event = new MatchDayEvent(['games' => [
            $this->game([1, 2], [3, 4], [
                ['id' => 'a', 'teamIndex' => 0, 'playerId' => 1, 'assistPlayerId' => 2, 'ownGoal' => false],
                ['id' => 'b', 'teamIndex' => 1, 'playerId' => 3, 'ownGoal' => false],
            ]),
            $this->game([1, 3], [2, 4]),
        ]]);

        $flop = MatchDayFinalizer::computeFlopPlayer($event, [1, 2, 3, 4]);

        $this->assertSame(4, $flop['playerId']);
        $this->assertSame(0, $flop['lost']);
        $this->assertSame(0, $flop['involvements']);
    }

    public function test_losses_still_come_first(): void
    {
        $event = new MatchDayEvent(['games' => [
            $this->game([1], [2], [['id' => 'a', 'teamIndex' => 0, 'playerId' => 1, 'ownGoal' => false]]),
        ]]);

        $this->assertSame(2, MatchDayFinalizer::computeFlopPlayer($event, [1, 2])['playerId']);
    }

    public function test_no_flop_when_no_squad_player_finished_a_game(): void
    {
        $event = new MatchDayEvent(['games' => [$this->game(['guest-1'], ['guest-2'])]]);

        $this->assertNull(MatchDayFinalizer::computeFlopPlayer($event, [1, 2]));
    }
}
