<?php

namespace App\Policies;

use App\Models\Card;
use App\Models\User;

class CardPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isCommittee();
    }

    public function view(User $user, Card $card): bool
    {
        return $user->isCommittee();
    }

    public function create(User $user): bool
    {
        return $user->isCommittee();
    }

    public function update(User $user, Card $card): bool
    {
        return $user->isCommittee();
    }

    public function delete(User $user, Card $card): bool
    {
        return $user->isCommittee();
    }
}
