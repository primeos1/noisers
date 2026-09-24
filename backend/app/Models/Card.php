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
        'paid',
        'occurred_on',
    ];

    protected function casts(): array
    {
        return [
            'fine_amount' => 'decimal:2',
            'paid' => 'boolean',
            'occurred_on' => 'date',
        ];
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
