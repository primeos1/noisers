<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlayerAbsenceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'playerId' => $this->player_id,
            'type' => $this->type,
            'reason' => $this->reason,
            'startsOn' => $this->starts_on?->toDateString(),
            'endsOn' => $this->ends_on?->toDateString(),
            'status' => $this->status(),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
