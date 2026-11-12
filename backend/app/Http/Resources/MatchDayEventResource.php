<?php

namespace App\Http\Resources;

use App\Support\LeagueMatchDaySync;
use App\Support\MatchDayFinalizer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MatchDayEventResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'venue' => $this->venue,
            'date' => $this->date,
            'createdAt' => $this->created_at?->toIso8601String(),
            // Monday of the week it was played — groups Wednesday and Sunday.
            'week' => MatchDayFinalizer::weekNumber($this->resource),
            'presentPlayers' => $this->present_players,
            'guests' => $this->guests,
            'groups' => $this->groups,
            'games' => $this->games,
            // How the teams were drawn: random, rating or position.
            'teamMode' => $this->team_mode,
            'status' => $this->status,
            // 1-5 when this is a league Sunday: its games are league fixtures.
            'leagueNight' => LeagueMatchDaySync::nightFor($this->date),
            'version' => $this->version ?? 0,
        ];
    }
}
