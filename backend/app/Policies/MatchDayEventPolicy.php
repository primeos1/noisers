<?php

namespace App\Policies;

use App\Models\User;

class MatchDayEventPolicy
{
    // The stat analyst runs match days too; deleting one (which unwinds its
    // cards, ratings and awards) stays with the committee.
    public function create(User $user): bool
    {
        return $user->canRunMatchDay();
    }

    public function update(User $user): bool
    {
        return $user->canRunMatchDay();
    }

    public function delete(User $user): bool
    {
        return $user->isCommittee();
    }
}
