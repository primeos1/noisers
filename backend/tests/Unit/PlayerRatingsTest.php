<?php

namespace Tests\Unit;

use App\Models\MatchDayEvent;
use App\Support\PlayerRatings;
use PHPUnit\Framework\TestCase;

class PlayerRatingsTest extends TestCase
{
    private const POSITIONS = [1 => 'GK', 4 => 'DEF', 7 => 'MID', 9 => 'FWD', 2 => 'GK', 5 => 'DEF', 8 => 'MID', 10 => 'FWD'];

    private function points(array $games): array
    {
        $event = new MatchDayEvent(['games' => $games]);

        return PlayerRatings::points($event, fn (int $n) => self::POSITIONS[$n] ?? null);
    }

    private function game(array $goals, string $status = 'finished'): array
    {
        return [
            'status' => $status,
            'teams' => [
                ['name' => 'A', 'players' => [1, 4, 7, 9, 'guest-1']],
                ['name' => 'B', 'players' => [2, 5, 8, 10]],
            ],
            'goals' => $goals,
        ];
    }

    public function test_winning_side_with_clean_sheet_rewards_back_line_most(): void
    {
        $p = $this->points([$this->game([
            ['teamIndex' => 0, 'playerId' => 9, 'assistPlayerId' => 7],
            ['teamIndex' => 0, 'playerId' => 7, 'assistPlayerId' => null],
        ])]);

        $this->assertEqualsWithDelta(0.25, $p[1], 1e-9);   // win + GK clean sheet
        $this->assertEqualsWithDelta(0.22, $p[4], 1e-9);   // win + DEF clean sheet
        $this->assertEqualsWithDelta(0.35, $p[7], 1e-9);   // win + MID clean sheet + goal + assist
        $this->assertEqualsWithDelta(0.22, $p[9], 1e-9);   // win + goal
        $this->assertEqualsWithDelta(-0.10, $p[2], 1e-9);  // loss
        $this->assertEqualsWithDelta(-0.10, $p[10], 1e-9); // loss
        $this->assertGreaterThan($p[4], $p[1]);
    }

    public function test_draws_own_goals_guests_and_unfinished_games(): void
    {
        $p = $this->points([
            $this->game([
                ['teamIndex' => 1, 'playerId' => 4, 'ownGoal' => true],
                ['teamIndex' => 0, 'playerId' => 'guest-1', 'assistPlayerId' => 9],
            ]),
            $this->game([['teamIndex' => 0, 'playerId' => 9]], 'live'),
        ]);

        $this->assertEqualsWithDelta(-0.08, $p[4], 1e-9); // draw, own goal
        $this->assertEqualsWithDelta(0.08, $p[9], 1e-9);  // draw, assist to guest; live game ignored
        $this->assertArrayNotHasKey('guest-1', $p);
    }

    public function test_adjust_respects_bounds_and_diminishing_returns(): void
    {
        $this->assertSame(9.5, PlayerRatings::adjust(9.5, 5.0));
        $this->assertSame(4.0, PlayerRatings::adjust(4.0, -5.0));
        $this->assertSame(7.3, PlayerRatings::adjust(6.8, 5.0));  // capped at +0.5 per day
        $this->assertSame(6.3, PlayerRatings::adjust(6.8, -5.0)); // capped at -0.5 per day
        $this->assertSame(6.05, PlayerRatings::adjust(6.0, 0.04)); // small moves survive rounding

        $nearTop = PlayerRatings::adjust(9.0, 0.4) - 9.0;
        $middle = PlayerRatings::adjust(6.75, 0.4) - 6.75;
        $this->assertLessThan($middle, $nearTop);

        for ($r = 4.0; $r <= 9.5; $r += 0.1) {
            foreach ([-3.0, -0.3, 0.0, 0.3, 3.0] as $raw) {
                $new = PlayerRatings::adjust($r, $raw);
                $this->assertGreaterThanOrEqual(4.0, $new);
                $this->assertLessThanOrEqual(9.5, $new);
            }
        }
    }
}
