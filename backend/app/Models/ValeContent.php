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
        'team_lineup_player_ids',
        'potw_player_id',
        'potw_note',
        'potw_rating',
        'improved_player_id',
        'improved_note',
        'improved_prev_rating',
        'improved_curr_rating',
        'leader_top_scorer_player_id',
        'leader_top_scorer_value',
        'leader_top_assist_player_id',
        'leader_top_assist_value',
        'leader_clean_sheet_player_ids',
        'leader_roughest_player_id',
        'leader_roughest_yellow',
        'leader_roughest_red',
    ];

    protected function casts(): array
    {
        return [
            'team_lineup_player_ids' => 'array',
            'leader_clean_sheet_player_ids' => 'array',
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
