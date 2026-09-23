<?php

namespace App\Http\Resources;

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
            'presentPlayers' => $this->present_players,
            'guests' => $this->guests,
            'groups' => $this->groups,
            'games' => $this->games,
            'status' => $this->status,
        ];
    }
}
