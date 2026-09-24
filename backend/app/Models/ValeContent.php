<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ValeContent extends Model
{
    protected $table = 'vale_content';

    protected $fillable = [
        'team_week_title',
        'team_week_date_range',
        'team_sessions_won',
        'team_sessions_played',
        'team_rival',
        'team_score',
        'team_photo_url',
        'team_lineup_numbers',
        'potw_player_number',
        'potw_note',
        'potw_rating',
        'improved_player_number',
        'improved_note',
        'improved_prev_rating',
        'improved_curr_rating',
        'leader_top_scorer_number',
        'leader_top_scorer_value',
        'leader_top_assist_number',
        'leader_top_assist_value',
        'leader_clean_sheet_numbers',
        'leader_roughest_number',
        'leader_roughest_yellow',
        'leader_roughest_red',
    ];

    protected function casts(): array
    {
        return [
            'team_lineup_numbers' => 'array',
            'leader_clean_sheet_numbers' => 'array',
        ];
    }

    /**
     * The site has exactly one "The Vale" content row, overwritten by the
     * committee every week — same singleton pattern as ClubSetting/HomeContent.
     */
    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1]);
    }
}
