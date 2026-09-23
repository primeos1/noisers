<?php

namespace App\Policies;

use App\Models\TrainingSession;
use App\Models\User;

class TrainingSessionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isCommittee();
    }

    public function view(User $user, TrainingSession $trainingSession): bool
    {
        return $user->isCommittee();
    }

    public function create(User $user): bool
    {
        return $user->isCommittee();
    }

    public function update(User $user, TrainingSession $trainingSession): bool
    {
        return $user->isCommittee();
    }

    public function delete(User $user, TrainingSession $trainingSession): bool
    {
        return $user->isCommittee();
    }
}
