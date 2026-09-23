<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCardRequest;
use App\Http\Resources\CardResource;
use App\Models\Card;
use Illuminate\Http\Request;

class CardController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $this->authorize('viewAny', Card::class);

        $query = Card::query()->with(['player', 'fixture']);

        if ($request->filled('player_id')) {
            $query->where('player_id', $request->integer('player_id'));
        }

        if ($request->filled('paid')) {
            $query->where('paid', $request->boolean('paid'));
        }

        return CardResource::collection($query->orderByDesc('created_at')->get());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreCardRequest $request)
    {
        $this->authorize('create', Card::class);

        $card = Card::create($request->validated());

        return new CardResource($card->load(['player', 'fixture']));
    }

    /**
     * Display the specified resource.
     */
    public function show(Card $card)
    {
        $this->authorize('view', $card);

        return new CardResource($card->load(['player', 'fixture']));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Card $card)
    {
        $this->authorize('update', $card);

        $validated = $request->validate([
            'type' => ['sometimes', 'in:yellow,red'],
            'fine_amount' => ['sometimes', 'numeric', 'min:0'],
            'paid' => ['sometimes', 'boolean'],
        ]);

        $card->update($validated);

        return new CardResource($card->load(['player', 'fixture']));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Card $card)
    {
        $this->authorize('delete', $card);

        $card->delete();

        return response()->noContent();
    }
}
