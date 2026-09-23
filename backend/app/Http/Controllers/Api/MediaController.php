<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\MediaResource;
use App\Models\Media;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MediaController extends Controller
{
    /**
     * Display a listing of the resource — newest first, powers the admin
     * media picker grid.
     */
    public function index()
    {
        return MediaResource::collection(
            Media::query()->orderByDesc('created_at')->paginate(24)
        );
    }

    /**
     * Store a newly uploaded file.
     */
    public function store(Request $request)
    {
        $this->authorize('create', Media::class);

        $validated = $request->validate([
            'file' => ['required', 'image', 'max:5120'],
            'alt_text' => ['nullable', 'string', 'max:255'],
        ]);

        $file = $validated['file'];
        $path = $file->store('media', 'public');

        $media = Media::create([
            'disk' => 'public',
            'path' => $path,
            'url' => Storage::disk('public')->url($path),
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'alt_text' => $validated['alt_text'] ?? null,
            'uploaded_by' => $request->user()?->id,
        ]);

        return new MediaResource($media);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Media $media)
    {
        $this->authorize('delete', Media::class);

        Storage::disk($media->disk)->delete($media->path);
        $media->delete();

        return response()->noContent();
    }
}
