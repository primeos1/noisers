<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MediaResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'url' => $this->url,
            'originalFilename' => $this->original_filename,
            'mimeType' => $this->mime_type,
            'size' => $this->size,
            'altText' => $this->alt_text,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
