<?php

namespace App\Policies;

use App\Models\GoalEvent;
use App\Models\User;

class GoalEventPolicy
{
    public function create(User $user): bool
    {
        return $user->isCommittee();
    }

    public function update(User $user, GoalEvent $goalEvent): bool
    {
        return $user->isCommittee();
    }

    public function delete(User $user, GoalEvent $goalEvent): bool
    {
        return $user->isCommittee();
    }
}
