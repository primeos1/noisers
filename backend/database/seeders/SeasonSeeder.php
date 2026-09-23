<?php

namespace Database\Seeders;

use App\Models\Season;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class SeasonSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $today = Carbon::today();
        $startYear = $today->month >= 8 ? $today->year : $today->year - 1;

        Season::where('is_current', true)->update(['is_current' => false]);

        Season::updateOrCreate(
            ['name' => sprintf('%d/%d', $startYear, ($startYear + 1) % 100)],
            [
                'start_date' => sprintf('%d-08-01', $startYear),
                'end_date' => sprintf('%d-05-31', $startYear + 1),
                'is_current' => true,
            ]
        );
    }
}
