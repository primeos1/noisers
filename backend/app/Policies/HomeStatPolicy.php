<?php

namespace App\Policies;

use App\Models\User;

class HomeStatPolicy
{
    public function create(User $user): bool
    {
        return $user->isCommittee();
    }

    public function update(User $user): bool
    {
        return $user->isCommittee();
    }

    public function delete(User $user): bool
    {
        return $user->isCommittee();
    }
}
