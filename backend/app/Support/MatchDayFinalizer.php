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
        $squadIds = Player::pluck('id')->all();
        $settings = ClubSetting::current();

        if ($settings->fines_from_match_day) {
            self::recordCards($event, $squadIds);
        }
        if ($settings->ratings_enabled) {
            PlayerRatings::apply($event);
        }
        if ($settings->vale_auto_awards) {
            self::updateWeeklyAwards($event, $squadIds);
        }
    }

    /**
     * Undoes everything finalize() did, ahead of the event being deleted:
     * removes the cards it created, rolls back the rating moves it made, and
     * — if The Vale is still showing this match day — rebuilds the weekly
     * awards from the latest other ended match day (or clears them). Stats
     * need no step: PlayerStats stops counting the event once it's gone.
     */
    public static function revert(MatchDayEvent $event): void
    {
        self::cardsOf($event)->each(fn ($card) => $card->delete());
        self::rollBackRatings($event);

        // With automatic awards off, The Vale is maintained by hand — leave it.
        if (! ClubSetting::current()->vale_auto_awards || ! self::valeShows($event)) {
            return;
        }

        self::clearWeeklyAwards();
        self::awardLatestExcept($event->id);
    }

    /**
     * Brings everything an already-ended match day fed into back in line
     * after its record was edited (a game deleted, a goal or card fixed):
     * cards and fines follow the games' cards — keeping paid status for the
     * ones that survive — ratings are rolled back and re-applied, and The
     * Vale is rebuilt if it was showing this match day.
     *
     * @param  bool  $valeShowedIt  whether The Vale showed this match day before
     *                              the edit (its title or date may have changed)
     */
    public static function reapply(MatchDayEvent $event, bool $valeShowedIt): void
    {
        $squadIds = Player::pluck('id')->all();
        $settings = ClubSetting::current();

        self::syncCards($event, $squadIds, $settings->fines_from_match_day);

        if ($settings->ratings_enabled) {
            self::rollBackRatings($event);
            PlayerRatings::apply($event);
        }

        if ($settings->vale_auto_awards && $valeShowedIt) {
            self::clearWeeklyAwards();
            if (self::hasFinishedGames($event)) {
                self::updateWeeklyAwards($event, $squadIds);
            } else {
                self::awardLatestExcept($event->id);
            }
        }
    }

    /**
     * Titles aren't typed by the admin: every match day is "Matchday N",
     * numbered by when it was created. Run after one is added or deleted so
     * the numbers stay 1, 2, 3… with no gaps. The Vale keeps a copy of the
     * title it shows (and quotes it in its notes), so that follows along.
     */
    public static function renumber(): void
    {
        $vale = null;
        $valeChanges = [];

        $events = MatchDayEvent::query()->orderBy('created_at')->orderBy('id')->get();
        foreach ($events->values() as $i => $event) {
            $title = 'Matchday '.($i + 1);
            if ($event->title === $title) {
                continue;
            }
            if ($valeChanges === [] && self::valeShows($event)) {
                $vale = ValeContent::current();
                $valeChanges = [
                    'team_week_title' => $title,
                    'potw_note' => self::retitle($vale->potw_note, $event->title, $title),
                    'improved_note' => self::retitle($vale->improved_note, $event->title, $title),
                ];
            }
            $event->update(['title' => $title]);
        }

        if ($vale) {
            $vale->update($valeChanges);
        }
    }

    private static function retitle(?string $note, string $from, string $to): ?string
    {
        return $note === null ? null : preg_replace('/'.preg_quote($from, '/').'\.$/', "{$to}.", $note);
    }

    /** Whether The Vale's weekly awards currently come from this match day. */
    public static function valeShows(MatchDayEvent $event): bool
    {
        $awards = ValeContent::current();

        return $awards->team_week_title === $event->title && $awards->team_week_date_range === $event->date;
    }

    /**
     * The disciplinary cards created from this event's games.
     *
     * @return \Illuminate\Support\Collection<int, Card>
     */
    private static function cardsOf(MatchDayEvent $event)
    {
        return Card::whereNotNull('match_day_ref')
            ->get()
            ->filter(fn ($card) => str_starts_with($card->match_day_ref, "{$event->id}:"));
    }

    private static function rollBackRatings(MatchDayEvent $event): void
    {
        $changes = PlayerRatingChange::query()
            ->where('match_day_event_id', $event->id)
            ->with('player')
            ->get();
        foreach ($changes as $change) {
            if ($change->player) {
                $delta = (float) $change->rating_after - (float) $change->rating_before;
                $rating = round((float) $change->player->rating - $delta, 2);
                $change->player->update([
                    'rating' => max(PlayerRatings::MIN, min(PlayerRatings::MAX, $rating)),
                ]);
            }
            $change->delete();
        }
    }

    private static function hasFinishedGames(MatchDayEvent $event): bool
    {
        return collect($event->games ?? [])->contains(fn ($g) => ($g['status'] ?? null) === 'finished');
    }

    private static function clearWeeklyAwards(): void
    {
        ValeContent::current()->update([
            'team_week_title' => null,
            'team_week_date_range' => null,
            'team_sessions_won' => 0,
            'team_sessions_played' => 0,
            'team_rival' => null,
            'team_score' => null,
            'team_lineup_player_ids' => null,
            'potw_player_id' => null,
            'potw_note' => null,
            'potw_rating' => null,
            'improved_player_id' => null,
            'improved_note' => null,
            'improved_prev_rating' => null,
            'improved_curr_rating' => null,
            'leader_top_scorer_player_id' => null,
            'leader_top_scorer_value' => null,
            'leader_top_assist_player_id' => null,
            'leader_top_assist_value' => null,
            'leader_top_saves_player_id' => null,
            'leader_top_saves_value' => null,
            'leader_clean_sheet_player_ids' => null,
            'leader_clean_sheet_team' => null,
            'leader_clean_sheet_value' => null,
            'leader_bad_boys' => null,
            'flop_player_id' => null,
            'flop_note' => null,
        ]);
    }

    /** Rebuilds The Vale from the latest other ended match day with a finished game, if any. */
    private static function awardLatestExcept(string $eventId): void
    {
        $previous = MatchDayEvent::query()
            ->where('id', '!=', $eventId)
            ->where('status', 'ended')
            ->orderByDesc('created_at')
            ->get()
            ->first(fn ($e) => self::hasFinishedGames($e));
        if ($previous) {
            self::updateWeeklyAwards($previous, Player::pluck('id')->all());
        }
    }

    /**
     * Makes the event's disciplinary cards match its games' cards: drops the
     * ones whose match day card is gone, corrects the rest (a changed card
     * type re-prices an unpaid fine) and, when fines are on, adds new ones.
     *
     * @param  array<int, int>  $squadIds
     */
    private static function syncCards(MatchDayEvent $event, array $squadIds, bool $createMissing): void
    {
        $settings = ClubSetting::current();
        $wanted = self::matchDayCards($event, $squadIds);

        foreach (self::cardsOf($event) as $card) {
            $source = $wanted[$card->match_day_ref] ?? null;
            if (! $source) {
                $card->delete();

                continue;
            }
            $changes = [
                'player_id' => $source['playerId'],
                'type' => $source['type'],
                'reason' => $source['reason'],
            ];
            if ($card->type !== $source['type'] && ! $card->paid) {
                $changes['fine_amount'] = $source['type'] === 'red' ? $settings->red_card_fine : $settings->yellow_card_fine;
            }
            $card->update($changes);
        }

        if ($createMissing) {
            self::recordCards($event, $squadIds);
        }
    }

    /**
     * The event's squad-player cards, keyed by their disciplinary match_day_ref.
     *
     * @param  array<int, int>  $squadIds
     * @return array<string, array{playerId: int, type: string, reason: ?string}>
     */
    private static function matchDayCards(MatchDayEvent $event, array $squadIds): array
    {
        $cards = [];
        foreach (($event->games ?? []) as $game) {
            foreach (($game['cards'] ?? []) as $card) {
                $playerId = $card['playerId'] ?? null;
                if (! is_int($playerId) || ! in_array($playerId, $squadIds, true)) {
                    continue; // guests carry no fines
                }
                $cards["{$event->id}:{$game['id']}:{$card['id']}"] = [
                    'playerId' => $playerId,
                    'type' => ($card['type'] ?? 'yellow') === 'red' ? 'red' : 'yellow',
                    'reason' => $card['reason'] ?? null,
                ];
            }
        }

        return $cards;
    }

    /**
     * @param  array<int, int>  $squadIds
     */
    private static function recordCards(MatchDayEvent $event, array $squadIds): void
    {
        $settings = ClubSetting::current();

        foreach (self::matchDayCards($event, $squadIds) as $ref => $card) {
            Card::firstOrCreate(
                ['match_day_ref' => $ref],
                [
                    'player_id' => $card['playerId'],
                    'type' => $card['type'],
                    'reason' => $card['reason'],
                    'fine_amount' => $card['type'] === 'red' ? $settings->red_card_fine : $settings->yellow_card_fine,
                    'paid' => false,
                    'occurred_on' => now()->toDateString(),
                ]
            );
        }
    }

    /**
     * The side with the most wins across this event's finished games (ties
     * broken by goal difference), with its lineup, rival and score. Pure and
     * read-only — used both to rewrite The Vale on finalize() and to answer
     * "what was the team of the week for match day X" for any past event.
     *
     * @param  array<int, int>  $squadIds
     * @return array{sessionsWon: int, sessionsPlayed: int, rivalTeam: string, score: string, lineupPlayerIds: int[]}|null
     */
    public static function computeTeamOfWeek(MatchDayEvent $event, array $squadIds): ?array
    {
        $teams = self::teamTable($event, $squadIds);
        if ($teams === []) {
            return null;
        }
        $best = reset($teams);

        return [
            'sessionsWon' => $best['won'],
            'sessionsPlayed' => $best['played'],
            'rivalTeam' => $best['rival'],
            'score' => $best['score'],
            'lineupPlayerIds' => $best['players'],
        ];
    }

    /**
     * The side that kept the most clean sheets this match day. A tie goes to
     * the team of the week (then on down the same wins/goal-difference order).
     * Null when nobody kept one. Forwards are left off the player list.
     *
     * @param  array<int, int>  $squadIds
     * @param  array<int, int>  $forwardIds
     * @return array{name: string, value: int, playerIds: int[]}|null
     */
    public static function computeCleanSheetTeam(MatchDayEvent $event, array $squadIds, array $forwardIds = []): ?array
    {
        $teams = self::teamTable($event, $squadIds);
        // uasort is stable, so teams level on clean sheets keep the
        // team-of-the-week order teamTable() already sorted them into.
        uasort($teams, fn ($a, $b) => $b['cleanSheets'] <=> $a['cleanSheets']);
        $name = array_key_first($teams);
        if ($name === null || $teams[$name]['cleanSheets'] === 0) {
            return null;
        }

        return [
            'name' => (string) $name,
            'value' => $teams[$name]['cleanSheets'],
            'playerIds' => array_values(array_diff($teams[$name]['players'], $forwardIds)),
        ];
    }

    /**
     * The flop team of the week — the side at the bottom of the same
     * wins/goal-difference table the team of the week tops. Null unless at
     * least two sides played.
     *
     * @param  array<int, int>  $squadIds
     * @return array{name: string, won: int, played: int, gd: int, lineupPlayerIds: int[]}|null
     */
    public static function computeFlopTeam(MatchDayEvent $event, array $squadIds): ?array
    {
        $teams = self::teamTable($event, $squadIds);
        if (count($teams) < 2) {
            return null;
        }
        $worst = end($teams);

        return [
            'name' => (string) array_key_last($teams),
            'won' => $worst['won'],
            'played' => $worst['played'],
            'gd' => $worst['gd'],
            'lineupPlayerIds' => $worst['players'],
        ];
    }

    /**
     * The Vale's flop-of-the-week columns for this match day.
     *
     * @param  array<int, int>  $squadIds
     * @return array{flop_player_id: ?int, flop_note: ?string}
     */
    public static function flopFields(MatchDayEvent $event, array $squadIds): array
    {
        $flop = self::computeFlopPlayer($event, $squadIds);

        return [
            'flop_player_id' => $flop['playerId'] ?? null,
            'flop_note' => $flop ? sprintf(
                'Lost %d of %d game%s (%+d goal difference) with %d goal involvement%s at %s.',
                $flop['lost'], $flop['played'], $flop['played'] === 1 ? '' : 's',
                $flop['gd'],
                $flop['involvements'], $flop['involvements'] === 1 ? '' : 's',
                $event->title,
            ) : null,
        ];
    }

    /**
     * The flop player of the week — the squad player who lost the most
     * games, then had the worst goal difference on the pitch, then the
     * fewest goals and assists. There is always one, even on a day of
     * draws — null only when no squad player finished a game.
     *
     * @param  array<int, int>  $squadIds
     * @return array{playerId: int, played: int, lost: int, gd: int, involvements: int}|null
     */
    public static function computeFlopPlayer(MatchDayEvent $event, array $squadIds): ?array
    {
        $rows = [];
        foreach (($event->games ?? []) as $game) {
            if (($game['status'] ?? null) !== 'finished') {
                continue;
            }
            $score = [0, 0];
            foreach (($game['goals'] ?? []) as $goal) {
                $score[($goal['teamIndex'] ?? 0) === 1 ? 1 : 0]++;
            }
            foreach ([0, 1] as $i) {
                foreach (($game['teams'][$i]['players'] ?? []) as $playerId) {
                    if (! is_int($playerId) || ! in_array($playerId, $squadIds, true)) {
                        continue;
                    }
                    $rows[$playerId] ??= ['played' => 0, 'lost' => 0, 'gd' => 0, 'involvements' => 0];
                    $rows[$playerId]['played']++;
                    $rows[$playerId]['lost'] += $score[$i] < $score[1 - $i] ? 1 : 0;
                    $rows[$playerId]['gd'] += $score[$i] - $score[1 - $i];
                }
            }
            foreach (($game['goals'] ?? []) as $goal) {
                foreach ([($goal['ownGoal'] ?? false) ? null : ($goal['playerId'] ?? null), $goal['assistPlayerId'] ?? null] as $id) {
                    if (is_int($id) && isset($rows[$id])) {
                        $rows[$id]['involvements']++;
                    }
                }
            }
        }

        $flop = null;
        foreach ($rows as $playerId => $r) {
            $key = [$r['lost'], -$r['gd'], -$r['involvements']];
            if ($flop === null || $key > $flop['key']) {
                $flop = ['playerId' => $playerId, 'key' => $key] + $r;
            }
        }
        return $flop ? array_diff_key($flop, ['key' => true]) : null;
    }

    /**
     * Every side (by team name) across this event's finished games, best
     * first by wins then goal difference.
     *
     * @param  array<int, int>  $squadIds
     * @return array<string, array{won: int, played: int, gd: int, cleanSheets: int, players: int[], rival: string, score: string}>
     */
    private static function teamTable(MatchDayEvent $event, array $squadIds): array
    {
        $inSquad = fn ($id) => is_int($id) && in_array($id, $squadIds, true);

        $teams = [];
        foreach (($event->games ?? []) as $game) {
            if (($game['status'] ?? null) !== 'finished') {
                continue;
            }
            $score = [0, 0];
            foreach (($game['goals'] ?? []) as $goal) {
                $score[($goal['teamIndex'] ?? 0) === 1 ? 1 : 0]++;
            }
            foreach ([0, 1] as $i) {
                $name = $game['teams'][$i]['name'] ?? "Team {$i}";
                $teams[$name] ??= ['won' => 0, 'played' => 0, 'gd' => 0, 'cleanSheets' => 0, 'players' => [], 'rival' => '', 'score' => ''];
                $t = &$teams[$name];
                $t['played']++;
                $t['won'] += $score[$i] > $score[1 - $i] ? 1 : 0;
                $t['gd'] += $score[$i] - $score[1 - $i];
                $t['cleanSheets'] += $score[1 - $i] === 0 ? 1 : 0;
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

        return $teams;
    }

    /**
     * The standout player from one match day's stats — most goal
     * involvements, then goals, then clean sheets. Null when nobody scored,
     * assisted or kept a clean sheet.
     *
     * @param  array<int, array{goals: int, assists: int, cleanSheets: int}>  $stats  keyed by player id
     * @return array{playerId: int, stats: array<string, int>}|null
     */
    public static function computePlayerOfTheDay(array $stats): ?array
    {
        $best = null;
        foreach ($stats as $playerId => $s) {
            $key = [$s['goals'] + $s['assists'], $s['goals'], $s['cleanSheets']];
            if ($key[0] + $key[2] > 0 && ($best === null || $key > $best['key'])) {
                $best = ['playerId' => $playerId, 'key' => $key, 'stats' => $s];
            }
        }

        return $best ? ['playerId' => $best['playerId'], 'stats' => $best['stats']] : null;
    }

    /**
     * How many times each player (keyed by id) has been player of the week
     * and been picked in the team of the week: once for every ended match
     * day they stood out in (computePlayerOfTheDay / computeTeamOfWeek), with
     * The Vale's current picks — automatic or set by the committee — counting
     * for the match day it's showing.
     *
     * @return array<int, array{playerOfTheWeek: int, teamOfTheWeek: int}>
     */
    public static function weeklyHonours(): array
    {
        $squadIds = Player::pluck('id')->all();
        $forwardIds = PlayerStats::forwardIds();
        $vale = ValeContent::current();

        $honours = [];
        $award = function (?int $playerId, string $key) use (&$honours) {
            if ($playerId !== null) {
                $honours[$playerId] ??= ['playerOfTheWeek' => 0, 'teamOfTheWeek' => 0];
                $honours[$playerId][$key]++;
            }
        };

        $events = MatchDayEvent::query()->where('status', 'ended')->get();
        foreach ($events as $event) {
            if ($vale->team_week_title === $event->title && $vale->team_week_date_range === $event->date) {
                continue; // counted from The Vale below
            }
            $stats = array_intersect_key(PlayerStats::computeAll([$event], $forwardIds), array_flip($squadIds));
            $award(self::computePlayerOfTheDay($stats)['playerId'] ?? null, 'playerOfTheWeek');
            foreach (self::computeTeamOfWeek($event, $squadIds)['lineupPlayerIds'] ?? [] as $playerId) {
                $award($playerId, 'teamOfTheWeek');
            }
        }

        $award($vale->potw_player_id, 'playerOfTheWeek');
        foreach ($vale->team_lineup_player_ids ?? [] as $playerId) {
            $award((int) $playerId, 'teamOfTheWeek');
        }

        return $honours;
    }

    /** How many times this player has been player of the week (see weeklyHonours()). */
    public static function playerOfTheWeekWins(int $playerId): int
    {
        return self::weeklyHonours()[$playerId]['playerOfTheWeek'] ?? 0;
    }

    /**
     * @param  array<int, int>  $squadIds
     */
    private static function updateWeeklyAwards(MatchDayEvent $event, array $squadIds): void
    {
        $games = array_values(array_filter(
            $event->games ?? [],
            fn ($g) => ($g['status'] ?? null) === 'finished',
        ));
        if ($games === []) {
            return;
        }

        $inSquad = fn ($id) => is_int($id) && in_array($id, $squadIds, true);
        $awards = ValeContent::current();
        $changes = [
            'team_week_title' => $event->title,
            'team_week_date_range' => $event->date,
        ];

        $team = self::computeTeamOfWeek($event, $squadIds);
        if ($team) {
            $changes += [
                'team_sessions_won' => $team['sessionsWon'],
                'team_sessions_played' => $team['sessionsPlayed'],
                'team_rival' => $team['rivalTeam'],
                'team_score' => $team['score'],
                'team_lineup_player_ids' => $team['lineupPlayerIds'],
            ];
        }

        // Player of the week and weekly leaders — this match day's stats only.
        $stats = array_filter(
            PlayerStats::computeAll([$event], $forwardIds = PlayerStats::forwardIds()),
            fn ($playerId) => $inSquad($playerId),
            ARRAY_FILTER_USE_KEY,
        );

        $leader = function (string $key) use ($stats): ?int {
            $top = null;
            foreach ($stats as $playerId => $s) {
                if ($s[$key] > 0 && ($top === null || $s[$key] > $stats[$top][$key])) {
                    $top = $playerId;
                }
            }

            return $top;
        };

        $scorer = $leader('goals');
        $assister = $leader('assists');
        $keeper = $leader('saves');
        $changes += [
            'leader_top_scorer_player_id' => $scorer,
            'leader_top_scorer_value' => $scorer ? $stats[$scorer]['goals'] : 0,
            'leader_top_assist_player_id' => $assister,
            'leader_top_assist_value' => $assister ? $stats[$assister]['assists'] : 0,
            'leader_top_saves_player_id' => $keeper,
            'leader_top_saves_value' => $keeper ? $stats[$keeper]['saves'] : 0,
        ];

        $cleanSheetTeam = self::computeCleanSheetTeam($event, $squadIds, $forwardIds);
        $changes += [
            'leader_clean_sheet_team' => $cleanSheetTeam['name'] ?? null,
            'leader_clean_sheet_value' => $cleanSheetTeam['value'] ?? 0,
            'leader_clean_sheet_player_ids' => $cleanSheetTeam['playerIds'] ?? [],
        ];

        $changes['leader_bad_boys'] = PlayerStats::badBoys($stats);

        $changes += self::flopFields($event, $squadIds);

        $potw = self::computePlayerOfTheDay($stats);
        if ($potw) {
            $s = $potw['stats'];
            $changes += [
                'potw_player_id' => $potw['playerId'],
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
            ->filter(fn ($c) => $c->player && $inSquad($c->player->id)
                && (float) $c->rating_after > (float) $c->rating_before)
            ->sortBy([
                fn ($a, $b) => (float) $a->rating_before <=> (float) $b->rating_before,
                fn ($a, $b) => ((float) $b->rating_after - (float) $b->rating_before)
                    <=> ((float) $a->rating_after - (float) $a->rating_before),
            ])
            ->first();

        if ($improved) {
            $changes += [
                'improved_player_id' => $improved->player->id,
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
