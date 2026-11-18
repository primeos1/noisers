<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\HighlightResource;
use App\Models\Highlight;
use App\Support\InstagramSync;
use App\Support\YouTubeSync;
use Illuminate\Http\Request;

class HighlightController extends Controller
{
    /**
     * Public — powers the Highlights page. Pulls any new Instagram videos
     * once the response is sent, so they show from the next visit on.
     */
    public function index()
    {
        dispatch(function () {
            InstagramSync::syncIfStale();
            YouTubeSync::syncIfStale();
        })->afterResponse();

        return HighlightResource::collection(
            Highlight::where('hidden', false)
                ->orderBy('sort_order')
                ->orderByDesc('occurred_on')
                ->orderByDesc('id')
                ->get()
        );
    }

    public function store(Request $request)
    {
        $this->authorize('create', Highlight::class);

        $validated = $request->validate($this->rules());

        $highlight = Highlight::create($validated);

        return new HighlightResource($highlight);
    }

    public function update(Request $request, Highlight $highlight)
    {
        $this->authorize('update', $highlight);

        $validated = $request->validate($this->rules(sometimes: true));

        $highlight->update($validated);

        return new HighlightResource($highlight);
    }

    public function destroy(Highlight $highlight)
    {
        $this->authorize('delete', $highlight);

        // A synced video would just come back on the next sync, so hide it.
        if ($highlight->source !== 'manual') {
            $highlight->update(['hidden' => true]);
        } else {
            $highlight->delete();
        }

        return response()->noContent();
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $sometimes = false): array
    {
        $required = $sometimes ? 'sometimes' : 'required';

        return [
            'type' => [$required, 'in:photo,video'],
            'media_url' => [$required, 'string', 'max:2048'],
            'alt' => ['nullable', 'string', 'max:255'],
            'caption' => ['nullable', 'string', 'max:255'],
            'category' => [$required, 'in:Goals,Saves,Skills,Matchday,Behind the scenes'],
            'occurred_on' => ['nullable', 'date'],
            'tall' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
