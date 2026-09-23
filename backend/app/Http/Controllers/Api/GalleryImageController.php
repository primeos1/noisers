<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\GalleryImageResource;
use App\Models\GalleryImage;
use Illuminate\Http\Request;

class GalleryImageController extends Controller
{
    public function store(Request $request)
    {
        $this->authorize('create', GalleryImage::class);

        $validated = $request->validate([
            'image_url' => ['required', 'string', 'max:2048'],
            'alt' => ['nullable', 'string', 'max:255'],
            'caption' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $image = GalleryImage::create($validated);

        return new GalleryImageResource($image);
    }

    public function update(Request $request, GalleryImage $galleryImage)
    {
        $this->authorize('update', $galleryImage);

        $validated = $request->validate([
            'image_url' => ['sometimes', 'required', 'string', 'max:2048'],
            'alt' => ['nullable', 'string', 'max:255'],
            'caption' => ['nullable', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $galleryImage->update($validated);

        return new GalleryImageResource($galleryImage);
    }

    public function destroy(GalleryImage $galleryImage)
    {
        $this->authorize('delete', $galleryImage);

        $galleryImage->delete();

        return response()->noContent();
    }
}
