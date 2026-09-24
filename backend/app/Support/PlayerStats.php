<?php

namespace App\Support;

/**
 * Computes per-player-number Match Day stats (appearances/goals/assists/
 * clean sheets/cards) by scanning finished games across all match day events.
 * Computed on read rather than stored, since event volume for a grassroots
 * club is small enough that this stays cheap and avoids a recalculation
 * step every time a match day is edited.
 */
class PlayerStats
{
    /**
     * @param  iterable<\App\Models\MatchDayEvent>  $events
     * @return array<int, array{appearances: int, goals: int, assists: int, cleanSheets: int, yellowCards: int, redCards: int}>
     */
    public static function computeAll(iterable $events): array
    {
        $stats = [];

        $ensure = function (int $number) use (&$stats) {
            $stats[$number] ??= ['appearances' => 0, 'goals' => 0, 'assists' => 0, 'cleanSheets' => 0, 'yellowCards' => 0, 'redCards' => 0];
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

                foreach ($teams as $teamIndex => $team) {
                    $opponentIndex = $teamIndex === 0 ? 1 : 0;
                    if (($scoreByTeam[$opponentIndex] ?? 0) !== 0) {
                        continue;
                    }
                    foreach (($team['players'] ?? []) as $participantId) {
                        if (! is_int($participantId)) {
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
     * The "roughest player" — whoever picked up the most cards, ties going to
     * the one with more reds. Null when nobody was booked.
     *
     * @param  array<int, array{yellowCards: int, redCards: int}>  $stats  as computeAll()
     */
    public static function roughest(array $stats): ?int
    {
        $top = null;
        $topKey = null;
        foreach ($stats as $number => $s) {
            $key = [$s['yellowCards'] + $s['redCards'], $s['redCards']];
            if ($key[0] > 0 && ($topKey === null || $key > $topKey)) {
                [$top, $topKey] = [$number, $key];
            }
        }

        return $top;
    }
}
