<?php

namespace Database\Factories;

use App\Models\Fixture;
use App\Models\Season;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Fixture>
 */
class FixtureFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $isPast = $this->faker->boolean();
        $kickoff = $isPast
            ? $this->faker->dateTimeBetween('-3 months', '-1 day')
            : $this->faker->dateTimeBetween('+1 day', '+3 months');

        $status = $isPast ? 'completed' : 'scheduled';

        return [
            'season_id' => Season::factory(),
            'opponent' => $this->faker->company().' FC',
            'competition' => $this->faker->randomElement([
                'Vale Sunday 5-a-side League',
                'County Cup',
                'Friendly',
            ]),
            'kickoff_at' => $kickoff,
            'venue' => $this->faker->randomElement(['Home', 'Away']),
            'location' => $this->faker->randomElement(['Zenith Astro, Pitch 2', 'Vale Sports Centre', 'Kestrel Park']),
            'status' => $status,
            'score_for' => $status === 'completed' ? $this->faker->numberBetween(0, 7) : null,
            'score_against' => $status === 'completed' ? $this->faker->numberBetween(0, 7) : null,
        ];
    }

    public function upcoming(): static
    {
        return $this->state(fn () => [
            'kickoff_at' => $this->faker->dateTimeBetween('+1 day', '+2 months'),
            'status' => 'scheduled',
            'score_for' => null,
            'score_against' => null,
        ]);
    }

    public function completed(): static
    {
        return $this->state(function () {
            $scoreFor = $this->faker->numberBetween(0, 7);
            $scoreAgainst = $this->faker->numberBetween(0, 7);

            return [
                'kickoff_at' => $this->faker->dateTimeBetween('-2 months', '-1 day'),
                'status' => 'completed',
                'score_for' => $scoreFor,
                'score_against' => $scoreAgainst,
            ];
        });
    }
}
