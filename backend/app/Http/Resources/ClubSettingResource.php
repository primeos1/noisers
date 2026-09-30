<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class ClubSettingResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'yellowCardFine' => $this->yellow_card_fine,
            'redCardFine' => $this->red_card_fine,
            'finesFromMatchDay' => $this->fines_from_match_day,
            'matchTeamSize' => $this->match_team_size,
            'matchWinGoals' => $this->match_win_goals,
            'matchGameMinutes' => $this->match_game_minutes,
            'matchDefaultTeamMode' => $this->match_default_team_mode,
            'matchDefaultVenue' => $this->match_default_venue ?? '',
            'ratingsEnabled' => $this->ratings_enabled,
            'ratingNewPlayer' => $this->rating_new_player,
            'ratingPositions' => $this->ratingPositions(),
            'ratingMaxSwing' => $this->rating_max_swing,
            'valeAutoAwards' => $this->vale_auto_awards,
            'updatedAt' => $this->updated_at,
        ];
    }

    /**
     * Per-position rating weights with camelCase keys, e.g.
     * { GK: { win, loss, goal, assist, ownGoal, cleanSheet, goalConceded, yellowCard, redCard } }.
     *
     * @return array<string, array<string, float>>
     */
    private function ratingPositions(): array
    {
        return array_map(
            fn (array $weights) => collect($weights)->mapWithKeys(fn ($v, $k) => [Str::camel($k) => $v])->all(),
            $this->resource->positionWeights(),
        );
    }
}
