<?php

namespace App\Support;

use App\Models\ClubSetting;
use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\PlayerRatingChange;

/**
 * Moves each squad player's rating after a match day, based on how they and
 * their team performed in its finished games:
 *
 *  - every game: a win nudges the whole side up, a loss nudges it down;
 *  - goals and assists reward whoever made them (own goals cost a little);
 *  - a clean sheet rewards the back line most — keepers, then defenders,
 *    then midfielders.
 *
 * The day's points are scaled so gains shrink as a rating nears the ceiling
 * and losses shrink as it nears the floor, capped per match day, then clamped
 * to [MIN, MAX]. Each application is recorded in player_rating_changes, which
 * also makes re-ending a match day a no-op.
 *
 * The constants below are the defaults; the club's actual weights come from
 * ClubSetting (admin Settings → Player ratings).
 */
class PlayerRatings
{
    public const MIN = 4.0;

    public const MAX = 9.5;

    public const DEFAULT = 6.0;

    private const WIN = 0.10;

    private const LOSS = -0.10;

    private const GOAL = 0.12;

    private const ASSIST = 0.08;

    private const OWN_GOAL = -0.08;

    private const CLEAN_SHEET = ['GK' => 0.15, 'DEF' => 0.12, 'MID' => 0.05, 'FWD' => 0.0];

    /** Most a rating can move in a single match day, either way. */
    private const MAX_SWING = 0.5;

    public static function apply(MatchDayEvent $event): void
    {
        $weights = ClubSetting::current()->ratingWeights();
        $players = Player::all()->keyBy('number');
        $points = self::points($event, fn (int $number) => $players[$number]->position ?? null, $weights);

        foreach ($points as $number => $raw) {
            $player = $players[$number];
            if (PlayerRatingChange::where('player_id', $player->id)->where('match_day_event_id', $event->id)->exists()) {
                continue;
            }

            $before = (float) $player->rating;
            $after = self::adjust($before, $raw, $weights['max_swing']);

            PlayerRatingChange::create([
                'player_id' => $player->id,
                'match_day_event_id' => $event->id,
                'points' => round($raw, 2),
                'rating_before' => $before,
                'rating_after' => $after,
            ]);

            if ($after !== $before) {
                $player->update(['rating' => $after]);
            }
        }
    }

    /**
     * @return array{win: float, loss: float, goal: float, assist: float, own_goal: float, clean_sheet: array<string, float>, max_swing: float}
     */
    public static function defaultWeights(): array
    {
        return [
            'win' => self::WIN,
            'loss' => self::LOSS,
            'goal' => self::GOAL,
            'assist' => self::ASSIST,
            'own_goal' => self::OWN_GOAL,
            'clean_sheet' => self::CLEAN_SHEET,
            'max_swing' => self::MAX_SWING,
        ];
    }

    /**
     * Raw performance points per squad number across the event's finished
     * games. Guests (non-int participant ids) are skipped.
     *
     * @param  callable(int): ?string  $positionOf
     * @param  array<string, mixed>|null  $weights  as ClubSetting::ratingWeights(); null uses the defaults
     * @return array<int, float>
     */
    public static function points(MatchDayEvent $event, callable $positionOf, ?array $weights = null): array
    {
        $weights ??= self::defaultWeights();
        $points = [];
        $add = function ($number, float $amount) use (&$points, $positionOf) {
            if (is_int($number) && $positionOf($number) !== null) {
                $points[$number] = ($points[$number] ?? 0.0) + $amount;
            }
        };

        foreach (($event->games ?? []) as $game) {
            if (($game['status'] ?? null) !== 'finished') {
                continue;
            }

            $teams = array_values($game['teams'] ?? []);
            $score = [0, 0];
            foreach (($game['goals'] ?? []) as $goal) {
                $score[($goal['teamIndex'] ?? 0) === 1 ? 1 : 0]++;
            }

            foreach ($teams as $i => $team) {
                if ($i > 1) {
                    break;
                }
                $for = $score[$i];
                $against = $score[1 - $i];
                $result = $for > $against ? $weights['win'] : ($for < $against ? $weights['loss'] : 0.0);

                foreach (($team['players'] ?? []) as $number) {
                    $add($number, $result);
                    if ($against === 0 && is_int($number)) {
                        $add($number, $weights['clean_sheet'][$positionOf($number)] ?? 0.0);
                    }
                }
            }

            foreach (($game['goals'] ?? []) as $goal) {
                $ownGoal = (bool) ($goal['ownGoal'] ?? false);
                $add($goal['playerId'] ?? null, $ownGoal ? $weights['own_goal'] : $weights['goal']);
                $add($goal['assistPlayerId'] ?? null, $weights['assist']);
            }
        }

        return $points;
    }

    /**
     * Turns raw points into a new rating. Gains are scaled by the headroom
     * left below MAX and losses by the room left above MIN (both 1x at the
     * midpoint, up to 1.5x far from the limit), so ratings drift toward the
     * middle unless a player keeps performing.
     */
    public static function adjust(float $rating, float $raw, float $maxSwing = self::MAX_SWING): float
    {
        $range = self::MAX - self::MIN;
        $room = $raw >= 0 ? self::MAX - $rating : $rating - self::MIN;
        $factor = max(0.0, min(1.5, 2 * $room / $range));

        $delta = max(-$maxSwing, min($maxSwing, $raw * $factor));

        return round(max(self::MIN, min(self::MAX, $rating + $delta)), 2);
    }
}
