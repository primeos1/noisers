<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FixtureResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'seasonId' => $this->season_id,
            'opponent' => $this->opponent,
            'competition' => $this->competition,
            'date' => $this->kickoff_at->format('D j M'),
            'time' => $this->kickoff_at->format('H:i'),
            'kickoffAt' => $this->kickoff_at->toIso8601String(),
            'venue' => $this->venue,
            'location' => $this->location,
            'status' => $this->status,
            'scoreFor' => $this->score_for,
            'scoreAgainst' => $this->score_against,
            'scorers' => $this->whenLoaded('goalEvents', fn () => $this->goalEvents
                ->map(fn ($goal) => trim(strrchr(' '.$goal->player->name, ' ')).' '.$goal->minute."'")
                ->values()),
        ];
    }
}
