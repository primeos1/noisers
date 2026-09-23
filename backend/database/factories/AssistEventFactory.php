<?php

namespace Database\Factories;

use App\Models\AssistEvent;
use App\Models\Fixture;
use App\Models\Player;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssistEvent>
 */
class AssistEventFactory extends Factory
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
            'goal_event_id' => null,
            'minute' => $this->faker->numberBetween(1, 90),
        ];
    }
}
