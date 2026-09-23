<?php

namespace App\Policies;

use App\Models\Player;
use App\Models\User;

class PlayerPolicy
{
    public function create(User $user): bool
    {
        return $user->isCommittee();
    }

    public function update(User $user, Player $player): bool
    {
        return $user->isCommittee();
    }

    public function delete(User $user, Player $player): bool
    {
        return $user->isCommittee();
    }
}
