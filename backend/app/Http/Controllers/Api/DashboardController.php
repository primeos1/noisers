<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CardResource;
use App\Http\Resources\FixtureResource;
use App\Http\Resources\PlayerResource;
use App\Models\Card;
use App\Models\Fixture;
use App\Models\Player;

class DashboardController extends Controller
{
    /**
     * Season-at-a-glance summary for the admin dashboard home.
     */
    public function index()
    {
        $this->authorize('viewAny', Card::class);

        $nextFixture = Fixture::where('status', 'scheduled')
            ->orderBy('kickoff_at')
            ->first();

        $outstandingFines = (float) Card::where('paid', false)->sum('fine_amount');

        $topScorer = Player::withCount('goalEvents as goals_count')
            ->orderByDesc('goals_count')
            ->first();

        $recentCards = Card::with(['player', 'fixture'])
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        return response()->json([
            'nextFixture' => $nextFixture ? new FixtureResource($nextFixture) : null,
            'outstandingFines' => $outstandingFines,
            'topScorer' => $topScorer ? new PlayerResource($topScorer) : null,
            'recentCards' => CardResource::collection($recentCards),
        ]);
    }
}
