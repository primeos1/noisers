<?php

namespace App\Http\Resources;

use App\Support\MatchDayFinalizer;
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
                'lineupPlayerIds' => $this->team_lineup_player_ids ?? [],
            ],
            'playerOfTheWeek' => [
                'playerId' => $this->potw_player_id,
                'note' => $this->potw_note,
                'weekRating' => $this->potw_rating !== null ? (float) $this->potw_rating : null,
                'timesWon' => $this->potw_player_id !== null ? MatchDayFinalizer::playerOfTheWeekWins($this->potw_player_id) : 0,
            ],
            'mostImproved' => [
                'playerId' => $this->improved_player_id,
                'note' => $this->improved_note,
                'previousRating' => $this->improved_prev_rating !== null ? (float) $this->improved_prev_rating : null,
                'currentRating' => $this->improved_curr_rating !== null ? (float) $this->improved_curr_rating : null,
            ],
            'flopOfTheWeek' => [
                'playerId' => $this->flop_player_id,
                'note' => $this->flop_note,
            ],
            'weeklyLeaders' => [
                'topScorer' => [
                    'playerId' => $this->leader_top_scorer_player_id,
                    'value' => $this->leader_top_scorer_value,
                ],
                'topAssist' => [
                    'playerId' => $this->leader_top_assist_player_id,
                    'value' => $this->leader_top_assist_value,
                ],
                'topSaves' => [
                    'playerId' => $this->leader_top_saves_player_id,
                    'value' => $this->leader_top_saves_value,
                ],
                'cleanSheets' => $this->leader_clean_sheet_player_ids ?? [],
                'cleanSheetTeam' => [
                    'name' => $this->leader_clean_sheet_team,
                    'value' => $this->leader_clean_sheet_value,
                ],
                'badBoys' => $this->leader_bad_boys ?? [],
            ],
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
