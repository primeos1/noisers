<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFixtureRequest;
use App\Http\Requests\UpdateFixtureRequest;
use App\Http\Resources\FixtureResource;
use App\Models\Fixture;
use Illuminate\Http\Request;

class FixtureController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Fixture::query()->with(['goalEvents.player']);

        if ($request->filled('season_id')) {
            $query->where('season_id', $request->integer('season_id'));
        }

        if ($request->filled('competition')) {
            $query->where('competition', $request->string('competition'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->boolean('upcoming')) {
            $query->where('status', 'scheduled')->orderBy('kickoff_at');
        } elseif ($request->boolean('results')) {
            $query->where('status', 'completed')->orderByDesc('kickoff_at');
        } else {
            $query->orderBy('kickoff_at');
        }

        if ($request->filled('limit')) {
            $query->limit($request->integer('limit'));
        }

        return FixtureResource::collection($query->get());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreFixtureRequest $request)
    {
        $this->authorize('create', Fixture::class);

        $fixture = Fixture::create($request->validated());

        return new FixtureResource($fixture);
    }

    /**
     * Display the specified resource.
     */
    public function show(Fixture $fixture)
    {
        $fixture->load(['goalEvents.player', 'assistEvents.player', 'season']);

        return new FixtureResource($fixture);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateFixtureRequest $request, Fixture $fixture)
    {
        $this->authorize('update', $fixture);

        $fixture->update($request->validated());

        return new FixtureResource($fixture);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Fixture $fixture)
    {
        $this->authorize('delete', $fixture);

        $fixture->delete();

        return response()->noContent();
    }
}
