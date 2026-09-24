<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlayerRatingChange extends Model
{
    protected $fillable = [
        'player_id',
        'match_day_event_id',
        'points',
        'rating_before',
        'rating_after',
    ];

    protected function casts(): array
    {
        return [
            'points' => 'decimal:2',
            'rating_before' => 'decimal:2',
            'rating_after' => 'decimal:2',
        ];
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class);
    }
}
