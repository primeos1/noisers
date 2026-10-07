<?php

namespace App\Support;

use App\Models\Card;
use App\Models\ClubSetting;
use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\PlayerAbsence;
use Illuminate\Support\Carbon;

/**
 * Writes Noisers, the club blog, from what's already recorded: a report and
 * a team-of-the-match-day piece for every finished match day, a disciplinary
 * write-up for its cards (and for cards logged outside a match day), and a
 * story for every injury, trip or suspension — plus a welcome-back once it's
 * over. Written on read like PlayerStats, so an edited or deleted match day,
 * card or absence rewrites (or drops) its stories with no extra step.
 *
 * Wording is picked from a few variants per story, seeded by the story id, so
 * each story reads differently from its neighbours but the same on every load.
 */
class NoisersFeed
{
    public const LIMIT = 80;

    /** @var array<int, Player> */
    private array $players;

    private ClubSetting $settings;

    /** @var array<int, array<string, int>>|null season stats by player id, computed on first use */
    private ?array $seasonStats = null;

    /** @var array<string, array<string, mixed>|null> team and player of the match day by event id, worked out on first use */
    private array $matchDayAwards = [];

    /** @var array<int, int>|null disciplinary cards by player id, counted on first use */
    private ?array $cardCounts = null;

    /**
     * @return array<int, array<string, mixed>> newest first
     */
    public static function build(): array
    {
        return (new self)->stories();
    }

    private function __construct()
    {
        $this->players = Player::all()->keyBy('id')->all();
        $this->settings = ClubSetting::current();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function stories(): array
    {
        $stories = [];

        $events = MatchDayEvent::query()->where('status', 'ended')->orderBy('created_at')->get();
        foreach ($events as $event) {
            $games = array_values(array_filter(
                $event->games ?? [],
                fn ($g) => ($g['status'] ?? null) === 'finished',
            ));
            if ($games === []) {
                continue;
            }
            $stories[] = $this->matchReport($event, $games);
            if ($totw = $this->teamOfTheMatchDay($event)) {
                $stories[] = $totw;
            }
            if ($book = $this->matchDayDiscipline($event, $games)) {
                $stories[] = $book;
            }
        }

        // Cards logged by hand, outside any match day.
        foreach (Card::whereNull('match_day_ref')->get() as $card) {
            if (isset($this->players[$card->player_id])) {
                $stories[] = $this->standaloneCard($card);
            }
        }

        foreach (PlayerAbsence::all() as $absence) {
            if (! isset($this->players[$absence->player_id])) {
                continue;
            }
            $stories[] = $this->absence($absence);
            if ($absence->status() === 'ended') {
                $stories[] = $this->comeback($absence);
            }
        }

        usort($stories, fn ($a, $b) => [$b['publishedAt'], $b['id']] <=> [$a['publishedAt'], $a['id']]);

        return array_slice($stories, 0, self::LIMIT);
    }

    /* ---- Match day: the report -------------------------------------------- */

    /**
     * @param  array<int, array<string, mixed>>  $games  the event's finished games
     */
    private function matchReport(MatchDayEvent $event, array $games): array
    {
        $id = "report-{$event->id}";
        $stats = PlayerStats::computeAll([$event], $this->noCleanSheetIds());
        $squadStats = array_filter($stats, fn ($pid) => isset($this->players[$pid]), ARRAY_FILTER_USE_KEY);
        $potw = $this->matchDayAwards($event)['playerOfMatchDay'] ?? null;
        $scorer = $this->leader($squadStats, 'goals');
        $assister = $this->leader($squadStats, 'assists');
        $cleanSheet = MatchDayFinalizer::computeCleanSheetTeam($event, array_keys($this->players), $this->noCleanSheetIds());
        $team = MatchDayFinalizer::computeBestSide($event, array_keys($this->players));
        $winner = $team ? $this->winningTeamName($event, $team) : null;

        $scoreline = array_map(fn ($g) => $this->gameLine($g), $games);
        $goals = array_sum(array_map(fn ($l) => $l['homeScore'] + $l['awayScore'], $scoreline));
        [$yellows, $reds] = $this->cardCounts($games);
        $venue = $event->venue ? " at {$event->venue}" : '';
        $gamesWord = $this->plural(count($games), 'game');
        $goalsWord = $this->plural($goals, 'goal');

        // Headline — lead with the biggest story of the day.
        $hatTrick = $scorer && $squadStats[$scorer]['goals'] >= 3;
        $unbeaten = $team && $team['sessionsPlayed'] >= 2 && $team['sessionsWon'] === $team['sessionsPlayed'];
        if ($hatTrick) {
            $n = $squadStats[$scorer]['goals'];
            $headline = $this->pick("$id-h", [
                "{$this->name($scorer)} bags {$n} as {$event->title} goes up in smoke",
                "Hat-trick hero: {$this->name($scorer)} runs riot at {$event->title}",
                "{$n} goals, one name: {$this->name($scorer)} owns {$event->title}",
            ]);
        } elseif ($unbeaten && $winner) {
            $headline = $this->pick("$id-h", [
                "{$winner} go perfect at {$event->title}",
                "Unbeaten, unbothered: {$winner} sweep {$event->title}",
                "Nobody laid a glove on {$winner} at {$event->title}",
            ]);
        } elseif ($goals === 0) {
            $headline = "Deadlock at {$event->title}: the goalkeepers win the day";
        } else {
            $headline = $this->pick("$id-h", [
                "{$event->title}: {$goalsWord}, {$gamesWord}, zero chill",
                "Full time at {$event->title} — here's how it went down",
                $winner ? "{$winner} come out on top at {$event->title}" : "The dust settles on {$event->title}",
            ]);
        }

        $standfirst = "{$gamesWord}, {$goalsWord}{$venue}".($potw ? " — and {$this->name($potw['playerId'])} ran the show." : '.');

        $body = [];
        $body[] = $this->pick("$id-open", [
            "The final whistle has gone on {$event->title}{$venue}, and it was loud. ".ucfirst($gamesWord)." played, {$goalsWord} scored, and plenty to talk about.",
            "Another match day in the books. {$event->title}{$venue} served up {$goalsWord} across {$gamesWord}, and nobody went home quiet.",
            "Boots off, ice baths on. {$event->title}{$venue} is done — {$gamesWord}, {$goalsWord}, and a few stories worth telling.",
        ]);

        $results = array_map(fn ($l) => "{$l['home']} {$l['homeScore']}–{$l['awayScore']} {$l['away']}", $scoreline);
        $body[] = 'How it finished: '.$this->listOf($results).'.'.$this->biggestWin($scoreline, "$id-big");

        if ($scorer) {
            $g = $squadStats[$scorer]['goals'];
            $line = $this->pick("$id-sc", [
                "{$this->name($scorer)} led the scoring with {$this->plural($g, 'goal')}",
                "Top of the scoring charts: {$this->name($scorer)}, with {$this->plural($g, 'goal')}",
                "{$this->name($scorer)} found the net {$this->times($g)} — more than anyone else on the day",
            ]);
            if ($assister && $assister !== $scorer) {
                $a = $squadStats[$assister]['assists'];
                $line .= ", while {$this->name($assister)} was the chief supplier with {$this->plural($a, 'assist')}";
            }
            $body[] = $line.'.';
        }

        if ($potw) {
            $s = $potw['stats'];
            $did = $this->contribution($s, saves: true) ?: 'the best rating on the pitch';
            $played = $this->plural($s['appearances'] ?? 0, 'game');
            $body[] = $this->pick("$id-potd", [
                "Our player of the match day is {$this->name($potw['playerId'])}: {$did} across {$played}. Take a bow.",
                "If you only watched one player, it should have been {$this->name($potw['playerId'])} — {$did} in {$played}. Different class.",
                "The day belonged to {$this->name($potw['playerId'])}. ".ucfirst($did)." in {$played}, and a walk off the pitch like they owned it.",
            ]);
        }

        if ($cleanSheet) {
            $body[] = $this->pick("$id-cs", [
                "At the back, {$cleanSheet['name']} kept {$this->plural($cleanSheet['value'], 'clean sheet')}. Somebody buy that defence a drink.",
                "{$cleanSheet['name']} shut up shop with {$this->plural($cleanSheet['value'], 'clean sheet')} — a wall with bibs on.",
            ]);
        }

        if ($yellows + $reds === 0) {
            $body[] = $this->pick("$id-cards", [
                'Not a single card all day. Angels, the lot of them.',
                "The referee's notebook stayed shut. A clean day's work.",
            ]);
        } else {
            $parts = array_filter([
                $yellows ? $this->plural($yellows, 'yellow') : null,
                $reds ? $this->plural($reds, 'red') : null,
            ]);
            $body[] = "The referee kept busy too: {$this->listOf($parts)} went into the book.".($reds ? ' More on that in the disciplinary report.' : '');
        }

        $body[] = $this->pick("$id-close", [
            'Recover well, Noisers. We go again.',
            'Ice baths are recommended. Bragging rights are mandatory.',
            'Same time next week? You already know.',
            'Rest the legs, rest the voice. The next one is coming.',
        ]);

        $featured = array_values(array_unique(array_filter([
            $potw['playerId'] ?? null,
            $scorer,
            $assister,
            ...($team['lineupPlayerIds'] ?? []),
        ])));

        return $this->story($id, 'match_report', 'Match report', $this->eventTime($event), $headline, $standfirst, $body, $featured, [
            'matchDay' => $this->matchDayInfo($event),
            'scoreline' => $scoreline,
            'stats' => [
                ['label' => 'Games', 'value' => count($games)],
                ['label' => 'Goals', 'value' => $goals],
                ['label' => 'Cards', 'value' => $yellows + $reds],
                ['label' => 'Clean sheets', 'value' => $cleanSheet['value'] ?? 0],
            ],
        ]);
    }

    /* ---- Match day: team of the match day ---------------------------------- */

    /**
     * The day's six best players by position and its top-rated player (see
     * MatchDayFinalizer::computeTeamOfMatchDay()), worked out once per event.
     */
    private function matchDayAwards(MatchDayEvent $event): ?array
    {
        return $this->matchDayAwards[$event->id] ??= MatchDayFinalizer::computeTeamOfMatchDay($event, array_keys($this->players));
    }

    private function teamOfTheMatchDay(MatchDayEvent $event): ?array
    {
        $awards = $this->matchDayAwards($event);
        if (! $awards || $awards['lineup'] === []) {
            return null;
        }
        $id = "totw-{$event->id}";
        $lineup = $awards['lineupPlayerIds'];
        $star = $awards['playerOfMatchDay'];

        $headline = $this->pick("$id-h", [
            "Team of the match day: {$this->name($star['playerId'])} leads the {$event->title} six",
            "The best six at {$event->title}, picked on the day's ratings",
            "Who made the team of the match day at {$event->title}?",
        ]);
        $standfirst = "The day's best keeper, two defenders, midfielder and two forwards — picked on how they rated at {$event->title}.";

        $body = [];
        $body[] = $this->pick("$id-open", [
            "Every match day has six players who did it better than anyone else in their position. At {$event->title}, these were them.",
            "Bibs in the wash, ratings in the book. Here's the team of the match day from {$event->title}.",
            "Wins, goals, assists, clean sheets, saves — it all counts. This is the six who rated best at {$event->title}.",
        ]);

        $byPosition = [];
        foreach ($awards['lineup'] as $p) {
            $byPosition[$p['position']][] = $this->name($p['playerId']);
        }
        $lines = array_filter([
            isset($byPosition['GK']) ? 'In goal, '.$this->listOf($byPosition['GK']) : null,
            isset($byPosition['DEF']) ? 'at the back, '.$this->listOf($byPosition['DEF']) : null,
            isset($byPosition['MID']) ? 'in midfield, '.$this->listOf($byPosition['MID']) : null,
            isset($byPosition['FWD']) ? 'up top, '.$this->listOf($byPosition['FWD']) : null,
        ]);
        $body[] = ucfirst(implode('; ', $lines)).'.';

        if ($star) {
            $did = $this->contribution($star['stats'], saves: true);
            $body[] = $this->pick("$id-star", [
                "Our player of the match day: {$this->name($star['playerId'])}".($did ? ", with {$did}" : '').'.',
                "The player of the match day is {$this->name($star['playerId'])}".($did ? " — {$did}, better than anyone" : ', the standout on the pitch').'.',
            ]);
        }
        $body[] = $this->pick("$id-close", [
            'The best of these make the team of the week once both match days are in.',
            'Screenshot this. The group chat will need proof.',
            'Frame it. It might be a while before it happens again.',
        ]);

        return $this->story($id, 'team_of_week', 'Team of the match day', $this->eventTime($event)->addSecond(), $headline, $standfirst, $body, $lineup, [
            'matchDay' => $this->matchDayInfo($event),
            'lineup' => [
                'team' => 'Team of the match day',
                'playerIds' => $lineup,
                'positions' => array_column($awards['lineup'], 'position'),
            ],
        ]);
    }

    /* ---- Discipline -------------------------------------------------------- */

    /**
     * @param  array<int, array<string, mixed>>  $games
     */
    private function matchDayDiscipline(MatchDayEvent $event, array $games): ?array
    {
        $cards = [];
        foreach ($games as $game) {
            foreach (($game['cards'] ?? []) as $c) {
                $cards[] = [
                    'playerId' => is_int($c['playerId'] ?? null) && isset($this->players[$c['playerId']]) ? $c['playerId'] : null,
                    'name' => $this->participant($event, $c['playerId'] ?? null),
                    'type' => ($c['type'] ?? 'yellow') === 'red' ? 'red' : 'yellow',
                    'reason' => trim((string) ($c['reason'] ?? '')) ?: null,
                    'minute' => isset($c['minute']) ? (int) $c['minute'] : null,
                ];
            }
        }
        if ($cards === []) {
            return null;
        }

        $id = "book-{$event->id}";
        $reds = array_values(array_filter($cards, fn ($c) => $c['type'] === 'red'));
        $first = $reds[0] ?? $cards[0];

        if ($reds) {
            $headline = $this->pick("$id-h", [
                "Red mist: {$first['name']} sent off at {$event->title}",
                "Early bath for {$first['name']} at {$event->title}",
                "Off you go, {$first['name']} — red card drama at {$event->title}",
            ]);
        } elseif (count($cards) === 1) {
            $headline = $this->pick("$id-h", [
                "{$first['name']} goes into the book at {$event->title}",
                "Yellow for {$first['name']} at {$event->title}",
            ]);
        } else {
            $headline = $this->pick("$id-h", [
                count($cards)." bookings at {$event->title} — the referee was busy",
                "Handbags at {$event->title}: ".count($cards).' cards shown',
            ]);
        }

        $body = [$this->pick("$id-open", [
            "The referee's notebook from {$event->title} makes for interesting reading.",
            "Not everything at {$event->title} was pretty. Here's who the referee had words with.",
            "Tempers flared at {$event->title}, and the cards came out.",
        ])];
        foreach ($cards as $c) {
            $body[] = $this->cardSentence($c);
        }
        if ($this->settings->fines_from_match_day && array_filter($cards, fn ($c) => $c['playerId'] !== null)) {
            $body[] = 'Fines are on their way to the treasurer — '.$this->fineNote($cards).'.';
        }
        $body[] = $reds
            ? $this->pick("$id-close", ['The disciplinary committee will be taking a closer look.', 'Cool heads next time, Noisers.'])
            : $this->pick("$id-close", ['Keep it clean out there.', 'A warning, not a crisis — but the committee is watching.']);

        return $this->story($id, 'discipline', 'Discipline', $this->eventTime($event)->addSeconds(2), $headline, $this->plural(count($cards), 'card')." shown at {$event->title}.", $body,
            array_values(array_unique(array_filter(array_column($cards, 'playerId')))), [
                'matchDay' => $this->matchDayInfo($event),
                'cards' => $cards,
            ]);
    }

    private function standaloneCard(Card $card): array
    {
        $id = "card-{$card->id}";
        $c = [
            'playerId' => $card->player_id,
            'name' => $this->name($card->player_id),
            'type' => $card->type === 'red' ? 'red' : 'yellow',
            'reason' => $card->reason ?: null,
            'minute' => null,
        ];
        $headline = $c['type'] === 'red'
            ? $this->pick("$id-h", ["Red card for {$c['name']}", "{$c['name']} sees red"])
            : $this->pick("$id-h", ["{$c['name']} booked", "Yellow card for {$c['name']}"]);

        $body = [
            $this->cardSentence($c),
            "That's {$this->formatFine((float) $card->fine_amount)} owed to the club".($card->paid ? ' — already paid, to be fair.' : ', payable to the treasurer.'),
            $this->seasonDiscipline($card->player_id),
        ];

        $when = $card->occurred_on ? Carbon::parse($card->occurred_on)->setTimeFrom($card->created_at ?? now()) : ($card->created_at ?? now());

        return $this->story($id, 'discipline', 'Discipline', $when, $headline, $c['reason'] ? "For {$this->lower($c['reason'])}." : 'Logged by the disciplinary committee.', array_values(array_filter($body)), [$card->player_id], [
            'cards' => [$c],
        ]);
    }

    /**
     * @param  array{name: string, type: string, reason: ?string, minute: ?int}  $c
     */
    private function cardSentence(array $c): string
    {
        $minute = $c['minute'] !== null ? " in the {$this->ordinal(max(1, $c['minute']))} minute" : '';
        $reason = $c['reason'] ? " for {$this->lower($c['reason'])}" : '';

        return $c['type'] === 'red'
            ? "{$c['name']} was shown a straight red{$minute}{$reason}."
            : "{$c['name']} picked up a yellow{$minute}{$reason}.";
    }

    /**
     * @param  array<int, array{playerId: ?int, type: string}>  $cards
     */
    private function fineNote(array $cards): string
    {
        $squad = array_filter($cards, fn ($c) => $c['playerId'] !== null);
        $total = array_sum(array_map(
            fn ($c) => (float) ($c['type'] === 'red' ? $this->settings->red_card_fine : $this->settings->yellow_card_fine),
            $squad,
        ));

        return $this->formatFine($total).' in total';
    }

    private function seasonDiscipline(int $playerId): ?string
    {
        $this->cardCounts ??= Card::query()->selectRaw('player_id, count(*) as n')->groupBy('player_id')->pluck('n', 'player_id')->map(fn ($n) => (int) $n)->all();
        $count = $this->cardCounts[$playerId] ?? 0;
        if ($count < 2) {
            return null;
        }

        return "That makes {$this->plural($count, 'card')} on the season for {$this->firstName($playerId)}. The committee has noticed.";
    }

    /* ---- Absences ---------------------------------------------------------- */

    private function absence(PlayerAbsence $a): array
    {
        $id = "absence-{$a->id}";
        $pid = $a->player_id;
        $name = $this->name($pid);
        $first = $this->firstName($pid);
        $reason = $a->reason ? trim($a->reason) : null;
        $upcoming = $a->status() === 'upcoming';
        $from = $this->day($a->starts_on);
        $until = $a->ends_on ? $this->day($a->ends_on) : null;
        $length = $a->ends_on ? $this->duration($a->starts_on, $a->ends_on) : null;
        $untilPhrase = $until ? " until {$until}" : '';

        switch ($a->type) {
            case 'injury':
                $kind = 'injury';
                $tag = 'Treatment room';
                $headline = $this->pick("$id-h", [
                    "Treatment room: {$name} ruled out{$untilPhrase}",
                    $reason ? "Blow for Noisers: {$name} out with {$this->lower($reason)}" : "Injury blow for {$name}",
                    "{$name} heads for the physio's table",
                ]);
                $opening = $upcoming
                    ? "{$name} will be out from {$from}".($reason ? " with {$this->lower($reason)}" : ' through injury').'.'
                    : "{$name} is sidelined".($reason ? " with {$this->lower($reason)}" : ' through injury').'.';
                $period = $until
                    ? "The expected return is {$until} — {$length} on the sidelines if all goes to plan."
                    : "There's no return date yet. We'll update this as soon as there is.";
                $closer = $this->pick("$id-close", [
                    "Get well soon, {$first}. The squad needs you.",
                    "Rest, rehab, return. Hurry back, {$first}.",
                    "Ice, elevation and patience. We'll see you soon, {$first}.",
                ]);
                break;

            case 'travel':
                $kind = 'travel';
                $tag = 'On the road';
                $headline = $this->pick("$id-h", [
                    "Passport out: {$name} is on the road",
                    "{$name} jets off{$untilPhrase}",
                    "Out of office: {$name} unavailable{$untilPhrase}",
                ]);
                $opening = ($upcoming ? "{$name} will be away from {$from}" : "{$name} is away from the squad")
                    .($reason ? " — {$this->lower($reason)}" : ', travelling').'.';
                $period = $until
                    ? "Back in time for the match days after {$until}. That's {$length} without them."
                    : 'No return date yet, so the bibs will have to manage without them for now.';
                $closer = $this->pick("$id-close", [
                    "Safe travels, {$first}. Bring back some sunshine.",
                    "Enjoy the trip, {$first} — but keep your boots in the suitcase.",
                    "Don't forget us, {$first}. The group chat will be here.",
                ]);
                break;

            case 'suspension':
                $kind = 'suspension';
                $tag = 'Suspended';
                $headline = $this->pick("$id-h", [
                    "Banned: {$name} suspended{$untilPhrase}",
                    "{$name} handed a suspension",
                    "The panel has spoken: {$name} sits out{$untilPhrase}",
                ]);
                $opening = "The disciplinary committee has suspended {$name}".($reason ? " for {$this->lower($reason)}" : '')
                    .($upcoming ? ", starting {$from}." : '.');
                $period = $until
                    ? "The ban runs until {$until} — {$length} watching from the touchline."
                    : 'The ban stands until the committee says otherwise.';
                $closer = $this->seasonDiscipline($pid) ?? $this->pick("$id-close", [
                    "Serve the time, {$first}, and come back calmer.",
                    'A lesson for everyone. Play hard, play fair.',
                ]);
                break;

            default:
                $kind = 'unavailable';
                $tag = 'Unavailable';
                $headline = $this->pick("$id-h", [
                    "{$name} unavailable{$untilPhrase}",
                    "Squad news: {$name} steps away{$untilPhrase}",
                ]);
                $opening = ($upcoming ? "{$name} will be unavailable from {$from}" : "{$name} is unavailable for selection")
                    .($reason ? " — {$this->lower($reason)}" : '').'.';
                $period = $until ? "Expected back after {$until}." : 'No return date has been set yet.';
                $closer = "See you soon, {$first}.";
        }

        $body = [$opening, $period, $this->missing($pid), $closer];

        return $this->story($id, $kind, $tag, $a->created_at ?? now(), $headline, $this->absenceStandfirst($a), array_values(array_filter($body)), [$pid], [
            'absence' => [
                'type' => $a->type,
                'reason' => $reason,
                'startsOn' => $a->starts_on->toDateString(),
                'endsOn' => $a->ends_on?->toDateString(),
                'status' => $a->status(),
            ],
        ]);
    }

    private function comeback(PlayerAbsence $a): array
    {
        $id = "return-{$a->id}";
        $pid = $a->player_id;
        $name = $this->name($pid);
        $length = $this->duration($a->starts_on, $a->ends_on);
        $why = match ($a->type) {
            'injury' => $a->reason ? "out with {$this->lower($a->reason)}" : 'out injured',
            'travel' => 'away on the road',
            'suspension' => 'serving a suspension',
            default => 'unavailable',
        };

        $headline = $this->pick("$id-h", [
            "{$name} is back!",
            "Welcome back, {$this->firstName($pid)}",
            "Return of the {$this->positionNoun($pid)}: {$name} available again",
        ]);
        $body = [
            "After {$length} {$why}, {$name} is available for selection again.",
            $this->pick("$id-mid", [
                'The bibs have been washed, the boots are laced. Time to get back to work.',
                'Expect a hungry player — nothing sharpens you like watching from the sidelines.',
                'The squad just got stronger. Other teams, take note.',
            ]),
        ];

        return $this->story($id, 'comeback', 'Back in the squad', $a->ends_on->copy()->addDay()->startOfDay(), $headline, "{$length} out, and now back.", $body, [$pid], [
            'absence' => [
                'type' => $a->type,
                'reason' => $a->reason,
                'startsOn' => $a->starts_on->toDateString(),
                'endsOn' => $a->ends_on->toDateString(),
                'status' => 'ended',
            ],
        ]);
    }

    private function absenceStandfirst(PlayerAbsence $a): string
    {
        $from = $this->day($a->starts_on);

        return $a->ends_on
            ? "Out {$from} – {$this->day($a->ends_on)}."
            : "Out from {$from}, return date to be confirmed.";
    }

    /** "They've played 12 times this season, with 4 goals and 2 assists." */
    private function missing(int $playerId): ?string
    {
        $this->seasonStats ??= PlayerStats::computeAll(MatchDayEvent::where('status', 'ended')->get(), $this->noCleanSheetIds());
        $stats = $this->seasonStats[$playerId] ?? null;
        if (! $stats || $stats['appearances'] === 0) {
            return null;
        }
        $name = $this->firstName($playerId);

        return $stats['goals'] + $stats['assists'] > 0
            ? "{$name} has {$this->plural($stats['appearances'], 'appearance')} and {$this->contribution($stats, false)} this season — big boots to fill."
            : "{$name} has {$this->plural($stats['appearances'], 'appearance')} this season, and the squad will feel the gap.";
    }

    /* ---- Helpers ----------------------------------------------------------- */

    /**
     * @param  array<int, int>  $playerIds  featured players, the first one leads the story
     * @param  array<string, mixed>  $extra
     */
    private function story(string $id, string $kind, string $tag, Carbon $publishedAt, string $headline, string $standfirst, array $body, array $playerIds, array $extra = []): array
    {
        return [
            'id' => $id,
            'kind' => $kind,
            'tag' => $tag,
            'publishedAt' => $publishedAt->toIso8601String(),
            'headline' => $headline,
            'standfirst' => $standfirst,
            'body' => array_values($body),
            'playerIds' => array_values(array_map('intval', $playerIds)),
            'matchDay' => null,
            'scoreline' => null,
            'stats' => null,
            'lineup' => null,
            'cards' => null,
            'absence' => null,
            ...$extra,
        ];
    }

    private function eventTime(MatchDayEvent $event): Carbon
    {
        return ($event->created_at ?? now())->copy();
    }

    private function matchDayInfo(MatchDayEvent $event): array
    {
        return ['id' => $event->id, 'title' => $event->title, 'venue' => $event->venue, 'date' => $event->date];
    }

    /**
     * @param  array<string, mixed>  $game
     * @return array{home: string, away: string, homeScore: int, awayScore: int}
     */
    private function gameLine(array $game): array
    {
        $score = [0, 0];
        foreach (($game['goals'] ?? []) as $goal) {
            $score[($goal['teamIndex'] ?? 0) === 1 ? 1 : 0]++;
        }

        return [
            'home' => $game['teams'][0]['name'] ?? 'Home',
            'away' => $game['teams'][1]['name'] ?? 'Away',
            'homeScore' => $score[0],
            'awayScore' => $score[1],
        ];
    }

    /**
     * @param  array<int, array{home: string, away: string, homeScore: int, awayScore: int}>  $lines
     */
    private function biggestWin(array $lines, string $seed): string
    {
        $best = null;
        foreach ($lines as $l) {
            $margin = abs($l['homeScore'] - $l['awayScore']);
            if ($margin >= 2 && ($best === null || $margin > $best[0])) {
                $best = [$margin, $l];
            }
        }
        if (! $best) {
            return '';
        }
        $l = $best[1];
        [$w, $lo, $ws, $ls] = $l['homeScore'] > $l['awayScore']
            ? [$l['home'], $l['away'], $l['homeScore'], $l['awayScore']]
            : [$l['away'], $l['home'], $l['awayScore'], $l['homeScore']];

        return ' '.$this->pick($seed, [
            "The statement result? {$w} putting {$lo} to the sword, {$ws}–{$ls}.",
            "{$lo} will want to forget their {$ls}–{$ws} beating by {$w} in a hurry.",
        ]);
    }

    /** The team-of-the-week side's name, found by its lineup in the games. */
    private function winningTeamName(MatchDayEvent $event, array $team): ?string
    {
        $lineup = $team['lineupPlayerIds'];
        foreach (array_reverse($event->games ?? []) as $game) {
            if (($game['status'] ?? null) !== 'finished') {
                continue;
            }
            foreach ([0, 1] as $i) {
                if (($game['teams'][1 - $i]['name'] ?? null) === $team['rivalTeam']
                    && array_intersect($lineup, $game['teams'][$i]['players'] ?? []) !== []) {
                    return $game['teams'][$i]['name'] ?? null;
                }
            }
        }

        return null;
    }

    /**
     * @param  array<int, array<string, mixed>>  $games
     * @return array{0: int, 1: int} yellows, reds
     */
    private function cardCounts(array $games): array
    {
        $y = $r = 0;
        foreach ($games as $game) {
            foreach (($game['cards'] ?? []) as $c) {
                ($c['type'] ?? 'yellow') === 'red' ? $r++ : $y++;
            }
        }

        return [$y, $r];
    }

    /**
     * @param  array<int, array<string, int>>  $stats
     */
    private function leader(array $stats, string $key): ?int
    {
        $top = null;
        foreach ($stats as $pid => $s) {
            if ($s[$key] > 0 && ($top === null || $s[$key] > $stats[$top][$key])) {
                $top = $pid;
            }
        }

        return $top;
    }

    private function participant(MatchDayEvent $event, mixed $id): string
    {
        if (is_int($id)) {
            return isset($this->players[$id]) ? $this->name($id) : 'A former player';
        }
        foreach (($event->guests ?? []) as $guest) {
            if (($guest['id'] ?? null) === $id) {
                return ($guest['name'] ?? '') ?: 'A guest';
            }
        }

        return 'A guest';
    }

    private function name(int $playerId): string
    {
        return $this->players[$playerId]->name ?? 'A former player';
    }

    private function firstName(int $playerId): string
    {
        return explode(' ', trim($this->name($playerId)))[0];
    }

    private function positionNoun(int $playerId): string
    {
        return match ($this->players[$playerId]->position ?? null) {
            'GK' => 'gloves',
            'DEF' => 'wall',
            'MID' => 'engine',
            'FWD' => 'goal-getter',
            default => 'favourite',
        };
    }

    /** @param  array<int, string>  $options */
    private function pick(string $seed, array $options): string
    {
        return $options[crc32($seed) % count($options)];
    }

    /** @param  array<int, string>  $items */
    private function listOf(array $items): string
    {
        $items = array_values($items);
        if (count($items) <= 1) {
            return $items[0] ?? '';
        }
        $last = array_pop($items);

        return implode(', ', $items)." and {$last}";
    }

    private function plural(int $n, string $word): string
    {
        return "{$n} {$word}".($n === 1 ? '' : 's');
    }

    private function times(int $n): string
    {
        return match ($n) {
            1 => 'once',
            2 => 'twice',
            default => "{$n} times",
        };
    }

    private function ordinal(int $n): string
    {
        $suffix = in_array($n % 100, [11, 12, 13], true) ? 'th' : (['th', 'st', 'nd', 'rd'][$n % 10] ?? 'th');

        return "{$n}{$suffix}";
    }

    private function day(Carbon $date): string
    {
        return $date->format('D j M');
    }

    /** "3 days", "2 weeks", "about 3 months" — both ends inclusive. */
    private function duration(Carbon $from, Carbon $to): string
    {
        $days = (int) $from->copy()->startOfDay()->diffInDays($to->copy()->startOfDay()) + 1;
        if ($days < 14) {
            return $this->plural($days, 'day');
        }
        if ($days < 60) {
            return $this->plural((int) round($days / 7), 'week');
        }

        return 'about '.$this->plural((int) round($days / 30), 'month');
    }

    private function formatFine(float $amount): string
    {
        return '₦'.number_format($amount);
    }

    private function lower(string $s): string
    {
        // "Hamstring strain" reads as "a hamstring strain"-ish mid-sentence;
        // leave acronyms and names alone.
        return preg_match('/^[A-Z][a-z]/', $s) ? lcfirst($s) : $s;
    }

    /**
     * Squad players whose main position is midfield or forward — they don't keep clean sheets.
     *
     * @return array<int, int>
     */
    private function noCleanSheetIds(): array
    {
        return array_keys(array_filter($this->players, fn ($p) => in_array($p->position, PlayerRatings::NO_CLEAN_SHEET, true)));
    }

    /**
     * "3 goals and 2 assists", "1 goal", "2 clean sheets" — only what they actually did.
     *
     * @param  array<string, int>  $s
     */
    private function contribution(array $s, bool $cleanSheets = true, bool $saves = false): string
    {
        $parts = array_filter([
            ($s['goals'] ?? 0) ? $this->plural($s['goals'], 'goal') : null,
            ($s['assists'] ?? 0) ? $this->plural($s['assists'], 'assist') : null,
            $cleanSheets && ($s['cleanSheets'] ?? 0) ? $this->plural($s['cleanSheets'], 'clean sheet') : null,
            $saves && ($s['saves'] ?? 0) ? $this->plural($s['saves'], 'save') : null,
        ]);

        return $this->listOf($parts);
    }
}
