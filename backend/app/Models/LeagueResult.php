<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeagueResult extends Model
{
    protected $fillable = ['match_no', 'status', 'started_at', 'finished_at'];

    protected function casts(): array
    {
        return [
            'match_no' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }
}
