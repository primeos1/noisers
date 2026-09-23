<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ValeContentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'teamOfTheWeek' => [
                'title' => $this->team_week_title,
                'dateRange' => $this->team_week_date_range,
                'sessionsWon' => $this->team_sessions_won,
                'sessionsPlayed' => $this->team_sessions_played,
                'rivalTeam' => $this->team_rival,
                'score' => $this->team_score,
                'photoUrl' => $this->team_photo_url,
                'lineupNumbers' => $this->team_lineup_numbers ?? [],
            ],
            'playerOfTheWeek' => [
                'playerNumber' => $this->potw_player_number,
                'note' => $this->potw_note,
                'weekRating' => $this->potw_rating !== null ? (float) $this->potw_rating : null,
            ],
            'mostImproved' => [
                'playerNumber' => $this->improved_player_number,
                'note' => $this->improved_note,
                'previousRating' => $this->improved_prev_rating !== null ? (float) $this->improved_prev_rating : null,
                'currentRating' => $this->improved_curr_rating !== null ? (float) $this->improved_curr_rating : null,
            ],
            'weeklyLeaders' => [
                'topScorer' => [
                    'playerNumber' => $this->leader_top_scorer_number,
                    'value' => $this->leader_top_scorer_value,
                ],
                'topAssist' => [
                    'playerNumber' => $this->leader_top_assist_number,
                    'value' => $this->leader_top_assist_value,
                ],
                'cleanSheets' => $this->leader_clean_sheet_numbers ?? [],
            ],
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
