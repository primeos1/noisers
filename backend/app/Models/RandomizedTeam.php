<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RandomizedTeam extends Model
{
    /** @use HasFactory<\Database\Factories\RandomizedTeamFactory> */
    use HasFactory;

    protected $fillable = [
        'training_session_id',
        'name',
        'player_ids',
    ];

    protected function casts(): array
    {
        return [
            'player_ids' => 'array',
        ];
    }

    public function trainingSession(): BelongsTo
    {
        return $this->belongsTo(TrainingSession::class);
    }

    public function players(): Collection
    {
        return Player::whereIn('id', $this->player_ids)->get();
    }
}
