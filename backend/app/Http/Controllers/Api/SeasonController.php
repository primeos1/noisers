<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSeasonRequest;
use App\Http\Resources\SeasonResource;
use App\Models\Season;
use Illuminate\Http\Request;

class SeasonController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return SeasonResource::collection(Season::orderByDesc('start_date')->get());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreSeasonRequest $request)
    {
        $this->authorize('create', Season::class);

        if ($request->boolean('is_current')) {
            Season::where('is_current', true)->update(['is_current' => false]);
        }

        $season = Season::create($request->validated());

        return new SeasonResource($season);
    }

    /**
     * Display the specified resource.
     */
    public function show(Season $season)
    {
        return new SeasonResource($season);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(StoreSeasonRequest $request, Season $season)
    {
        $this->authorize('update', $season);

        if ($request->boolean('is_current')) {
            Season::where('id', '!=', $season->id)->update(['is_current' => false]);
        }

        $season->update($request->validated());

        return new SeasonResource($season);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Season $season)
    {
        $this->authorize('delete', $season);

        $season->delete();

        return response()->noContent();
    }
}
