<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MatchDayEventResource;
use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Support\MatchDayFinalizer;
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
        return MatchDayEventResource::collection(
            MatchDayEvent::query()->orderBy('created_at')->get()
        );
    }

    /**
     * Store a newly created event. The id is client-generated (a slug, see
     * matchDay.ts's uniqueEventId) so the app's existing id scheme carries
     * over unchanged.
     */
    public function store(Request $request)
    {
        $this->authorize('create', MatchDayEvent::class);

        $validated = $request->validate([
            'id' => ['required', 'string', 'max:255', 'unique:match_day_events,id'],
            'title' => ['required', 'string', 'max:255'],
            'venue' => ['nullable', 'string', 'max:255'],
            'date' => ['required', 'string', 'max:255'],
            'status' => ['required', 'in:live,ended'],
            'present_players' => ['array'],
            'guests' => ['array'],
            'groups' => ['array'],
            'games' => ['array'],
        ]);

        $event = MatchDayEvent::create($validated);

        return new MatchDayEventResource($event);
    }

    /**
     * Update the specified resource — accepts a partial patch of any field,
     * mirroring MatchDayContext.updateEvent(id, patch) on the frontend.
     */
    public function update(Request $request, MatchDayEvent $matchDayEvent)
    {
        $this->authorize('update', $matchDayEvent);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'venue' => ['nullable', 'string', 'max:255'],
            'date' => ['sometimes', 'string', 'max:255'],
            'status' => ['sometimes', 'in:live,ended'],
            'present_players' => ['sometimes', 'array'],
            'guests' => ['sometimes', 'array'],
            'groups' => ['sometimes', 'array'],
            'games' => ['sometimes', 'array'],
        ]);

        $wasLive = $matchDayEvent->status !== 'ended';

        DB::transaction(function () use ($matchDayEvent, $validated, $wasLive) {
            $matchDayEvent->update($validated);

            if ($wasLive && $matchDayEvent->status === 'ended') {
                MatchDayFinalizer::finalize($matchDayEvent);
            }
        });

        return new MatchDayEventResource($matchDayEvent);
    }

    /**
     * Public — the winning side (and its lineup/rival/score) for any single
     * match day, computed on demand. Powers The Vale's "pick a match day"
     * selector, which shows the latest by default but lets a visitor look
     * at an older one without that overwriting the persisted current award.
     */
    public function teamOfWeek(MatchDayEvent $matchDayEvent)
    {
        $team = MatchDayFinalizer::computeTeamOfWeek($matchDayEvent, Player::pluck('id')->all());

        return response()->json([
            'data' => $team ? [
                'title' => $matchDayEvent->title,
                'dateRange' => $matchDayEvent->date,
                'sessionsWon' => $team['sessionsWon'],
                'sessionsPlayed' => $team['sessionsPlayed'],
                'rivalTeam' => $team['rivalTeam'],
                'score' => $team['score'],
                'lineupPlayerIds' => $team['lineupPlayerIds'],
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
        });

        return response()->noContent();
    }
}
