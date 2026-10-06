<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MatchDayEventResource;
use App\Models\MatchDayEvent;
use App\Models\Player;
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
     * Public — the winning side (and its lineup/rival/score), plus the flop
     * team at the bottom of the table, for any single match day, computed
     * on demand. Powers The Vale's "pick a match day"
     * selector, which shows the latest by default but lets a visitor look
     * at an older one without that overwriting the persisted current award.
     */
    public function teamOfWeek(MatchDayEvent $matchDayEvent)
    {
        $squadIds = Player::pluck('id')->all();
        $team = MatchDayFinalizer::computeTeamOfWeek($matchDayEvent, $squadIds);

        return response()->json([
            'data' => $team ? [
                'title' => $matchDayEvent->title,
                'dateRange' => $matchDayEvent->date,
                'sessionsWon' => $team['sessionsWon'],
                'sessionsPlayed' => $team['sessionsPlayed'],
                'rivalTeam' => $team['rivalTeam'],
                'score' => $team['score'],
                'lineupPlayerIds' => $team['lineupPlayerIds'],
                'flopTeam' => MatchDayFinalizer::computeFlopTeam($matchDayEvent, $squadIds),
                // Worked out for this match day, so every one has a flop.
                'flopPlayer' => (function () use ($matchDayEvent, $squadIds) {
                    $flop = MatchDayFinalizer::flopFields($matchDayEvent, $squadIds);

                    return $flop['flop_player_id'] === null ? null : [
                        'playerId' => $flop['flop_player_id'],
                        'note' => $flop['flop_note'],
                    ];
                })(),
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
            $matchDayEvent->delete();
            MatchDayFinalizer::renumber();
        });

        return response()->noContent();
    }
}
