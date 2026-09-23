<?php

namespace App\Policies;

use App\Models\Fixture;
use App\Models\User;

class FixturePolicy
{
    public function create(User $user): bool
    {
        return $user->isCommittee();
    }

    public function update(User $user, Fixture $fixture): bool
    {
        return $user->isCommittee();
    }

    public function delete(User $user, Fixture $fixture): bool
    {
        return $user->isCommittee();
    }
}
