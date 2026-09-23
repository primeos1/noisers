<?php

namespace App\Policies;

use App\Models\RandomizedTeam;
use App\Models\User;

class RandomizedTeamPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isCommittee();
    }

    public function view(User $user, RandomizedTeam $randomizedTeam): bool
    {
        return $user->isCommittee();
    }

    public function create(User $user): bool
    {
        return $user->isCommittee();
    }

    public function update(User $user, RandomizedTeam $randomizedTeam): bool
    {
        return $user->isCommittee();
    }

    public function delete(User $user, RandomizedTeam $randomizedTeam): bool
    {
        return $user->isCommittee();
    }
}
