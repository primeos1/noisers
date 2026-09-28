<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCardRequest;
use App\Http\Resources\CardResource;
use App\Models\Card;
use App\Models\MatchDayEvent;
use App\Support\MatchDayFinalizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CardController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $this->authorize('viewAny', Card::class);

        $query = Card::query()->with('player');

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

        DB::transaction(function () use ($card) {
            $card->delete();

            // A card logged during a match day is also taken off that game's
            // record — otherwise editing the match day later would bring the
            // fine back — and its stats, ratings and The Vale follow.
            [$eventId, $gameId, $cardId] = array_pad(explode(':', (string) $card->match_day_ref, 3), 3, null);
            $event = $eventId ? MatchDayEvent::find($eventId) : null;
            if (! $event) {
                return;
            }
            $valeShowedIt = MatchDayFinalizer::valeShows($event);
            $event->update(['games' => array_map(
                fn ($game) => ($game['id'] ?? null) !== $gameId ? $game : [
                    ...$game,
                    'cards' => array_values(array_filter(
                        $game['cards'] ?? [],
                        fn ($c) => (string) ($c['id'] ?? '') !== $cardId,
                    )),
                ],
                $event->games ?? [],
            )]);
            if ($event->status === 'ended' && $event->wasChanged('games')) {
                MatchDayFinalizer::reapply($event, $valeShowedIt);
            }
        });

        return response()->noContent();
    }
}
