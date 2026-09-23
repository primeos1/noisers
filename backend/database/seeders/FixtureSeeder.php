<?php

namespace Database\Seeders;

use App\Models\Fixture;
use App\Models\GoalEvent;
use App\Models\Player;
use App\Models\Season;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class FixtureSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * Mirrors frontend/src/lib/clubData.ts's nextFixture and latestResult
     * so the site and API agree until the frontend swaps to real fetch() calls.
     */
    public function run(): void
    {
        $season = Season::where('is_current', true)->first() ?? Season::first();

        $nextFixture = Fixture::updateOrCreate(
            ['opponent' => 'Kestrel Athletic', 'competition' => 'Vale Sunday 5-a-side League'],
            [
                'season_id' => $season->id,
                'kickoff_at' => Carbon::parse('next Saturday')->setTime(15, 0),
                'venue' => 'Home',
                'location' => 'Zenith Astro, Pitch 2',
                'status' => 'scheduled',
                'score_for' => null,
                'score_against' => null,
            ]
        );

        $latestResult = Fixture::updateOrCreate(
            ['opponent' => 'Dockside Rovers', 'competition' => 'Vale Sunday 5-a-side League'],
            [
                'season_id' => $season->id,
                'kickoff_at' => Carbon::parse('last Saturday')->setTime(15, 0),
                'venue' => 'Away',
                'location' => 'Dockside Rovers FC',
                'status' => 'completed',
                'score_for' => 4,
                'score_against' => 2,
            ]
        );

        $scorers = [
            ['surname' => 'Idehen', 'minute' => 2],
            ['surname' => 'Fashola', 'minute' => 34],
            ['surname' => 'Owolabi', 'minute' => 61],
        ];

        foreach ($scorers as $scorer) {
            $player = Player::where('name', 'like', '%'.$scorer['surname'])->first();

            if (! $player) {
                continue;
            }

            GoalEvent::updateOrCreate(
                [
                    'fixture_id' => $latestResult->id,
                    'player_id' => $player->id,
                    'minute' => $scorer['minute'],
                ]
            );
        }
    }
}
