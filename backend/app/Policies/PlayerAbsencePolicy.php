<?php

namespace App\Policies;

use App\Models\PlayerAbsence;
use App\Models\User;

class PlayerAbsencePolicy
{
    // Who's out is public (the squad pages and Noisers show it); only the
    // committee tags players in or out.
    public function create(User $user): bool
    {
        return $user->isCommittee();
    }

    public function update(User $user, PlayerAbsence $absence): bool
    {
        return $user->isCommittee();
    }

    public function delete(User $user, PlayerAbsence $absence): bool
    {
        return $user->isCommittee();
    }
}
