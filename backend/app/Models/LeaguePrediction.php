<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaguePrediction extends Model
{
    protected $table = 'league_predictions';

    protected $fillable = ['player_id', 'match_no', 'home', 'away'];

    protected function casts(): array
    {
        return ['player_id' => 'integer', 'match_no' => 'integer', 'home' => 'integer', 'away' => 'integer'];
    }
}
