<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CardResource extends JsonResource
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
            'playerId' => $this->player_id,
            'player' => new PlayerResource($this->whenLoaded('player')),
            'fixtureId' => $this->fixture_id,
            'fixture' => new FixtureResource($this->whenLoaded('fixture')),
            'type' => $this->type,
            'fineAmount' => (float) $this->fine_amount,
            'paid' => $this->paid,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
