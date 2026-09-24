<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ClubSettingResource;
use App\Models\ClubSetting;
use App\Support\PlayerRatings;
use Illuminate\Http\Request;

class ClubSettingController extends Controller
{
    /**
     * The club's fine amounts and match defaults — public so the card form
     * and match day screens can read current values without being admin.
     */
    public function show()
    {
        // Force 200 — ClubSetting::current()'s firstOrCreate() can mark the
        // model wasRecentlyCreated on a first-ever request, which would
        // otherwise make a plain GET report itself as 201 Created.
        return (new ClubSettingResource(ClubSetting::current()))->response()->setStatusCode(200);
    }

    /**
     * Update the club's fine amounts and match defaults. Admin-only.
     */
    public function update(Request $request)
    {
        $setting = ClubSetting::current();

        $this->authorize('update', $setting);

        $validated = $request->validate([
            'yellow_card_fine' => ['sometimes', 'integer', 'min:0'],
            'red_card_fine' => ['sometimes', 'integer', 'min:0'],
            'fines_from_match_day' => ['sometimes', 'boolean'],
            'match_team_size' => ['sometimes', 'integer', 'min:2', 'max:11'],
            'match_win_goals' => ['sometimes', 'integer', 'min:1', 'max:20'],
            'match_game_minutes' => ['sometimes', 'integer', 'min:1', 'max:90'],
            'match_default_team_mode' => ['sometimes', 'in:random,rating,position'],
            'match_default_venue' => ['sometimes', 'nullable', 'string', 'max:255'],
            'ratings_enabled' => ['sometimes', 'boolean'],
            'rating_new_player' => ['sometimes', 'numeric', 'min:'.PlayerRatings::MIN, 'max:'.PlayerRatings::MAX],
            'rating_win' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'rating_loss' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'rating_goal' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'rating_assist' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'rating_own_goal' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'rating_clean_sheet_gk' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'rating_clean_sheet_def' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'rating_clean_sheet_mid' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'rating_clean_sheet_fwd' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'rating_max_swing' => ['sometimes', 'numeric', 'min:0.05', 'max:2'],
            'vale_auto_awards' => ['sometimes', 'boolean'],
        ]);

        $setting->update($validated);

        return (new ClubSettingResource($setting))->response()->setStatusCode(200);
    }
}
