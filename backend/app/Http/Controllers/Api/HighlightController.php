<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\HighlightResource;
use App\Models\Highlight;
use Illuminate\Http\Request;

class HighlightController extends Controller
{
    /**
     * Public — powers the Highlights page.
     */
    public function index()
    {
        return HighlightResource::collection(
            Highlight::orderBy('sort_order')->orderByDesc('occurred_on')->get()
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

        $highlight->delete();

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
