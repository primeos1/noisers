<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeagueState extends Model
{
    protected $table = 'league_state';

    protected $fillable = [
        'entrant_ids',
        'keeper_ids',
        'draw_seed',
        'draw_hash',
        'draw_starts_at',
        'draw_speed',
        'draw_entrants',
        'live_night',
    ];

    protected $hidden = ['draw_seed'];

    protected function casts(): array
    {
        return [
            'entrant_ids' => 'array',
            'keeper_ids' => 'array',
            'draw_seed' => 'encrypted',
            'draw_starts_at' => 'datetime',
            'draw_speed' => 'float',
            'draw_entrants' => 'array',
            'live_night' => 'integer',
        ];
    }

    public static function current(): self
    {
        $state = static::firstOrCreate(['id' => 1]);

        return $state->wasRecentlyCreated ? $state->refresh() : $state;
    }

    public function hasDraw(): bool
    {
        return $this->draw_hash !== null;
    }

    /** The seed is public from the moment the draw starts. */
    public function drawRevealed(): bool
    {
        return $this->hasDraw() && now()->greaterThanOrEqualTo($this->draw_starts_at);
    }
}
