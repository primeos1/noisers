<?php

namespace Database\Factories;

use App\Models\Fixture;
use App\Models\GoalEvent;
use App\Models\Player;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GoalEvent>
 */
class GoalEventFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'player_id' => Player::factory(),
            'fixture_id' => Fixture::factory()->completed(),
            'minute' => $this->faker->numberBetween(1, 90),
        ];
    }
}
