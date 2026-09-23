<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAssistEventRequest;
use App\Http\Resources\AssistEventResource;
use App\Models\AssistEvent;
use Illuminate\Http\Request;

class AssistEventController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = AssistEvent::query()->with('player');

        if ($request->filled('fixture_id')) {
            $query->where('fixture_id', $request->integer('fixture_id'));
        }

        if ($request->filled('player_id')) {
            $query->where('player_id', $request->integer('player_id'));
        }

        return AssistEventResource::collection($query->get());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreAssistEventRequest $request)
    {
        $this->authorize('create', AssistEvent::class);

        $assistEvent = AssistEvent::create($request->validated());

        return new AssistEventResource($assistEvent->load('player'));
    }

    /**
     * Display the specified resource.
     */
    public function show(AssistEvent $assistEvent)
    {
        return new AssistEventResource($assistEvent->load('player'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(StoreAssistEventRequest $request, AssistEvent $assistEvent)
    {
        $this->authorize('update', $assistEvent);

        $assistEvent->update($request->validated());

        return new AssistEventResource($assistEvent->load('player'));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(AssistEvent $assistEvent)
    {
        $this->authorize('delete', $assistEvent);

        $assistEvent->delete();

        return response()->noContent();
    }
}
