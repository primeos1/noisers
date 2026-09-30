<?php

namespace App\Models;

use App\Support\PlayerRatings;
use Illuminate\Database\Eloquent\Model;

class ClubSetting extends Model
{
    /** What the squad passcode is until an admin changes it. */
    public const DEFAULT_PLAYER_PASSCODE = 'vale2zenith';

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
        'rating_position_weights',
        'rating_max_swing',
        'vale_auto_awards',
        'player_passcode',
    ];

    // Never sent with the public settings — staff read it from its own
    // endpoint, players only ever submit a guess.
    protected $hidden = ['player_passcode'];

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
            'rating_position_weights' => 'array',
            'rating_max_swing' => 'float',
            'vale_auto_awards' => 'boolean',
            'player_passcode' => 'encrypted',
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

    public function playerPasscode(): string
    {
        return $this->player_passcode ?? self::DEFAULT_PLAYER_PASSCODE;
    }

    public function checkPlayerPasscode(string $guess): bool
    {
        return hash_equals($this->playerPasscode(), trim($guess));
    }

    /**
     * The admin's per-position weights (all positive amounts), filled out
     * with the defaults for anything not set.
     *
     * @return array<string, array<string, float>>
     */
    public function positionWeights(): array
    {
        $stored = $this->rating_position_weights ?? [];
        $weights = PlayerRatings::defaultPositionWeights();
        foreach ($weights as $position => $keys) {
            foreach ($keys as $key => $default) {
                $weights[$position][$key] = (float) ($stored[$position][$key] ?? $default);
            }
        }

        return $weights;
    }

    /**
     * Rating weights in the shape PlayerRatings expects — penalties as
     * negatives, though the admin enters them as positive amounts.
     *
     * @return array{positions: array<string, array<string, float>>, max_swing: float}
     */
    public function ratingWeights(): array
    {
        return PlayerRatings::weights($this->positionWeights(), $this->rating_max_swing);
    }
}
