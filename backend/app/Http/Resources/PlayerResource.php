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
            'goals' => $this->goals_count ?? $this->goalEvents()->count(),
            'assists' => $this->assists_count ?? $this->assistEvents()->count(),
        ];
    }
}
