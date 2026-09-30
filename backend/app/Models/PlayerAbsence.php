<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlayerAbsence extends Model
{
    protected $fillable = [
        'player_id',
        'type',
        'reason',
        'starts_on',
        'ends_on',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
        ];
    }

    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class);
    }

    /** "upcoming", "active" or "ended", relative to today. */
    public function status(): string
    {
        $today = now()->startOfDay();
        if ($this->starts_on->gt($today)) {
            return 'upcoming';
        }

        return $this->ends_on && $this->ends_on->lt($today) ? 'ended' : 'active';
    }
}
