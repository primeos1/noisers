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
            'type' => $this->type,
            'reason' => $this->reason,
            'fineAmount' => (float) $this->fine_amount,
            'paid' => $this->paid,
            'occurredOn' => $this->occurred_on?->toDateString(),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
