<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCardRequest;
use App\Http\Resources\CardResource;
use App\Models\Card;
use App\Models\Player;
use Illuminate\Http\Request;

class CardController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $this->authorize('viewAny', Card::class);

        $query = Card::query()->with('player');

        if ($request->filled('player_number')) {
            $query->whereHas('player', fn ($q) => $q->where('number', $request->integer('player_number')));
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

        $validated = $request->validated();
        $player = Player::where('number', $validated['player_number'])->firstOrFail();
        unset($validated['player_number']);
        $validated['player_id'] = $player->id;

        $card = Card::create($validated);

        return new CardResource($card->load('player'));
    }

    /**
     * Display the specified resource.
     */
    public function show(Card $card)
    {
        $this->authorize('view', $card);

        return new CardResource($card->load('player'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Card $card)
    {
        $this->authorize('update', $card);

        $validated = $request->validate([
            'type' => ['sometimes', 'in:yellow,red'],
            'reason' => ['nullable', 'string', 'max:255'],
            'fine_amount' => ['sometimes', 'numeric', 'min:0'],
            'paid' => ['sometimes', 'boolean'],
            'occurred_on' => ['nullable', 'date'],
        ]);

        $card->update($validated);

        return new CardResource($card->load('player'));
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
