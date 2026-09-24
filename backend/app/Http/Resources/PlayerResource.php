<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlayerResource extends JsonResource
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
            'number' => $this->number,
            'name' => $this->name,
            'position' => $this->position,
            'bio' => $this->bio,
            'phone' => $this->when($request->user()?->isCommittee(), $this->phone),
            'email' => $this->when($request->user()?->isCommittee(), $this->email),
            'photoUrl' => $this->photo_url,
            'active' => $this->active,
            'rating' => (float) $this->rating,
            'appearances' => $this->match_day_stats['appearances'] ?? 0,
            'goals' => $this->match_day_stats['goals'] ?? 0,
            'assists' => $this->match_day_stats['assists'] ?? 0,
            'cleanSheets' => $this->match_day_stats['cleanSheets'] ?? 0,
            'yellowCards' => $this->match_day_stats['yellowCards'] ?? 0,
            'redCards' => $this->match_day_stats['redCards'] ?? 0,
        ];
    }
}
