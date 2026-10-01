<?php

namespace App\Support;

use App\Models\ClubSetting;
use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\PlayerRatingChange;

/**
 * Moves each squad player's rating after a match day, based on how they and
 * their team performed in its finished games. Every weight is set per
 * position (GK/DEF/MID/FWD), using the player's main position:
 *
 *  - every game: a win nudges the whole side up, a loss nudges it down;
 *  - goals and assists reward whoever made them (own goals cost a little);
 *  - a clean sheet rewards the side — by default the back line most;
 *  - each goal the side concedes can cost a little (off by default);
 *  - each save rewards the keeper who made it;
 *  - each card costs the player a little, a red more than a yellow.
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

    public const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

    /** Weight keys, each entered as a positive amount; these are penalties. */
    public const PENALTIES = ['loss', 'own_goal', 'goal_conceded', 'yellow_card', 'red_card'];

    /** The default weights every position shares, before clean sheets. */
    private const BASE = [
        'win' => 0.10,
        'loss' => 0.10,
        'goal' => 0.12,
        'assist' => 0.08,
        'own_goal' => 0.08,
        'clean_sheet' => 0.0,
        'goal_conceded' => 0.0,
        'save' => 0.03,
        'yellow_card' => 0.05,
        'red_card' => 0.15,
    ];

    private const CLEAN_SHEET = ['GK' => 0.15, 'DEF' => 0.12, 'MID' => 0.05, 'FWD' => 0.0];

    /** Most a rating can move in a single match day, either way. */
    private const MAX_SWING = 0.5;

    public static function apply(MatchDayEvent $event): void
    {
        $weights = ClubSetting::current()->ratingWeights();
        $players = Player::all()->keyBy('id');
        // The main position decides which weights apply; a second position doesn't.
        $points = self::points($event, fn (int $id) => $players[$id]->position ?? null, $weights);

        foreach ($points as $id => $raw) {
            $player = $players[$id];
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
     * Default weights per position, all as positive amounts — the shape
     * stored in club_settings.rating_position_weights.
     *
     * @return array<string, array<string, float>>
     */
    public static function defaultPositionWeights(): array
    {
        $weights = [];
        foreach (self::POSITIONS as $position) {
            $weights[$position] = ['clean_sheet' => self::CLEAN_SHEET[$position]] + self::BASE;
        }

        return $weights;
    }

    /**
     * Weights in the shape points() expects: per position, penalties negated.
     *
     * @param  array<string, array<string, float>>  $positionWeights  as defaultPositionWeights()
     * @return array{positions: array<string, array<string, float>>, max_swing: float}
     */
    public static function weights(array $positionWeights, float $maxSwing = self::MAX_SWING): array
    {
        $defaults = self::defaultPositionWeights();
        $positions = [];
        foreach (self::POSITIONS as $position) {
            foreach ($defaults[$position] as $key => $default) {
                $amount = abs((float) ($positionWeights[$position][$key] ?? $default));
                $positions[$position][$key] = in_array($key, self::PENALTIES, true) ? -$amount : $amount;
            }
        }

        return ['positions' => $positions, 'max_swing' => $maxSwing];
    }

    /**
     * Raw performance points per player id across the event's finished
     * games. Guests (non-int participant ids) are skipped.
     *
     * @param  callable(int): ?string  $positionOf
     * @param  array<string, mixed>|null  $weights  as weights(); null uses the defaults
     * @return array<int, float>
     */
    public static function points(MatchDayEvent $event, callable $positionOf, ?array $weights = null): array
    {
        $weights ??= self::weights(self::defaultPositionWeights());
        $points = [];
        // Adds $times lots of the weight $key for the player's position; a null
        // key still counts them as having played (a draw).
        $add = function ($playerId, ?string $key, int $times = 1) use (&$points, $positionOf, $weights) {
            $position = is_int($playerId) ? $positionOf($playerId) : null;
            if ($position === null || ! isset($weights['positions'][$position])) {
                return;
            }
            $amount = $key === null ? 0.0 : ($weights['positions'][$position][$key] ?? 0.0);
            $points[$playerId] = ($points[$playerId] ?? 0.0) + $amount * $times;
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
                $result = $for > $against ? 'win' : ($for < $against ? 'loss' : null);

                foreach (($team['players'] ?? []) as $playerId) {
                    $add($playerId, $result);
                    $add($playerId, $against === 0 ? 'clean_sheet' : 'goal_conceded', max(1, $against));
                }
            }

            foreach (($game['goals'] ?? []) as $goal) {
                $ownGoal = (bool) ($goal['ownGoal'] ?? false);
                $add($goal['playerId'] ?? null, $ownGoal ? 'own_goal' : 'goal');
                $add($goal['assistPlayerId'] ?? null, 'assist');
            }

            foreach (($game['cards'] ?? []) as $card) {
                $red = ($card['type'] ?? 'yellow') === 'red';
                $add($card['playerId'] ?? null, $red ? 'red_card' : 'yellow_card');
            }

            foreach (($game['saves'] ?? []) as $save) {
                $add($save['playerId'] ?? null, 'save');
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
