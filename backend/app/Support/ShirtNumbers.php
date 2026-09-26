<?php

namespace App\Support;

use App\Models\Player;
use Closure;

/**
 * Shirt numbers are unique across the squad. The rule names who already
 * wears a number, so the person picking it knows why and can choose again.
 */
class ShirtNumbers
{
    /**
     * Validation rule: the number must not belong to another player.
     * Pass the player being edited so keeping their own number is fine.
     */
    public static function free(?Player $except = null): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($except) {
            $owner = Player::query()
                ->where('number', (int) $value)
                ->when($except, fn ($q) => $q->whereKeyNot($except->getKey()))
                ->first();

            if ($owner) {
                $fail("Number {$owner->number} is already taken by {$owner->name}. Pick another number.");
            }
        };
    }
}
