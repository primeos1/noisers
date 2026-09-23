<?php

namespace Database\Factories;

use App\Models\RandomizedTeam;
use App\Models\TrainingSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RandomizedTeam>
 */
class RandomizedTeamFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'training_session_id' => TrainingSession::factory(),
            'name' => 'Team '.$this->faker->randomLetter(),
            'player_ids' => [],
        ];
    }
}
