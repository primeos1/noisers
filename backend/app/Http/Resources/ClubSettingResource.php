<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

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
            'ratingWin' => $this->rating_win,
            'ratingLoss' => $this->rating_loss,
            'ratingGoal' => $this->rating_goal,
            'ratingAssist' => $this->rating_assist,
            'ratingOwnGoal' => $this->rating_own_goal,
            'ratingCleanSheetGk' => $this->rating_clean_sheet_gk,
            'ratingCleanSheetDef' => $this->rating_clean_sheet_def,
            'ratingCleanSheetMid' => $this->rating_clean_sheet_mid,
            'ratingCleanSheetFwd' => $this->rating_clean_sheet_fwd,
            'ratingMaxSwing' => $this->rating_max_swing,
            'valeAutoAwards' => $this->vale_auto_awards,
            'updatedAt' => $this->updated_at,
        ];
    }
}
