<?php

namespace App\Policies;

use App\Models\Card;
use App\Models\User;

class CardPolicy
{
    // Reads are public so the passcode-only player portal can show every
    // player's cards and fines; writes stay committee-only.
    public function viewAny(?User $user): bool
    {
        return true;
    }

    public function view(?User $user, Card $card): bool
    {
        return true;
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
