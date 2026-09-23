<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Fixture extends Model
{
    /** @use HasFactory<\Database\Factories\FixtureFactory> */
    use HasFactory;

    protected $fillable = [
        'season_id',
        'opponent',
        'competition',
        'kickoff_at',
        'venue',
        'location',
        'status',
        'score_for',
        'score_against',
    ];

    protected function casts(): array
    {
        return [
            'kickoff_at' => 'datetime',
        ];
    }

    public function season(): BelongsTo
    {
        return $this->belongsTo(Season::class);
    }

    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
    }

    public function goalEvents(): HasMany
    {
        return $this->hasMany(GoalEvent::class);
    }

    public function assistEvents(): HasMany
    {
        return $this->hasMany(AssistEvent::class);
    }
}
