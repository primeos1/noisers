<?php

namespace App\Policies;

use App\Models\User;

class ValeContentPolicy
{
    public function update(User $user): bool
    {
        return $user->isCommittee();
    }
}
