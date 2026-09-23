<?php

namespace Database\Factories;

use App\Models\TrainingSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TrainingSession>
 */
class TrainingSessionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'scheduled_at' => $this->faker->dateTimeBetween('-1 month', '+1 month'),
            'location' => $this->faker->randomElement(['Zenith Astro, Pitch 2', 'Vale Sports Centre']),
            'notes' => $this->faker->optional()->sentence(),
        ];
    }
}
