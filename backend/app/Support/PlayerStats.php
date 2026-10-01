<?php

namespace App\Support;

use App\Models\Player;

/**
 * Computes per-player (keyed by player id) Match Day stats (appearances/goals/assists/
 * clean sheets/saves/cards) by scanning finished games across all match day events.
 * Computed on read rather than stored, since event volume for a grassroots
 * club is small enough that this stays cheap and avoids a recalculation
 * step every time a match day is edited.
 */
class PlayerStats
{
    /**
     * Forwards never keep clean sheets — it's a stat for the back of the
     * side — so players in $forwardIds (see forwardIds()) aren't credited.
     *
     * @param  iterable<\App\Models\MatchDayEvent>  $events
     * @param  array<int, int>  $forwardIds
     * @return array<int, array{appearances: int, goals: int, assists: int, cleanSheets: int, saves: int, yellowCards: int, redCards: int}>
     */
    public static function computeAll(iterable $events, array $forwardIds = []): array
    {
        $stats = [];

        $ensure = function (int $playerId) use (&$stats) {
            $stats[$playerId] ??= ['appearances' => 0, 'goals' => 0, 'assists' => 0, 'cleanSheets' => 0, 'saves' => 0, 'yellowCards' => 0, 'redCards' => 0];
        };

        foreach ($events as $event) {
            foreach (($event->games ?? []) as $game) {
                if (($game['status'] ?? null) !== 'finished') {
                    continue;
                }

                $teams = array_values($game['teams'] ?? []);

                foreach ($teams as $teamIndex => $team) {
                    foreach (($team['players'] ?? []) as $participantId) {
                        if (! is_int($participantId)) {
                            continue; // guests aren't squad players
                        }
                        $ensure($participantId);
                        $stats[$participantId]['appearances']++;
                    }
                }

                $scoreByTeam = [0 => 0, 1 => 0];
                foreach (($game['goals'] ?? []) as $goal) {
                    $teamIndex = $goal['teamIndex'] ?? 0;
                    $scoreByTeam[$teamIndex] = ($scoreByTeam[$teamIndex] ?? 0) + 1;
                }

                foreach (($game['goals'] ?? []) as $goal) {
                    $playerId = $goal['playerId'] ?? null;
                    $assistId = $goal['assistPlayerId'] ?? null;
                    $ownGoal = (bool) ($goal['ownGoal'] ?? false);

                    if (! $ownGoal && is_int($playerId)) {
                        $ensure($playerId);
                        $stats[$playerId]['goals']++;
                    }

                    if (is_int($assistId)) {
                        $ensure($assistId);
                        $stats[$assistId]['assists']++;
                    }
                }

                foreach (($game['cards'] ?? []) as $card) {
                    $playerId = $card['playerId'] ?? null;
                    if (! is_int($playerId)) {
                        continue;
                    }
                    $ensure($playerId);
                    $stats[$playerId][($card['type'] ?? 'yellow') === 'red' ? 'redCards' : 'yellowCards']++;
                }

                // One entry per save; only keepers can be credited (see the match day screen).
                foreach (($game['saves'] ?? []) as $save) {
                    $playerId = $save['playerId'] ?? null;
                    if (! is_int($playerId)) {
                        continue;
                    }
                    $ensure($playerId);
                    $stats[$playerId]['saves']++;
                }

                foreach ($teams as $teamIndex => $team) {
                    $opponentIndex = $teamIndex === 0 ? 1 : 0;
                    if (($scoreByTeam[$opponentIndex] ?? 0) !== 0) {
                        continue;
                    }
                    foreach (($team['players'] ?? []) as $participantId) {
                        if (! is_int($participantId) || in_array($participantId, $forwardIds, true)) {
                            continue;
                        }
                        $ensure($participantId);
                        $stats[$participantId]['cleanSheets']++;
                    }
                }
            }
        }

        return $stats;
    }

    /**
     * Ids of players whose main position is forward, as ratings go by the
     * main position too.
     *
     * @return array<int, int>
     */
    public static function forwardIds(): array
    {
        return Player::query()->where('position', 'FWD')->pluck('id')->all();
    }

    /**
     * The "roughest player" — whoever picked up the most cards, ties going to
     * the one with more reds. Null when nobody was booked.
     *
     * @param  array<int, array{yellowCards: int, redCards: int}>  $stats  as computeAll()
     */
    public static function roughest(array $stats): ?int
    {
        $top = null;
        $topKey = null;
        foreach ($stats as $playerId => $s) {
            $key = [$s['yellowCards'] + $s['redCards'], $s['redCards']];
            if ($key[0] > 0 && ($topKey === null || $key > $topKey)) {
                [$top, $topKey] = [$playerId, $key];
            }
        }

        return $top;
    }
}
