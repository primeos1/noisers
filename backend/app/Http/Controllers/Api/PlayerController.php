<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePlayerRequest;
use App\Http\Requests\UpdatePlayerRequest;
use App\Http\Resources\PlayerResource;
use App\Models\Player;
use Illuminate\Http\Request;

class PlayerController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Player::query()->withCount([
            'goalEvents as goals_count',
            'assistEvents as assists_count',
        ]);

        if ($request->boolean('active_only', true)) {
            $query->where('active', true);
        }

        if ($request->filled('position')) {
            $query->where('position', $request->string('position'));
        }

        return PlayerResource::collection($query->orderBy('number')->get());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StorePlayerRequest $request)
    {
        $this->authorize('create', Player::class);

        $player = Player::create($request->validated());

        return new PlayerResource($player);
    }

    /**
     * Display the specified resource.
     */
    public function show(Player $player)
    {
        $player->loadCount([
            'goalEvents as goals_count',
            'assistEvents as assists_count',
        ]);

        return new PlayerResource($player);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdatePlayerRequest $request, Player $player)
    {
        $this->authorize('update', $player);

        $player->update($request->validated());

        return new PlayerResource($player);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Player $player)
    {
        $this->authorize('delete', $player);

        $player->delete();

        return response()->noContent();
    }
}
