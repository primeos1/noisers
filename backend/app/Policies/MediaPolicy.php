<?php

namespace App\Policies;

use App\Models\User;

class MediaPolicy
{
    public function create(User $user): bool
    {
        return $user->isCommittee();
    }

    public function delete(User $user): bool
    {
        return $user->isCommittee();
    }
}
