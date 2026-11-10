<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Card extends Model
{
    /** @use HasFactory<\Database\Factories\CardFactory> */
    use HasFactory;

    protected $fillable = [
        'player_id',
        'fixture_id',
        'match_day_ref',
        'type',
        'reason',
        'fine_amount',
        'amount_paid',
        'paid',
        'occurred_on',
    ];

    protected function casts(): array
    {
        return [
            'fine_amount' => 'decimal:2',
            'amount_paid' => 'decimal:2',
            'paid' => 'boolean',
            'occurred_on' => 'date',
        ];
    }

    /**
     * Keeps `paid` and `amount_paid` in step: setting an amount decides
     * whether the fine is cleared, and ticking paid on or off pays the whole
     * fine or none of it. The amount never goes past the fine.
     */
    protected static function booted(): void
    {
        static::saving(function (Card $card) {
            $fine = (float) $card->fine_amount;
            if (! $card->isDirty('amount_paid') && $card->isDirty('paid')) {
                $card->amount_paid = $card->paid ? $fine : 0;
            }
            $amount = min(max((float) $card->amount_paid, 0), $fine);
            $card->amount_paid = $amount;
            if ($fine > 0) {
                $card->paid = $amount >= $fine;
            }
        });
    }

    /** What's still owed on this card's fine. */
    public function outstanding(): float
    {
        return max((float) $this->fine_amount - (float) $this->amount_paid, 0);
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class);
    }

    public function fixture(): BelongsTo
    {
        return $this->belongsTo(Fixture::class);
    }
}
