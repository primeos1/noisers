<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\HomeStatResource;
use App\Models\HomeStat;
use Illuminate\Http\Request;

class HomeStatController extends Controller
{
    public function store(Request $request)
    {
        $this->authorize('create', HomeStat::class);

        $validated = $request->validate([
            'value' => ['required', 'string', 'max:255'],
            'label' => ['required', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $stat = HomeStat::create($validated);

        return new HomeStatResource($stat);
    }

    public function update(Request $request, HomeStat $homeStat)
    {
        $this->authorize('update', $homeStat);

        $validated = $request->validate([
            'value' => ['sometimes', 'required', 'string', 'max:255'],
            'label' => ['sometimes', 'required', 'string', 'max:255'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $homeStat->update($validated);

        return new HomeStatResource($homeStat);
    }

    public function destroy(HomeStat $homeStat)
    {
        $this->authorize('delete', $homeStat);

        $homeStat->delete();

        return response()->noContent();
    }
}
