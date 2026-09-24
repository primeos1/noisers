<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClubSetting extends Model
{
    protected $fillable = [
        'yellow_card_fine',
        'red_card_fine',
        'fines_from_match_day',
        'match_team_size',
        'match_win_goals',
        'match_game_minutes',
        'match_default_team_mode',
        'match_default_venue',
        'ratings_enabled',
        'rating_new_player',
        'rating_win',
        'rating_loss',
        'rating_goal',
        'rating_assist',
        'rating_own_goal',
        'rating_clean_sheet_gk',
        'rating_clean_sheet_def',
        'rating_clean_sheet_mid',
        'rating_clean_sheet_fwd',
        'rating_max_swing',
        'vale_auto_awards',
    ];

    protected function casts(): array
    {
        return [
            'yellow_card_fine' => 'integer',
            'red_card_fine' => 'integer',
            'fines_from_match_day' => 'boolean',
            'match_team_size' => 'integer',
            'match_win_goals' => 'integer',
            'match_game_minutes' => 'integer',
            'ratings_enabled' => 'boolean',
            'rating_new_player' => 'float',
            'rating_win' => 'float',
            'rating_loss' => 'float',
            'rating_goal' => 'float',
            'rating_assist' => 'float',
            'rating_own_goal' => 'float',
            'rating_clean_sheet_gk' => 'float',
            'rating_clean_sheet_def' => 'float',
            'rating_clean_sheet_mid' => 'float',
            'rating_clean_sheet_fwd' => 'float',
            'rating_max_swing' => 'float',
            'vale_auto_awards' => 'boolean',
        ];
    }

    /**
     * The club has exactly one settings row, created on first use with
     * defaults that match the values the frontend used to hardcode.
     */
    public static function current(): self
    {
        $setting = static::firstOrCreate(['id' => 1], [
            'yellow_card_fine' => 2000,
            'red_card_fine' => 5000,
            'match_team_size' => 6,
            'match_win_goals' => 2,
        ]);

        // A freshly inserted row lacks the column defaults until reloaded.
        return $setting->wasRecentlyCreated ? $setting->refresh() : $setting;
    }

    /**
     * Rating weights in the shape PlayerRatings expects — penalties as
     * negatives, though the admin enters them as positive amounts.
     *
     * @return array{win: float, loss: float, goal: float, assist: float, own_goal: float, clean_sheet: array<string, float>, max_swing: float}
     */
    public function ratingWeights(): array
    {
        return [
            'win' => $this->rating_win,
            'loss' => -$this->rating_loss,
            'goal' => $this->rating_goal,
            'assist' => $this->rating_assist,
            'own_goal' => -$this->rating_own_goal,
            'clean_sheet' => [
                'GK' => $this->rating_clean_sheet_gk,
                'DEF' => $this->rating_clean_sheet_def,
                'MID' => $this->rating_clean_sheet_mid,
                'FWD' => $this->rating_clean_sheet_fwd,
            ],
            'max_swing' => $this->rating_max_swing,
        ];
    }
}
