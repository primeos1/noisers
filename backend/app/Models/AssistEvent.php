<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssistEvent extends Model
{
    /** @use HasFactory<\Database\Factories\AssistEventFactory> */
    use HasFactory;

    protected $fillable = [
        'player_id',
        'fixture_id',
        'goal_event_id',
        'minute',
    ];

    public function player(): BelongsTo
    {
        return $this->belongsTo(Player::class);
    }

    public function fixture(): BelongsTo
    {
        return $this->belongsTo(Fixture::class);
    }

    public function goalEvent(): BelongsTo
    {
        return $this->belongsTo(GoalEvent::class);
    }
}
