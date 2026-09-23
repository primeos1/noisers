<?php

namespace Database\Factories;

use App\Models\Player;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Player>
 */
class PlayerFactory extends Factory
{
    protected static int $nextNumber = 1;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'number' => self::$nextNumber++,
            'name' => $this->faker->name('male'),
            'position' => $this->faker->randomElement(['GK', 'DEF', 'MID', 'FWD']),
            'bio' => $this->faker->optional()->sentence(12),
            'phone' => $this->faker->optional()->phoneNumber(),
            'email' => $this->faker->optional()->safeEmail(),
            'photo_url' => null,
            'active' => true,
        ];
    }
}
