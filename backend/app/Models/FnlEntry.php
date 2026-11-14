<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FnlEntry extends Model
{
    protected $table = 'fnl_entries';

    protected $fillable = ['fnl_team_id', 'gameweek', 'starters', 'bench', 'captain_id', 'vice_id', 'chip', 'transfers', 'transfer_cost'];

    protected function casts(): array
    {
        return [
            'fnl_team_id' => 'integer',
            'gameweek' => 'integer',
            'starters' => 'array',
            'bench' => 'array',
            'captain_id' => 'integer',
            'vice_id' => 'integer',
            'transfers' => 'integer',
            'transfer_cost' => 'integer',
        ];
    }
}
