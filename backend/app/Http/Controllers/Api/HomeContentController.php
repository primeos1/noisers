<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\GalleryImageResource;
use App\Http\Resources\HomeContentResource;
use App\Http\Resources\HomeStatResource;
use App\Models\GalleryImage;
use App\Models\HomeContent;
use App\Models\HomeStat;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HomeContentController extends Controller
{
    /**
     * Public — powers the Home page. Returns the singleton content row
     * together with the stat tiles and gallery strip in one payload.
     */
    public function show()
    {
        $content = HomeContent::current();

        return response()->json([
            'data' => (new HomeContentResource($content))->resolve() + [
                'stats' => HomeStatResource::collection(HomeStat::orderBy('sort_order')->get()),
                'gallery' => GalleryImageResource::collection(GalleryImage::orderBy('sort_order')->get()),
            ],
        ]);
    }

    /**
     * Update the Home page copy/images. Committee/admin only.
     */
    public function update(Request $request)
    {
        $content = HomeContent::current();

        $this->authorize('update', $content);

        $validated = $request->validate([
            'hero_eyebrow' => ['sometimes', 'nullable', 'string', 'max:255'],
            'hero_headline' => ['sometimes', 'nullable', 'string', 'max:255'],
            'hero_subtext' => ['sometimes', 'nullable', 'string'],
            'hero_image_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'story_eyebrow' => ['sometimes', 'nullable', 'string', 'max:255'],
            'story_headline' => ['sometimes', 'nullable', 'string', 'max:255'],
            'story_paragraph_1' => ['sometimes', 'nullable', 'string'],
            'story_paragraph_2' => ['sometimes', 'nullable', 'string'],
            'story_image_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'atmosphere_caption' => ['sometimes', 'nullable', 'string', 'max:255'],
            'atmosphere_image_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'matchday_eyebrow' => ['sometimes', 'nullable', 'string', 'max:255'],
            'matchday_headline' => ['sometimes', 'nullable', 'string', 'max:255'],
            'matchday_body' => ['sometimes', 'nullable', 'string'],
            'footer_tagline' => ['sometimes', 'nullable', 'string', 'max:255'],
            'footer_copyright' => ['sometimes', 'nullable', 'string', 'max:255'],
            'stats_enabled' => ['sometimes', 'boolean'],
            'stats_eyebrow' => ['sometimes', 'nullable', 'string', 'max:255'],
            'stats_headline' => ['sometimes', 'nullable', 'string', 'max:255'],
            'stats_image_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'stats_live' => ['sometimes', 'array'],
            'stats_live.*' => ['string', Rule::in(HomeContent::LIVE_STATS)],
        ]);

        $content->update($validated);

        // Force 200 — see ValeContentController::show() for why.
        return (new HomeContentResource($content))->response()->setStatusCode(200);
    }
}
