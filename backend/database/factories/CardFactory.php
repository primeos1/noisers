<?php

namespace Database\Factories;

use App\Models\Card;
use App\Models\Fixture;
use App\Models\Player;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Card>
 */
class CardFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $type = $this->faker->randomElement(['yellow', 'yellow', 'yellow', 'red']);

        return [
            'player_id' => Player::factory(),
            'fixture_id' => Fixture::factory()->completed(),
            'type' => $type,
            'fine_amount' => $type === 'red' ? 10 : 5,
            'paid' => $this->faker->boolean(60),
        ];
    }
}
