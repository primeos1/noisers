<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HighlightResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'src' => $this->media_url,
            'alt' => $this->alt,
            'caption' => $this->caption,
            'category' => $this->category,
            'date' => $this->occurred_on?->format('d M Y'),
            'tall' => $this->tall,
            'sortOrder' => $this->sort_order,
        ];
    }
}
