<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeagueGamePlayer extends Model
{
    protected $table = 'league_game_players';

    protected $fillable = ['player_id', 'pin_hash'];

    protected $hidden = ['pin_hash'];
}
