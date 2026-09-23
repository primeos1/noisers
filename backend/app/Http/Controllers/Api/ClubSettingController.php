<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ClubSettingResource;
use App\Models\ClubSetting;
use Illuminate\Http\Request;

class ClubSettingController extends Controller
{
    /**
     * The club's fine amounts and match defaults — public so the card form
     * and match day screens can read current values without being admin.
     */
    public function show()
    {
        return new ClubSettingResource(ClubSetting::current());
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
            'match_team_size' => ['sometimes', 'integer', 'min:2', 'max:11'],
            'match_win_goals' => ['sometimes', 'integer', 'min:1'],
        ]);

        $setting->update($validated);

        return new ClubSettingResource($setting);
    }
}
