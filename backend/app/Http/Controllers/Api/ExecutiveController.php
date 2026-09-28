<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ExecutiveResource;
use App\Models\Executive;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExecutiveController extends Controller
{
    /**
     * Public — powers the Executives page.
     */
    public function index()
    {
        return ExecutiveResource::collection(
            Executive::orderBy('sort_order')->orderBy('id')->get()
        );
    }

    public function store(Request $request)
    {
        $this->authorize('create', Executive::class);

        $validated = $request->validate($this->rules());

        // New faces join the end of the line-up unless placed explicitly.
        $validated['sort_order'] ??= (Executive::max('sort_order') ?? -1) + 1;

        $executive = Executive::create($validated);

        return new ExecutiveResource($executive);
    }

    public function update(Request $request, Executive $executive)
    {
        $this->authorize('update', $executive);

        $validated = $request->validate($this->rules(sometimes: true));

        $executive->update($validated);

        return new ExecutiveResource($executive);
    }

    /**
     * Rewrites the display order from a full list of ids, first to last.
     */
    public function reorder(Request $request)
    {
        $this->authorize('update', Executive::class);

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'distinct', 'exists:executives,id'],
        ]);

        DB::transaction(function () use ($validated) {
            foreach ($validated['ids'] as $position => $id) {
                Executive::whereKey($id)->update(['sort_order' => $position]);
            }
        });

        return $this->index();
    }

    public function destroy(Executive $executive)
    {
        $this->authorize('delete', $executive);

        $executive->delete();

        return response()->noContent();
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(bool $sometimes = false): array
    {
        $required = $sometimes ? 'sometimes' : 'required';

        return [
            'name' => [$required, 'string', 'max:120'],
            'title' => [$required, 'string', 'max:120'],
            'photo_url' => ['nullable', 'string', 'max:2048'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
