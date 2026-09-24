<?php

namespace App\Http\Resources;

use App\Models\HomeContent;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HomeContentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'hero' => [
                'eyebrow' => $this->hero_eyebrow,
                'headline' => $this->hero_headline,
                'subtext' => $this->hero_subtext,
                'imageUrl' => $this->hero_image_url,
            ],
            'story' => [
                'eyebrow' => $this->story_eyebrow,
                'headline' => $this->story_headline,
                'paragraph1' => $this->story_paragraph_1,
                'paragraph2' => $this->story_paragraph_2,
                'imageUrl' => $this->story_image_url,
            ],
            'atmosphere' => [
                'caption' => $this->atmosphere_caption,
                'imageUrl' => $this->atmosphere_image_url,
            ],
            'matchday' => [
                'eyebrow' => $this->matchday_eyebrow,
                'headline' => $this->matchday_headline,
                'body' => $this->matchday_body,
            ],
            'statsSection' => [
                'enabled' => $this->stats_enabled ?? true,
                'eyebrow' => $this->stats_eyebrow,
                'headline' => $this->stats_headline,
                'imageUrl' => $this->stats_image_url,
                'live' => $this->stats_live ?? HomeContent::LIVE_STATS,
            ],
            'footer' => [
                'tagline' => $this->footer_tagline,
                'copyright' => $this->footer_copyright,
            ],
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
