<?php

namespace App\Support;

/**
 * Computes per-player-number Match Day stats (appearances/goals/assists/
 * clean sheets) by scanning finished games across all match day events.
 * Computed on read rather than stored, since event volume for a grassroots
 * club is small enough that this stays cheap and avoids a recalculation
 * step every time a match day is edited.
 */
class PlayerStats
{
    /**
     * @param  iterable<\App\Models\MatchDayEvent>  $events
     * @return array<int, array{appearances: int, goals: int, assists: int, cleanSheets: int}>
     */
    public static function computeAll(iterable $events): array
    {
        $stats = [];

        $ensure = function (int $number) use (&$stats) {
            $stats[$number] ??= ['appearances' => 0, 'goals' => 0, 'assists' => 0, 'cleanSheets' => 0];
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
}
