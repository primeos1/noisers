<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MatchDayEvent extends Model
{
    protected $table = 'match_day_events';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'title',
        'venue',
        'date',
        'status',
        'present_players',
        'guests',
        'groups',
        'games',
    ];

    protected function casts(): array
    {
        return [
            'present_players' => 'array',
            'guests' => 'array',
            'groups' => 'array',
            'games' => 'array',
        ];
    }
}
