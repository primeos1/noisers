<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MatchDayEventResource;
use App\Models\MatchDayEvent;
use Illuminate\Http\Request;

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

        $matchDayEvent->update($validated);

        return new MatchDayEventResource($matchDayEvent);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(MatchDayEvent $matchDayEvent)
    {
        $this->authorize('delete', $matchDayEvent);

        $matchDayEvent->delete();

        return response()->noContent();
    }
}
