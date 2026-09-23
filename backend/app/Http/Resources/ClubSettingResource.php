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
            'matchTeamSize' => $this->match_team_size,
            'matchWinGoals' => $this->match_win_goals,
            'updatedAt' => $this->updated_at,
        ];
    }
}
