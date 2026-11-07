<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeagueGoal extends Model
{
    protected $fillable = ['match_no', 'side', 'player_id', 'assist_player_id', 'own_goal'];

    protected function casts(): array
    {
        return [
            'match_no' => 'integer',
            'player_id' => 'integer',
            'assist_player_id' => 'integer',
            'own_goal' => 'boolean',
        ];
    }
}
