<?php

namespace Tests\Unit;

use App\Models\MatchDayEvent;
use App\Support\PlayerRatings;
use App\Support\PlayerStats;
use PHPUnit\Framework\TestCase;

class PlayerRatingsTest extends TestCase
{
    private const POSITIONS = [1 => 'GK', 4 => 'DEF', 7 => 'MID', 9 => 'FWD', 2 => 'GK', 5 => 'DEF', 8 => 'MID', 10 => 'FWD'];

    private function points(array $games, ?array $weights = null): array
    {
        $event = new MatchDayEvent(['games' => $games]);

        return PlayerRatings::points($event, fn (int $n) => self::POSITIONS[$n] ?? null, $weights);
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

    public function test_cards_cost_a_little_rating(): void
    {
        $game = $this->game([]);
        $game['cards'] = [
            ['teamIndex' => 0, 'playerId' => 4, 'type' => 'yellow'],
            ['teamIndex' => 1, 'playerId' => 8, 'type' => 'red'],
            ['teamIndex' => 0, 'playerId' => 'guest-1', 'type' => 'red'],
        ];
        $p = $this->points([$game]);

        $this->assertEqualsWithDelta(0.12 - 0.05, $p[4], 1e-9); // draw, DEF clean sheet, yellow
        $this->assertEqualsWithDelta(0.05 - 0.15, $p[8], 1e-9); // draw, MID clean sheet, red
        $this->assertArrayNotHasKey('guest-1', $p);
    }

    public function test_each_save_rewards_the_keeper_and_counts_as_a_stat(): void
    {
        $game = $this->game([]);
        $game['saves'] = [
            ['id' => 's1', 'teamIndex' => 0, 'playerId' => 1],
            ['id' => 's2', 'teamIndex' => 0, 'playerId' => 1],
            ['id' => 's3', 'teamIndex' => 1, 'playerId' => 2],
            ['id' => 's4', 'teamIndex' => 0, 'playerId' => 'guest-1'],
        ];
        $p = $this->points([$game]);

        $this->assertEqualsWithDelta(0.15 + 0.03 * 2, $p[1], 1e-9); // draw, GK clean sheet, 2 saves
        $this->assertEqualsWithDelta(0.15 + 0.03, $p[2], 1e-9);
        $this->assertArrayNotHasKey('guest-1', $p);

        $stats = PlayerStats::computeAll([new MatchDayEvent(['games' => [$game]])]);
        $this->assertSame(2, $stats[1]['saves']);
        $this->assertSame(1, $stats[2]['saves']);
        $this->assertSame(0, $stats[4]['saves']);
    }

    public function test_a_penalty_save_has_its_own_weight_and_counts_as_a_save(): void
    {
        $game = $this->game([]);
        $game['saves'] = [
            ['id' => 's1', 'teamIndex' => 0, 'playerId' => 1],
            ['id' => 's2', 'teamIndex' => 0, 'playerId' => 1, 'penalty' => true],
            // No keeper in goal for B — a defender stood in and saved a penalty.
            ['id' => 's3', 'teamIndex' => 1, 'playerId' => 5, 'penalty' => true],
        ];

        $p = $this->points([$game]);
        $this->assertEqualsWithDelta(0.15 + 0.03 + 0.10, $p[1], 1e-9); // draw, GK clean sheet, save, penalty save
        $this->assertEqualsWithDelta(0.12 + 0.10, $p[5], 1e-9);        // draw, DEF clean sheet, penalty save

        $weights = PlayerRatings::defaultPositionWeights();
        $weights['GK']['penalty_save'] = 0.25;
        $p = $this->points([$game], PlayerRatings::weights($weights));
        $this->assertEqualsWithDelta(0.15 + 0.03 + 0.25, $p[1], 1e-9);

        $stats = PlayerStats::computeAll([new MatchDayEvent(['games' => [$game]])]);
        $this->assertSame(2, $stats[1]['saves']);
        $this->assertSame(1, $stats[1]['penaltySaves']);
        $this->assertSame(1, $stats[5]['saves']);
        $this->assertSame(1, $stats[5]['penaltySaves']);
    }

    public function test_each_position_uses_its_own_weights(): void
    {
        $weights = PlayerRatings::defaultPositionWeights();
        $weights['FWD']['goal'] = 0.05;         // strikers are expected to score
        $weights['DEF']['goal'] = 0.30;         // a defender scoring is special
        $weights['GK']['goal_conceded'] = 0.04; // keepers pay for each goal let in
        $weights['DEF']['goal_conceded'] = 0.02;
        $weights['MID']['win'] = 0.2;

        $p = $this->points([$this->game([
            ['teamIndex' => 0, 'playerId' => 9],
            ['teamIndex' => 0, 'playerId' => 4],
            ['teamIndex' => 1, 'playerId' => 10],
        ])], PlayerRatings::weights($weights));

        $this->assertEqualsWithDelta(0.10 + 0.05, $p[9], 1e-9);  // win + FWD goal
        $this->assertEqualsWithDelta(0.10 + 0.30 - 0.02, $p[4], 1e-9); // win + DEF goal − 1 conceded
        $this->assertEqualsWithDelta(0.10 - 0.04, $p[1], 1e-9);  // win − 1 conceded
        $this->assertEqualsWithDelta(0.20, $p[7], 1e-9);         // MID win
        $this->assertEqualsWithDelta(-0.10 - 0.04 * 2, $p[2], 1e-9);  // loss − 2 conceded
        $this->assertEqualsWithDelta(-0.10 + 0.05, $p[10], 1e-9); // loss + FWD goal
    }

    public function test_roughest_player_has_most_cards_with_reds_breaking_ties(): void
    {
        $game = $this->game([]);
        $game['cards'] = [
            ['playerId' => 4, 'type' => 'yellow'],
            ['playerId' => 7, 'type' => 'red'],
            ['playerId' => 9, 'type' => 'yellow'],
            ['playerId' => 9, 'type' => 'yellow'],
        ];
        $stats = PlayerStats::computeAll([new MatchDayEvent(['games' => [$game]])]);

        $this->assertSame(2, $stats[9]['yellowCards']);
        $this->assertSame(1, $stats[7]['redCards']);
        $this->assertSame(9, PlayerStats::roughest($stats));
        $this->assertSame([9, 7, 4], array_column(PlayerStats::badBoys($stats), 'playerId'));

        unset($stats[9]);
        $this->assertSame(7, PlayerStats::roughest($stats)); // 1 red beats 1 yellow

        $this->assertNull(PlayerStats::roughest(PlayerStats::computeAll([new MatchDayEvent(['games' => [$this->game([])]])])));
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
