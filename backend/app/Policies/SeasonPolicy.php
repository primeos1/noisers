<?php

namespace App\Policies;

use App\Models\Season;
use App\Models\User;

class SeasonPolicy
{
    public function create(User $user): bool
    {
        return $user->isCommittee();
    }

    public function update(User $user, Season $season): bool
    {
        return $user->isCommittee();
    }

    public function delete(User $user, Season $season): bool
    {
        return $user->isCommittee();
    }
}
