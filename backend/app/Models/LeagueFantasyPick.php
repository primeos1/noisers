<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeagueFantasyPick extends Model
{
    protected $table = 'league_fantasy_picks';

    protected $fillable = ['player_id', 'night', 'pick_ids', 'captain_id'];

    protected function casts(): array
    {
        return ['player_id' => 'integer', 'night' => 'integer', 'pick_ids' => 'array', 'captain_id' => 'integer'];
    }
}
