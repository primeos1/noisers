<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClubSetting extends Model
{
    protected $fillable = [
        'yellow_card_fine',
        'red_card_fine',
        'match_team_size',
        'match_win_goals',
    ];

    protected function casts(): array
    {
        return [
            'yellow_card_fine' => 'integer',
            'red_card_fine' => 'integer',
            'match_team_size' => 'integer',
            'match_win_goals' => 'integer',
        ];
    }

    /**
     * The club has exactly one settings row, created on first use with
     * defaults that match the values the frontend used to hardcode.
     */
    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1], [
            'yellow_card_fine' => 2000,
            'red_card_fine' => 5000,
            'match_team_size' => 6,
            'match_win_goals' => 2,
        ]);
    }
}
