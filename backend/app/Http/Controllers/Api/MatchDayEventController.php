<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MatchDayEventResource;
use App\Http\Resources\ValeContentResource;
use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\ValeContent;
use App\Support\MatchDayFinalizer;
use App\Support\MatchDaySchedule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MatchDayEventController extends Controller
{
    /**
     * Public — powers the "latest match day" teasers on the public site as
     * well as the admin Match Day / Matches screens.
     */
    public function index()
    {
        // Wednesdays and Sundays open their match day ahead of kickoff.
        MatchDaySchedule::ensure();

        return MatchDayEventResource::collection(
            MatchDayEvent::query()->orderBy('created_at')->get()
        );
    }

    /**
     * Store a newly created event. The id is client-generated (a slug, see
     * matchDay.ts's uniqueEventId) so the app's existing id scheme carries
     * over unchanged. The title isn't the admin's to choose � it's always
     * "Matchday N" (see MatchDayFinalizer::renumber).
     */
    public function store(Request $request)
    {
        $this->authorize('create', MatchDayEvent::class);

        $validated = $request->validate([
            'id' => ['required', 'string', 'max:255', 'unique:match_day_events,id'],
            'venue' => ['nullable', 'string', 'max:255'],
            'date' => ['required', 'string', 'max:255'],
            'status' => ['required', 'in:live,ended'],
            'present_players' => ['array'],
            'guests' => ['array'],
            'groups' => ['array'],
            'games' => ['array'],
            'team_mode' => ['nullable', 'in:random,rating,position'],
        ]);

        $event = DB::transaction(function () use ($validated) {
            $event = MatchDayEvent::create($validated + ['title' => 'Matchday']);
            MatchDayFinalizer::renumber();

            return $event->refresh();
        });

        return new MatchDayEventResource($event);
    }

    /**
     * Update the specified resource — accepts a partial patch of any field,
     * mirroring MatchDayContext.updateEvent(id, patch) on the frontend.
     *
     * Several admins can record the same match day at once, so a client sends
     * the `version` it edited. If someone else saved in between, the edit is
     * refused with a 409 carrying the latest copy, and the client re-applies
     * its change on top of that. (Clients that send no version still save.)
     */
    public function update(Request $request, MatchDayEvent $matchDayEvent)
    {
        $this->authorize('update', $matchDayEvent);

        $validated = $request->validate([
            'version' => ['sometimes', 'integer'],
            'venue' => ['nullable', 'string', 'max:255'],
            'date' => ['sometimes', 'string', 'max:255'],
            'status' => ['sometimes', 'in:live,ended'],
            'present_players' => ['sometimes', 'array'],
            'guests' => ['sometimes', 'array'],
            'groups' => ['sometimes', 'array'],
            'games' => ['sometimes', 'array'],
            'team_mode' => ['nullable', 'in:random,rating,position'],
        ]);
        $expectedVersion = $validated['version'] ?? null;
        unset($validated['version']);

        $saved = DB::transaction(function () use ($matchDayEvent, $validated, $expectedVersion) {
            // Locked so two saves can't both pass the version check.
            $event = MatchDayEvent::whereKey($matchDayEvent->getKey())->lockForUpdate()->firstOrFail();
            if ($expectedVersion !== null && (int) $expectedVersion !== $event->version) {
                return null;
            }

            $wasLive = $event->status !== 'ended';
            // Read before the update — an edit can change the title/date The Vale matches on.
            $valeShowedIt = ! $wasLive && MatchDayFinalizer::valeShows($event);

            $event->update($validated);

            if ($wasLive && $event->status === 'ended') {
                MatchDayFinalizer::finalize($event);
            } elseif (! $wasLive && $event->status === 'ended' && $event->wasChanged(['games', 'date'])) {
                // Editing a finished match day's record (Settings → Match records).
                MatchDayFinalizer::reapply($event, $valeShowedIt);
            }

            return $event;
        });

        if ($saved === null) {
            return (new MatchDayEventResource($matchDayEvent->refresh()))
                ->additional(['message' => 'Someone else changed this match day — reload and try again.'])
                ->response()
                ->setStatusCode(409);
        }

        // Finalizing can renumber titles, so send back what's stored now.
        return new MatchDayEventResource($saved->refresh());
    }

    /**
     * Public — the team and player of the week for this match day's week
     * (the best keeper, two defenders, midfielder and two forwards, and the
     * top-rated player, across the week's two match days — only once both
     * have ended), the team and player of
     * each of the week's match days, and the week's flop team, computed on
     * demand. Powers The Vale's "pick a week" selector, which
     * shows the latest by default but lets a visitor look at an older one
     * without that overwriting the persisted current award.
     */
    public function teamOfWeek(MatchDayEvent $matchDayEvent)
    {
        $squadIds = Player::pluck('id')->all();
        $team = MatchDayFinalizer::computeTeamOfWeek($matchDayEvent, $squadIds);
        // A pick with what they did on the day or the week it was picked for.
        $pick = fn (?array $p) => $p === null ? null : [
            'playerId' => $p['playerId'],
            'position' => $p['position'],
            'points' => $p['points'],
            'goals' => $p['stats']['goals'] ?? 0,
            'assists' => $p['stats']['assists'] ?? 0,
            'cleanSheets' => $p['stats']['cleanSheets'] ?? 0,
            'saves' => $p['stats']['saves'] ?? 0,
            'appearances' => $p['stats']['appearances'] ?? 0,
        ];

        return response()->json([
            'data' => $team ? [
                'title' => 'Week '.MatchDayFinalizer::weekNumber($matchDayEvent),
                'dateRange' => implode(' & ', array_map(fn ($e) => $e->date, $team['weekMatchDays'])),
                'week' => MatchDayFinalizer::weekNumber($matchDayEvent),
                'weekMatchDays' => array_map(fn ($e) => ['id' => $e->id, 'title' => $e->title, 'date' => $e->date], $team['weekMatchDays']),
                // Whether both match days have ended; until then there's no
                // team or player of the week.
                'complete' => $team['complete'],
                // GK, DEF, DEF, MID, FWD, FWD — each with what they did that week.
                'lineup' => array_map($pick, $team['lineup']),
                'lineupPlayerIds' => $team['lineupPlayerIds'],
                'playerOfWeek' => $pick($team['playerOfWeek']),
                // Each of the week's match days on its own, oldest first.
                'matchDays' => array_map(function ($e) use ($squadIds, $pick) {
                    $day = MatchDayFinalizer::computeTeamOfMatchDay($e, $squadIds);

                    return [
                        'id' => $e->id,
                        'title' => $e->title,
                        'date' => $e->date,
                        'lineup' => array_map($pick, $day['lineup'] ?? []),
                        'playerOfMatchDay' => $pick($day['playerOfMatchDay'] ?? null),
                        // Most cards that day, ties going to more reds; null when nobody was booked.
                        'badBoy' => $day['badBoy'] ?? null,
                    ];
                }, $team['weekMatchDays']),
                'flopTeam' => MatchDayFinalizer::computeFlopTeam($matchDayEvent, $squadIds),
                // Worked out for this match day, so every one has a flop.
                'flopPlayer' => (function () use ($matchDayEvent, $squadIds) {
                    $flop = MatchDayFinalizer::flopFields($matchDayEvent, $squadIds);

                    return $flop['flop_player_id'] === null ? null : [
                        'playerId' => $flop['flop_player_id'],
                        'note' => $flop['flop_note'],
                    ];
                })(),
                // Every other award as it stood after this match day, in The
                // Vale's own shape, so an older week shows its own winners.
                'awards' => (new ValeContentResource(
                    (new ValeContent)->forceFill(MatchDayFinalizer::weeklyAwardFields($matchDayEvent, $squadIds) ?? [])
                ))->resolve(),
            ] : null,
        ]);
    }

    /**
     * Remove the event along with everything it fed into — its cards/fines,
     * rating changes and (if current) The Vale's weekly awards.
     */
    public function destroy(MatchDayEvent $matchDayEvent)
    {
        $this->authorize('delete', $matchDayEvent);

        DB::transaction(function () use ($matchDayEvent) {
            MatchDayFinalizer::revert($matchDayEvent);
            $shownWeek = MatchDayFinalizer::shownWeekIds($matchDayEvent->id);
            $matchDayEvent->delete();
            MatchDayFinalizer::renumber();
            MatchDayFinalizer::rePairShownWeek($shownWeek);
        });

        return response()->noContent();
    }
}
