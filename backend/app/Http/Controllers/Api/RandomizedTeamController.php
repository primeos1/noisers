<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRandomizedTeamRequest;
use App\Http\Resources\RandomizedTeamResource;
use App\Models\Player;
use App\Models\RandomizedTeam;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RandomizedTeamController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $this->authorize('viewAny', RandomizedTeam::class);

        return RandomizedTeamResource::collection(RandomizedTeam::all());
    }

    /**
     * Generate (or re-roll) a fresh split of teams for a training session.
     */
    public function store(StoreRandomizedTeamRequest $request)
    {
        $this->authorize('create', RandomizedTeam::class);

        $teamCount = $request->integer('team_count', 2);
        $balanceByPosition = $request->boolean('balance_by_position', true);

        $players = Player::whereIn('id', $request->input('player_ids'))->get();

        $teams = array_fill(0, $teamCount, []);

        $slot = 0;

        if ($balanceByPosition) {
            // A running slot counter (rather than restarting at 0 for each
            // position group) keeps the leftover player from odd-sized
            // groups from always landing on the same team.
            foreach ($players->groupBy('position') as $group) {
                foreach ($group->shuffle()->values() as $player) {
                    $teams[$slot % $teamCount][] = $player->id;
                    $slot++;
                }
            }
        } else {
            foreach ($players->shuffle()->values() as $player) {
                $teams[$slot % $teamCount][] = $player->id;
                $slot++;
            }
        }

        $randomizedTeams = DB::transaction(function () use ($request, $teams) {
            RandomizedTeam::where('training_session_id', $request->integer('training_session_id'))->delete();

            $created = [];

            foreach ($teams as $index => $playerIds) {
                $created[] = RandomizedTeam::create([
                    'training_session_id' => $request->integer('training_session_id'),
                    'name' => 'Team '.Str::upper(chr(65 + $index)),
                    'player_ids' => $playerIds,
                ]);
            }

            return $created;
        });

        return RandomizedTeamResource::collection($randomizedTeams);
    }

    /**
     * Display the specified resource.
     */
    public function show(RandomizedTeam $randomizedTeam)
    {
        $this->authorize('view', $randomizedTeam);

        return new RandomizedTeamResource($randomizedTeam);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(RandomizedTeam $randomizedTeam)
    {
        $this->authorize('delete', $randomizedTeam);

        $randomizedTeam->delete();

        return response()->noContent();
    }
}
