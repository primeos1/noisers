<?php

namespace App\Support;

use App\Models\Card;
use App\Models\ClubSetting;
use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\PlayerRatingChange;
use App\Models\ValeContent;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

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
        if (! ClubSetting::current()->vale_auto_awards) {
            return;
        }

        if (self::valeShows($event)) {
            self::clearWeeklyAwards();
            self::awardLatestExcept($event->id);
        } elseif ($shown = self::valeShownWeekMate($event)) {
            // The Vale shows the other match day of this week, whose team of
            // the week may have come from this one.
            self::updateWeeklyAwards($shown, Player::pluck('id')->all(), $event->id);
        }
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
        } elseif ($settings->vale_auto_awards && ($shown = self::valeShownWeekMate($event))) {
            self::updateWeeklyAwards($shown, $squadIds);
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

    /** The other match day of this one's week that The Vale is showing, if any. */
    private static function valeShownWeekMate(MatchDayEvent $event): ?MatchDayEvent
    {
        return self::weekEvents($event)->first(fn ($e) => $e->id !== $event->id && self::valeShows($e));
    }

    /**
     * Monday of the week this match day was played in. The stored date is a
     * label like "Sun 28 Sept" with no year, so the year comes from when the
     * match day was created; a label that can't be read falls back to that.
     */
    public static function weekOf(MatchDayEvent $event): CarbonImmutable
    {
        $created = CarbonImmutable::parse($event->created_at ?? now());
        $day = $created;
        if (preg_match('/(\d{1,2})\s+([A-Za-z]{3})/', (string) $event->date, $m)) {
            try {
                $parsed = CarbonImmutable::createFromFormat('!j M Y', "{$m[1]} ".ucfirst(strtolower($m[2]))." {$created->year}");
                // A late-December match day logged in early January, or the reverse.
                if ($parsed->diffInDays($created, true) > 180) {
                    $parsed = $parsed->addYears($parsed->lt($created) ? 1 : -1);
                }
                $day = $parsed;
            } catch (\Throwable) {
                // keep the created date
            }
        }

        return $day->startOfWeek(CarbonInterface::MONDAY)->startOfDay();
    }

    /**
     * Every ended match day with a finished game in the same week as this one
     * (the Wednesday and Sunday sessions), always including this one, oldest
     * first.
     *
     * @return Collection<int, MatchDayEvent>
     */
    public static function weekEvents(MatchDayEvent $event, ?string $exceptId = null): Collection
    {
        $week = self::weekOf($event);

        return MatchDayEvent::query()
            ->where('status', 'ended')
            ->where('id', '!=', $event->id)
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->get()
            ->filter(fn ($e) => self::hasFinishedGames($e) && self::weekOf($e)->equalTo($week))
            ->push($event)
            ->sortBy(fn ($e) => $e->created_at?->getTimestamp() ?? PHP_INT_MAX)
            ->values();
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
            self::updateWeeklyAwards($previous, Player::pluck('id')->all(), $eventId);
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
     * The shape of the team of the match day and the team of the week: one
     * keeper, two defenders, two midfielders and a forward.
     */
    public const TEAM_SLOTS = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD'];

    /**
     * The side with the most wins across this event's finished games (ties
     * broken by goal difference), with its lineup, rival and score — the
     * winners of a single match day. Pure and read-only.
     *
     * @param  array<int, int>  $squadIds
     * @return array{sessionsWon: int, sessionsPlayed: int, rivalTeam: string, score: string, lineupPlayerIds: int[]}|null
     */
    public static function computeBestSide(MatchDayEvent $event, array $squadIds): ?array
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
     * The team of the match day and the player of the match day: the day's
     * six best players by position (see TEAM_SLOTS), and its single
     * highest-rated player, from that day's finished games alone. Null when
     * no game finished. Pure and read-only.
     *
     * @param  array<int, int>  $squadIds
     * @return array{lineup: array<int, array{playerId: int, position: string, points: float, stats: array<string, int>}>, lineupPlayerIds: int[], playerOfMatchDay: array{playerId: int, position: string, points: float, stats: array<string, int>}|null}|null
     */
    public static function computeTeamOfMatchDay(MatchDayEvent $event, array $squadIds): ?array
    {
        if (! self::hasFinishedGames($event)) {
            return null;
        }
        $ranking = self::rankPlayers(collect([$event]), $squadIds);
        $lineup = self::pickTeam($ranking);

        return [
            'lineup' => $lineup,
            'lineupPlayerIds' => array_column($lineup, 'playerId'),
            'playerOfMatchDay' => self::topPlayer($ranking),
        ];
    }

    /**
     * The team of the week and the player of the week for this match day's
     * week: the same picks as computeTeamOfMatchDay(), but with each player's
     * points added up across all of the week's match days (Wednesday and
     * Sunday), so playing both counts. Pure and read-only — used both to
     * rewrite The Vale on finalize() and to answer "what was the team of the
     * week for match day X" for any past event.
     *
     * @param  array<int, int>  $squadIds
     * @param  ?string  $exceptId  a match day of the same week to leave out
     * @return array{lineup: array<int, array{playerId: int, position: string, points: float, stats: array<string, int>}>, lineupPlayerIds: int[], playerOfWeek: array{playerId: int, position: string, points: float, stats: array<string, int>}|null, weekMatchDays: MatchDayEvent[]}|null
     */
    public static function computeTeamOfWeek(MatchDayEvent $event, array $squadIds, ?string $exceptId = null): ?array
    {
        $days = self::weekEvents($event, $exceptId)->filter(fn ($e) => self::hasFinishedGames($e))->values();
        if ($days->isEmpty()) {
            return null;
        }
        $ranking = self::rankPlayers($days, $squadIds);
        $lineup = self::pickTeam($ranking);

        return [
            'lineup' => $lineup,
            'lineupPlayerIds' => array_column($lineup, 'playerId'),
            'playerOfWeek' => self::topPlayer($ranking),
            'weekMatchDays' => $days->all(),
        ];
    }

    /**
     * Every squad player who played on these match days, best first. Each is
     * scored with the club's rating weights (wins, goals, assists, clean
     * sheets, saves, cards — see PlayerRatings::points()) added up over the
     * days; ties go to more goal involvements, then saves, then games played.
     *
     * @param  Collection<int, MatchDayEvent>  $days
     * @param  array<int, int>  $squadIds
     * @return array{ranked: int[], points: array<int, float>, stats: array<int, array<string, int>>, players: Collection<int, Player>}
     */
    private static function rankPlayers(Collection $days, array $squadIds): array
    {
        $players = Player::query()->whereIn('id', $squadIds)->get()->keyBy('id');
        $weights = ClubSetting::current()->ratingWeights();
        $points = [];
        foreach ($days as $day) {
            foreach (PlayerRatings::points($day, fn (int $id) => $players[$id]->position ?? null, $weights) as $id => $p) {
                $points[$id] = ($points[$id] ?? 0.0) + $p;
            }
        }
        $stats = PlayerStats::computeAll($days, PlayerStats::noCleanSheetIds());

        $ranked = array_keys($points);
        usort($ranked, function ($a, $b) use ($points, $stats) {
            $key = fn ($id) => [
                round($points[$id], 4),
                ($stats[$id]['goals'] ?? 0) + ($stats[$id]['assists'] ?? 0),
                $stats[$id]['saves'] ?? 0,
                $stats[$id]['appearances'] ?? 0,
            ];

            return $key($b) <=> $key($a) ?: $a <=> $b;
        });

        return ['ranked' => $ranked, 'points' => $points, 'stats' => $stats, 'players' => $players];
    }

    /**
     * The best player for each of TEAM_SLOTS, in that order. A slot goes to
     * the player's main position first, then to someone whose second
     * position it is; it stays empty if nobody fits.
     *
     * @param  array{ranked: int[], points: array<int, float>, stats: array<int, array<string, int>>, players: Collection<int, Player>}  $ranking  as rankPlayers()
     * @return array<int, array{playerId: int, position: string, points: float, stats: array<string, int>}>
     */
    private static function pickTeam(array $ranking): array
    {
        $picked = [];
        $lineup = [];
        foreach (self::TEAM_SLOTS as $slot) {
            $choice = null;
            foreach (['position', 'secondary_position'] as $field) {
                foreach ($ranking['ranked'] as $id) {
                    if (! isset($picked[$id]) && ($ranking['players'][$id]->{$field} ?? null) === $slot) {
                        $choice = $id;
                        break 2;
                    }
                }
            }
            if ($choice !== null) {
                $picked[$choice] = true;
                $lineup[] = self::pick($ranking, $choice, $slot);
            }
        }

        return $lineup;
    }

    /**
     * The highest-rated player in the ranking, whatever their position.
     *
     * @param  array{ranked: int[], points: array<int, float>, stats: array<int, array<string, int>>, players: Collection<int, Player>}  $ranking  as rankPlayers()
     * @return array{playerId: int, position: string, points: float, stats: array<string, int>}|null
     */
    private static function topPlayer(array $ranking): ?array
    {
        $id = $ranking['ranked'][0] ?? null;

        return $id === null ? null : self::pick($ranking, $id, (string) $ranking['players'][$id]->position);
    }

    /**
     * @param  array{ranked: int[], points: array<int, float>, stats: array<int, array<string, int>>, players: Collection<int, Player>}  $ranking  as rankPlayers()
     * @return array{playerId: int, position: string, points: float, stats: array<string, int>}
     */
    private static function pick(array $ranking, int $id, string $position): array
    {
        return [
            'playerId' => $id,
            'position' => $position,
            'points' => round($ranking['points'][$id], 2),
            'stats' => $ranking['stats'][$id] ?? [],
        ];
    }

    /**
     * The side that kept the most clean sheets this match day. A tie goes to
     * the day's best side (then on down the same wins/goal-difference order).
     * Null when nobody kept one. Midfielders and forwards are left off the player list.
     *
     * @param  array<int, int>  $squadIds
     * @param  array<int, int>  $noCleanSheetIds
     * @return array{name: string, value: int, playerIds: int[]}|null
     */
    public static function computeCleanSheetTeam(MatchDayEvent $event, array $squadIds, array $noCleanSheetIds = []): ?array
    {
        $teams = self::teamTable($event, $squadIds);
        // uasort is stable, so teams level on clean sheets keep the
        // best-side order teamTable() already sorted them into.
        uasort($teams, fn ($a, $b) => $b['cleanSheets'] <=> $a['cleanSheets']);
        $name = array_key_first($teams);
        if ($name === null || $teams[$name]['cleanSheets'] === 0) {
            return null;
        }

        return [
            'name' => (string) $name,
            'value' => $teams[$name]['cleanSheets'],
            'playerIds' => array_values(array_diff($teams[$name]['players'], $noCleanSheetIds)),
        ];
    }

    /**
     * The flop team of the week — of each match day's bottom side (on the
     * same wins/goal-difference table computeBestSide() tops), the worst
     * across the week. Null unless two sides played on one of its match days.
     *
     * @param  array<int, int>  $squadIds
     * @return array{name: string, won: int, played: int, gd: int, lineupPlayerIds: int[]}|null
     */
    public static function computeFlopTeam(MatchDayEvent $event, array $squadIds): ?array
    {
        $worst = null;
        foreach (self::weekEvents($event) as $day) {
            $teams = self::teamTable($day, $squadIds);
            if (count($teams) < 2) {
                continue;
            }
            $bottom = end($teams);
            if ($worst === null || [$bottom['won'], $bottom['gd']] <= [$worst['won'], $worst['gd']]) {
                $worst = $bottom + ['name' => (string) array_key_last($teams)];
            }
        }
        if ($worst === null) {
            return null;
        }

        return [
            'name' => $worst['name'],
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
     * How many times each player (keyed by id) has been player of the week
     * and been picked in the team of the week: once for every week they
     * stood out in (computeTeamOfWeek), with The Vale's current picks —
     * automatic or set by the committee — counting for the week it's showing.
     *
     * @return array<int, array{playerOfTheWeek: int, teamOfTheWeek: int}>
     */
    public static function weeklyHonours(): array
    {
        $squadIds = Player::pluck('id')->all();
        $vale = ValeContent::current();

        $honours = [];
        $award = function (?int $playerId, string $key) use (&$honours) {
            if ($playerId !== null) {
                $honours[$playerId] ??= ['playerOfTheWeek' => 0, 'teamOfTheWeek' => 0];
                $honours[$playerId][$key]++;
            }
        };

        $events = MatchDayEvent::query()->where('status', 'ended')->get();
        $weeksCounted = [];
        foreach ($events as $event) {
            if ($vale->team_week_title === $event->title && $vale->team_week_date_range === $event->date) {
                $weeksCounted[self::weekOf($event)->toDateString()] = true; // counted from The Vale below
            }
        }

        // Both awards are picked once a week, across both its match days.
        foreach ($events as $event) {
            $week = self::weekOf($event)->toDateString();
            if (isset($weeksCounted[$week]) || ! self::hasFinishedGames($event)) {
                continue;
            }
            $weeksCounted[$week] = true;
            $team = self::computeTeamOfWeek($event, $squadIds);
            $award($team['playerOfWeek']['playerId'] ?? null, 'playerOfTheWeek');
            foreach ($team['lineupPlayerIds'] ?? [] as $playerId) {
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
    private static function updateWeeklyAwards(MatchDayEvent $event, array $squadIds, ?string $exceptId = null): void
    {
        $changes = self::weeklyAwardFields($event, $squadIds, $exceptId);
        if ($changes !== null) {
            ValeContent::current()->update($changes);
        }
    }

    /**
     * Every weekly award this match day earns, as The Vale's columns — what
     * finalize() writes to The Vale, and what the "pick a match day" view
     * shows for an older one. Read-only. Null when no game finished; an
     * award nobody earned (no rating rise, no squad player in a game) is left out.
     *
     * @param  array<int, int>  $squadIds
     * @param  ?string  $exceptId  a match day of the same week to leave out of
     *                             the team of the week (one being deleted)
     * @return array<string, mixed>|null
     */
    public static function weeklyAwardFields(MatchDayEvent $event, array $squadIds, ?string $exceptId = null): ?array
    {
        if (! self::hasFinishedGames($event)) {
            return null;
        }

        $inSquad = fn ($id) => is_int($id) && in_array($id, $squadIds, true);
        $changes = [
            'team_week_title' => $event->title,
            'team_week_date_range' => $event->date,
        ];

        $team = self::computeTeamOfWeek($event, $squadIds, $exceptId);
        if ($team) {
            // A picked six, not one side, so there's no single record or rival.
            $changes += [
                'team_sessions_won' => 0,
                'team_sessions_played' => count($team['weekMatchDays']),
                'team_rival' => null,
                'team_score' => null,
                'team_lineup_player_ids' => $team['lineupPlayerIds'],
            ];
        }

        // The weekly leaders — this match day's stats only.
        $stats = array_filter(
            PlayerStats::computeAll([$event], $noCleanSheetIds = PlayerStats::noCleanSheetIds()),
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

        $cleanSheetTeam = self::computeCleanSheetTeam($event, $squadIds, $noCleanSheetIds);
        $changes += [
            'leader_clean_sheet_team' => $cleanSheetTeam['name'] ?? null,
            'leader_clean_sheet_value' => $cleanSheetTeam['value'] ?? 0,
            'leader_clean_sheet_player_ids' => $cleanSheetTeam['playerIds'] ?? [],
        ];

        $changes += self::flopFields($event, $squadIds);

        // Player of the week — the highest-rated player across the week.
        $potw = $team['playerOfWeek'] ?? null;
        if ($potw) {
            $s = $potw['stats'] + ['goals' => 0, 'assists' => 0, 'cleanSheets' => 0, 'appearances' => 0];
            $changes += [
                'potw_player_id' => $potw['playerId'],
                'potw_note' => sprintf(
                    '%d goal%s and %d assist%s across %d game%s — the top rating of the week at %s.',
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

        return $changes;
    }
}
