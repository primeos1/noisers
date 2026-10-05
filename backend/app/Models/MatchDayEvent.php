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
            'version' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        // Every saved change gets a new version — clients send the one they
        // edited, and a stale one is turned away rather than overwriting.
        static::updating(function (MatchDayEvent $event) {
            $event->version = ($event->version ?? 0) + 1;
        });
    }
}
