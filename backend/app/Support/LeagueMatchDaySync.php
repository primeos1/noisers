<?php

namespace App\Support;

use App\Http\Controllers\Api\LeagueController;
use App\Models\LeagueGoal;
use App\Models\LeagueResult;
use App\Models\LeagueState;
use App\Models\MatchDayEvent;
use App\Models\Player;
use Carbon\CarbonImmutable;

/**
 * The five league Sundays are recorded on the normal Match Day screen. Each
 * game there carries the league fixture it is (`leagueMatchNo`, side 0 home,
 * side 1 away), and every save of the match day copies those games' status,
 * goals and keeper saves into the league tables, so the league site follows
 * along live.
 */
class LeagueMatchDaySync
{
    /** Sunday 1's date; the rest follow weekly (see frontend lib/league.ts buildSchedule). */
    public const FIRST_NIGHT = '2026-11-15';

    public const GAMES_PER_NIGHT = 9;

    /** The league night (1-5) a match day's date label falls on, or null. */
    public static function nightFor(?string $dateLabel): ?int
    {
        $label = strtolower(trim((string) $dateLabel));
        if ($label === '') {
            return null;
        }
        $first = CarbonImmutable::parse(self::FIRST_NIGHT);
        for ($n = 0; $n < LeagueController::NIGHTS; $n++) {
            $date = $first->addWeeks($n);
            // Labels are written like "Sun 15 Nov" (en-GB); match on day and month.
            $dayMonth = strtolower($date->format('j M'));
            if (preg_match('/\b'.preg_quote($dayMonth, '/').'/', $label) && str_contains($label, 'sun')) {
                return $n + 1;
            }
        }

        return null;
    }

    /** @return int[] the fixture numbers played on a night */
    public static function matchNumbers(int $night): array
    {
        $first = ($night - 1) * self::GAMES_PER_NIGHT + 1;

        return range($first, $first + self::GAMES_PER_NIGHT - 1);
    }

    /**
     * @param  array<int, array<string, mixed>>  $previousGames  the games before this save
     */
    public static function sync(MatchDayEvent $event, array $previousGames = []): void
    {
        $night = self::nightFor($event->date);
        if ($night === null) {
            return;
        }
        $allowed = self::matchNumbers($night);

        $linked = [];
        foreach ($event->games ?? [] as $game) {
            $no = (int) ($game['leagueMatchNo'] ?? 0);
            if (in_array($no, $allowed, true)) {
                $linked[$no] = $game;
            }
        }

        // Goals reference players by foreign key; guests and removed players go in as unknown.
        $known = Player::query()->pluck('id')->flip()->all();
        foreach ($linked as $no => $game) {
            self::writeGame($no, $game, $known);
        }

        // A fixture this match day had before but no longer does (the game
        // was removed) goes back to unplayed.
        foreach ($previousGames as $game) {
            $no = (int) ($game['leagueMatchNo'] ?? 0);
            if (in_array($no, $allowed, true) && ! isset($linked[$no])) {
                LeagueGoal::where('match_no', $no)->delete();
                LeagueResult::where('match_no', $no)->delete();
            }
        }

        // The league site shows the night as on from the first game until the match day ends.
        $state = LeagueState::current();
        $on = $event->status !== 'ended' && ! empty($event->games);
        if ($on && $state->live_night !== $night) {
            $state->update(['live_night' => $night]);
        } elseif (! $on && $state->live_night === $night) {
            $state->update(['live_night' => null]);
        }
    }

    /** A deleted league match day takes its fixtures' results off the league site with it. */
    public static function forget(MatchDayEvent $event): void
    {
        $event->games = [];
        $event->status = 'ended';
        self::sync($event, $event->getOriginal('games') ?? []);
    }

    /**
     * @param  array<string, mixed>  $game
     * @param  array<int, int>  $known  player ids as keys
     */
    private static function writeGame(int $no, array $game, array $known): void
    {
        $id = function ($value) use ($known) {
            $n = is_int($value) || (is_string($value) && ctype_digit($value)) ? (int) $value : null;

            return $n !== null && isset($known[$n]) ? $n : null;
        };

        $result = LeagueResult::firstOrNew(['match_no' => $no]);
        $result->status = ($game['status'] ?? 'live') === 'finished' ? 'final' : 'live';
        $result->started_at ??= now();
        $result->finished_at = $result->status === 'final' ? ($result->finished_at ?? now()) : null;

        $saves = [];
        foreach ($game['saves'] ?? [] as $save) {
            $keeper = $id($save['playerId'] ?? null);
            if ($keeper !== null) {
                $saves[$keeper] = ($saves[$keeper] ?? 0) + 1;
            }
        }
        $result->saves = $saves;
        $result->save();

        LeagueGoal::where('match_no', $no)->delete();
        foreach ($game['goals'] ?? [] as $goal) {
            $scorer = $id($goal['playerId'] ?? null);
            $assist = $id($goal['assistPlayerId'] ?? null);
            LeagueGoal::create([
                'match_no' => $no,
                // The side the goal counts for; an own goal's scorer is on the other side.
                'side' => (int) ($goal['teamIndex'] ?? 0) === 1 ? 'away' : 'home',
                'player_id' => $scorer,
                'assist_player_id' => $assist !== $scorer ? $assist : null,
                'own_goal' => (bool) ($goal['ownGoal'] ?? false),
            ]);
        }
    }
}
