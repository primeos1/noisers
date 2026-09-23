<?php

namespace App\Policies;

use App\Models\User;

class ClubSettingPolicy
{
    /**
     * Club-wide fine amounts and match defaults are admin-only — committee
     * users can view settings but not change them.
     */
    public function update(User $user): bool
    {
        return $user->isAdmin();
    }
}
