<?php

namespace App\Policies;

use App\Models\User;

class HomeContentPolicy
{
    public function update(User $user): bool
    {
        return $user->isCommittee();
    }
}
