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
            'secondaryPosition' => $this->secondary_position,
            'membership' => $this->membership ?? 'member',
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
            'ratingHistory' => $this->whenLoaded('ratingChanges', fn () => $this->ratingChanges->map(fn ($c) => [
                'eventId' => (string) $c->match_day_event_id,
                'before' => (float) $c->rating_before,
                'after' => (float) $c->rating_after,
            ])->values()),
        ];
    }
}
