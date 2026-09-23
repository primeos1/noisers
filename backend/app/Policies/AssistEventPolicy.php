<?php

namespace App\Policies;

use App\Models\AssistEvent;
use App\Models\User;

class AssistEventPolicy
{
    public function create(User $user): bool
    {
        return $user->isCommittee();
    }

    public function update(User $user, AssistEvent $assistEvent): bool
    {
        return $user->isCommittee();
    }

    public function delete(User $user, AssistEvent $assistEvent): bool
    {
        return $user->isCommittee();
    }
}
