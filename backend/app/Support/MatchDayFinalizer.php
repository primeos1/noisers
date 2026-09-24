<?php

namespace App\Support;

use App\Models\Card;
use App\Models\ClubSetting;
use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\PlayerRatingChange;
use App\Models\ValeContent;

/**
 * Runs once when the admin presses "End match day": turns the cards logged
 * during the games into disciplinary records (with fines), and rewrites The
 * Vale's weekly awards from that match day's results. Player stats need no
 * step here — PlayerStats computes them on read.
 */
class MatchDayFinalizer
{
    public static function finalize(MatchDayEvent $event): void
    {
        $numbers = Player::pluck('id', 'number');

        self::recordCards($event, $numbers->all());
        PlayerRatings::apply($event);
        self::updateWeeklyAwards($event, $numbers->keys()->all());
    }

    /**
     * @param  array<int, int>  $playerIdsByNumber
     */
    private static function recordCards(MatchDayEvent $event, array $playerIdsByNumber): void
    {
        $settings = ClubSetting::current();

        foreach (($event->games ?? []) as $game) {
            foreach (($game['cards'] ?? []) as $card) {
                $number = $card['playerId'] ?? null;
                if (! is_int($number) || ! isset($playerIdsByNumber[$number])) {
                    continue; // guests carry no fines
                }

                $type = ($card['type'] ?? 'yellow') === 'red' ? 'red' : 'yellow';

                Card::firstOrCreate(
                    ['match_day_ref' => "{$event->id}:{$game['id']}:{$card['id']}"],
                    [
                        'player_id' => $playerIdsByNumber[$number],
                        'type' => $type,
                        'reason' => $card['reason'] ?? null,
                        'fine_amount' => $type === 'red' ? $settings->red_card_fine : $settings->yellow_card_fine,
                        'paid' => false,
                        'occurred_on' => now()->toDateString(),
                    ]
                );
            }
        }
    }

    /**
     * The side with the most wins across this event's finished games (ties
     * broken by goal difference), with its lineup, rival and score. Pure and
     * read-only — used both to rewrite The Vale on finalize() and to answer
     * "what was the team of the week for match day X" for any past event.
     *
     * @param  array<int, int>  $squadNumbers
     * @return array{sessionsWon: int, sessionsPlayed: int, rivalTeam: string, score: string, lineupNumbers: int[]}|null
     */
    public static function computeTeamOfWeek(MatchDayEvent $event, array $squadNumbers): ?array
    {
        $games = array_values(array_filter(
            $event->games ?? [],
            fn ($g) => ($g['status'] ?? null) === 'finished',
        ));
        if ($games === []) {
            return null;
        }

        $inSquad = fn ($id) => is_int($id) && in_array($id, $squadNumbers, true);

        $teams = [];
        foreach ($games as $game) {
            $score = [0, 0];
            foreach (($game['goals'] ?? []) as $goal) {
                $score[($goal['teamIndex'] ?? 0) === 1 ? 1 : 0]++;
            }
            foreach ([0, 1] as $i) {
                $name = $game['teams'][$i]['name'] ?? "Team {$i}";
                $teams[$name] ??= ['won' => 0, 'played' => 0, 'gd' => 0, 'players' => [], 'rival' => '', 'score' => ''];
                $t = &$teams[$name];
                $t['played']++;
                $t['won'] += $score[$i] > $score[1 - $i] ? 1 : 0;
                $t['gd'] += $score[$i] - $score[1 - $i];
                $t['players'] = array_values(array_unique(array_merge(
                    $t['players'],
                    array_filter($game['teams'][$i]['players'] ?? [], $inSquad),
                )));
                $t['rival'] = $game['teams'][1 - $i]['name'] ?? '';
                $t['score'] = "{$score[$i]}–{$score[1 - $i]}";
                unset($t);
            }
        }
        uasort($teams, fn ($a, $b) => [$b['won'], $b['gd']] <=> [$a['won'], $a['gd']]);
        $best = reset($teams);

        return [
            'sessionsWon' => $best['won'],
            'sessionsPlayed' => $best['played'],
            'rivalTeam' => $best['rival'],
            'score' => $best['score'],
            'lineupNumbers' => $best['players'],
        ];
    }

    /**
     * @param  array<int, int>  $squadNumbers
     */
    private static function updateWeeklyAwards(MatchDayEvent $event, array $squadNumbers): void
    {
        $games = array_values(array_filter(
            $event->games ?? [],
            fn ($g) => ($g['status'] ?? null) === 'finished',
        ));
        if ($games === []) {
            return;
        }

        $inSquad = fn ($id) => is_int($id) && in_array($id, $squadNumbers, true);
        $awards = ValeContent::current();
        $changes = [
            'team_week_title' => $event->title,
            'team_week_date_range' => $event->date,
        ];

        $team = self::computeTeamOfWeek($event, $squadNumbers);
        if ($team) {
            $changes += [
                'team_sessions_won' => $team['sessionsWon'],
                'team_sessions_played' => $team['sessionsPlayed'],
                'team_rival' => $team['rivalTeam'],
                'team_score' => $team['score'],
                'team_lineup_numbers' => $team['lineupNumbers'],
            ];
        }

        // Player of the week and weekly leaders — this match day's stats only.
        $stats = array_filter(
            PlayerStats::computeAll([$event]),
            fn ($number) => $inSquad($number),
            ARRAY_FILTER_USE_KEY,
        );

        $leader = function (string $key) use ($stats): ?int {
            $top = null;
            foreach ($stats as $number => $s) {
                if ($s[$key] > 0 && ($top === null || $s[$key] > $stats[$top][$key])) {
                    $top = $number;
                }
            }

            return $top;
        };

        $scorer = $leader('goals');
        $assister = $leader('assists');
        $changes += [
            'leader_top_scorer_number' => $scorer,
            'leader_top_scorer_value' => $scorer ? $stats[$scorer]['goals'] : 0,
            'leader_top_assist_number' => $assister,
            'leader_top_assist_value' => $assister ? $stats[$assister]['assists'] : 0,
            'leader_clean_sheet_numbers' => array_keys(array_filter($stats, fn ($s) => $s['cleanSheets'] > 0)),
        ];

        $potw = null;
        foreach ($stats as $number => $s) {
            $key = [$s['goals'] + $s['assists'], $s['goals'], $s['cleanSheets']];
            if ($key[0] + $key[2] > 0 && ($potw === null || $key > $potw['key'])) {
                $potw = ['number' => $number, 'key' => $key, 'stats' => $s];
            }
        }
        if ($potw) {
            $s = $potw['stats'];
            $changes += [
                'potw_player_number' => $potw['number'],
                'potw_note' => sprintf(
                    '%d goal%s and %d assist%s across %d game%s at %s.',
                    $s['goals'], $s['goals'] === 1 ? '' : 's',
                    $s['assists'], $s['assists'] === 1 ? '' : 's',
                    $s['appearances'], $s['appearances'] === 1 ? '' : 's',
                    $event->title,
                ),
                'potw_rating' => min(10, round(6 + $s['goals'] + 0.5 * $s['assists'] + 0.5 * $s['cleanSheets'], 1)),
            ];
        }

        // Most improved — of the players whose rating rose this match day (set
        // by PlayerRatings::apply(), which runs earlier in finalize()), the one
        // who came in lowest; ties go to the bigger gain.
        $improved = PlayerRatingChange::query()
            ->where('match_day_event_id', $event->id)
            ->with('player')
            ->get()
            ->filter(fn ($c) => $c->player && $inSquad($c->player->number)
                && (float) $c->rating_after > (float) $c->rating_before)
            ->sortBy([
                fn ($a, $b) => (float) $a->rating_before <=> (float) $b->rating_before,
                fn ($a, $b) => ((float) $b->rating_after - (float) $b->rating_before)
                    <=> ((float) $a->rating_after - (float) $a->rating_before),
            ])
            ->first();

        if ($improved) {
            $changes += [
                'improved_player_number' => $improved->player->number,
                'improved_note' => sprintf(
                    'Rating climbed from %.2f to %.2f after %s.',
                    $improved->rating_before,
                    $improved->rating_after,
                    $event->title,
                ),
                'improved_prev_rating' => $improved->rating_before,
                'improved_curr_rating' => $improved->rating_after,
            ];
        }

        $awards->update($changes);
    }
}
