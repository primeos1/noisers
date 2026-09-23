<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TrainingSessionResource extends JsonResource
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
            'scheduledAt' => $this->scheduled_at->toIso8601String(),
            'location' => $this->location,
            'notes' => $this->notes,
            'randomizedTeams' => RandomizedTeamResource::collection($this->whenLoaded('randomizedTeams')),
        ];
    }
}
