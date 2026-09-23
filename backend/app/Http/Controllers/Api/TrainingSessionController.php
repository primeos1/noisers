<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTrainingSessionRequest;
use App\Http\Resources\TrainingSessionResource;
use App\Models\TrainingSession;
use Illuminate\Http\Request;

class TrainingSessionController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $this->authorize('viewAny', TrainingSession::class);

        return TrainingSessionResource::collection(
            TrainingSession::with('randomizedTeams')->orderByDesc('scheduled_at')->get()
        );
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreTrainingSessionRequest $request)
    {
        $this->authorize('create', TrainingSession::class);

        $trainingSession = TrainingSession::create($request->validated());

        return new TrainingSessionResource($trainingSession);
    }

    /**
     * Display the specified resource.
     */
    public function show(TrainingSession $trainingSession)
    {
        $this->authorize('view', $trainingSession);

        return new TrainingSessionResource($trainingSession->load('randomizedTeams'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(StoreTrainingSessionRequest $request, TrainingSession $trainingSession)
    {
        $this->authorize('update', $trainingSession);

        $trainingSession->update($request->validated());

        return new TrainingSessionResource($trainingSession);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(TrainingSession $trainingSession)
    {
        $this->authorize('delete', $trainingSession);

        $trainingSession->delete();

        return response()->noContent();
    }
}
