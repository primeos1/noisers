<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreGoalEventRequest;
use App\Http\Resources\GoalEventResource;
use App\Models\GoalEvent;
use Illuminate\Http\Request;

class GoalEventController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = GoalEvent::query()->with('player');

        if ($request->filled('fixture_id')) {
            $query->where('fixture_id', $request->integer('fixture_id'));
        }

        if ($request->filled('player_id')) {
            $query->where('player_id', $request->integer('player_id'));
        }

        return GoalEventResource::collection($query->get());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreGoalEventRequest $request)
    {
        $this->authorize('create', GoalEvent::class);

        $goalEvent = GoalEvent::create($request->validated());

        return new GoalEventResource($goalEvent->load('player'));
    }

    /**
     * Display the specified resource.
     */
    public function show(GoalEvent $goalEvent)
    {
        return new GoalEventResource($goalEvent->load('player'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(StoreGoalEventRequest $request, GoalEvent $goalEvent)
    {
        $this->authorize('update', $goalEvent);

        $goalEvent->update($request->validated());

        return new GoalEventResource($goalEvent->load('player'));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(GoalEvent $goalEvent)
    {
        $this->authorize('delete', $goalEvent);

        $goalEvent->delete();

        return response()->noContent();
    }
}
