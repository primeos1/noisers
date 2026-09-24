<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ValeContentResource;
use App\Models\ValeContent;
use Illuminate\Http\Request;

class ValeContentController extends Controller
{
    /**
     * Public — powers The Vale.
     */
    public function show()
    {
        // Force 200: Eloquent's firstOrCreate() in ValeContent::current() can
        // mark the model wasRecentlyCreated on a first-ever request, which
        // would otherwise make a plain GET report itself as 201 Created.
        return (new ValeContentResource(ValeContent::current()))->response()->setStatusCode(200);
    }

    /**
     * Update this week's awards. Committee/admin only.
     */
    public function update(Request $request)
    {
        $content = ValeContent::current();

        $this->authorize('update', $content);

        $validated = $request->validate([
            'team_week_title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'team_week_date_range' => ['sometimes', 'nullable', 'string', 'max:255'],
            'team_sessions_won' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'team_sessions_played' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'team_rival' => ['sometimes', 'nullable', 'string', 'max:255'],
            'team_score' => ['sometimes', 'nullable', 'string', 'max:50'],
            'team_photo_url' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'team_lineup_numbers' => ['sometimes', 'nullable', 'array'],
            'team_lineup_numbers.*' => ['integer'],

            'potw_player_number' => ['sometimes', 'nullable', 'integer', 'exists:players,number'],
            'potw_note' => ['sometimes', 'nullable', 'string'],
            'potw_rating' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:10'],

            'improved_player_number' => ['sometimes', 'nullable', 'integer', 'exists:players,number'],
            'improved_note' => ['sometimes', 'nullable', 'string'],
            'improved_prev_rating' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:10'],
            'improved_curr_rating' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:10'],

            'leader_top_scorer_number' => ['sometimes', 'nullable', 'integer', 'exists:players,number'],
            'leader_top_scorer_value' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'leader_top_assist_number' => ['sometimes', 'nullable', 'integer', 'exists:players,number'],
            'leader_top_assist_value' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'leader_clean_sheet_numbers' => ['sometimes', 'nullable', 'array'],
            'leader_clean_sheet_numbers.*' => ['integer'],
            'leader_roughest_number' => ['sometimes', 'nullable', 'integer', 'exists:players,number'],
            'leader_roughest_yellow' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'leader_roughest_red' => ['sometimes', 'nullable', 'integer', 'min:0'],
        ]);

        $content->update($validated);

        return (new ValeContentResource($content))->response()->setStatusCode(200);
    }
}
