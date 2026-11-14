<?php

namespace App\Support;

use App\Http\Controllers\Api\LeagueController;
use App\Models\FnlEntry;
use App\Models\FnlTeam;
use App\Models\LeagueResult;
use App\Models\LeagueState;
use Carbon\CarbonImmutable;

/**
 * FNL, the Fantasy Noisers League: the rules the server enforces. Points
 * themselves are worked out on the league site (league/fnl.ts) from the
 * public results, the same way the league table is.
 */
class Fnl
{
    public const BUDGET = 58.0;

    public const SQUAD = ['GK' => 1, 'DEF' => 3, 'MID' => 2, 'FWD' => 3];

    public const STARTERS = 6;

    public const MAX_PER_CLUB = 3;

    public const TRANSFER_COST = 4;

    public const MAX_FREE_TRANSFERS = 2;

    public const CHIPS = ['wildcard', 'bench_boost', 'triple_captain'];

    public const DEADLINE_HOUR = 21;

    /** A player's price, in millions: their league rating to one decimal. */
    public static function price(float $rating): float
    {
        return round($rating, 1);
    }

    /** How far ownership moves a price: 0.1m per 10% of managers above or below average, up to 1.0m either way. */
    public const PRICE_STEP = 0.1;

    public const MAX_PRICE_CHANGE = 1.0;

    /**
     * Every league player's price for a gameweek, with how much it has moved.
     * Gameweek 1 uses the base prices (league ratings). After that, each
     * player's price follows how many managers had him in the gameweek just
     * played: owned by more than the average share, he goes up; by fewer, or
     * dropped, he goes down. Prices only move at deadlines, so they hold
     * still while people pick.
     *
     * @return array<int, array{position: string, base: float, price: float, change: float, owned: float}>
     */
    public static function prices(?int $gameweek): array
    {
        $pool = LeagueController::leaguePlayers();
        $owners = [];
        $teams = 0;
        if ($gameweek !== null && $gameweek > 1) {
            foreach (FnlTeam::with('entries')->get() as $team) {
                $entry = $team->entries->where('gameweek', '<=', $gameweek - 1)->sortByDesc('gameweek')->first();
                if (! $entry) {
                    continue;
                }
                $teams++;
                foreach ([...$entry->starters, ...$entry->bench] as $id) {
                    $owners[$id] = ($owners[$id] ?? 0) + 1;
                }
            }
        }
        $average = count($pool) ? array_sum(self::SQUAD) / count($pool) : 0;
        $out = [];
        foreach ($pool as $id => $p) {
            $base = self::price($p['rating']);
            $share = $teams ? ($owners[$id] ?? 0) / $teams : 0;
            $steps = $teams ? (int) round(($share - $average) * 10) : 0;
            $change = max(-self::MAX_PRICE_CHANGE, min(self::MAX_PRICE_CHANGE, $steps * self::PRICE_STEP));
            $out[$id] = [
                'position' => $p['position'],
                'base' => $base,
                'price' => round(max(3.0, $base + $change), 1),
                'change' => round($change, 1),
                'owned' => round($share * 100),
            ];
        }

        return $out;
    }

    /** Gameweek N is league Sunday N; changes close at its 9pm kick-off. */
    public static function deadline(int $gameweek): CarbonImmutable
    {
        return CarbonImmutable::parse(LeagueMatchDaySync::FIRST_NIGHT.' '.self::DEADLINE_HOUR.':00', MatchDaySchedule::TIMEZONE)
            ->addWeeks($gameweek - 1);
    }

    /** Past the deadline, or the night has already kicked off (an early start still locks it). */
    public static function locked(int $gameweek): bool
    {
        if (now()->gte(self::deadline($gameweek)) || LeagueState::current()->live_night === $gameweek) {
            return true;
        }

        return LeagueResult::whereIn('match_no', LeagueMatchDaySync::matchNumbers($gameweek))
            ->whereIn('status', ['live', 'final'])->exists();
    }

    /** The gameweek squads are being picked for now, or null once the last one has started. */
    public static function openGameweek(): ?int
    {
        for ($gw = 1; $gw <= LeagueController::NIGHTS; $gw++) {
            if (! self::locked($gw)) {
                return $gw;
            }
        }

        return null;
    }

    /**
     * Free transfers a team has for a gameweek: unlimited (null) for its
     * first squad, then one a week, an unused one rolling over to a
     * maximum of two. A wildcard week resets it to one.
     */
    public static function freeTransfers(FnlTeam $team, int $gameweek): ?int
    {
        $entries = $team->entries()->where('gameweek', '<', $gameweek)->get()->keyBy('gameweek');
        if ($entries->isEmpty()) {
            return null;
        }
        $first = $entries->keys()->min();
        $free = 1;
        for ($gw = $first + 1; $gw < $gameweek; $gw++) {
            $entry = $entries[$gw] ?? null;
            $free = $entry?->chip === 'wildcard'
                ? 1
                : min(self::MAX_FREE_TRANSFERS, max(0, $free - ($entry?->transfers ?? 0)) + 1);
        }

        return $free;
    }

    /** The squad a team carries into a gameweek: its latest entry up to then. */
    public static function entryFor(FnlTeam $team, int $gameweek): ?FnlEntry
    {
        return $team->entries()->where('gameweek', '<=', $gameweek)->orderByDesc('gameweek')->first();
    }
}
