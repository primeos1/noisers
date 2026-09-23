<?php

namespace Database\Seeders;

use App\Models\Player;
use Illuminate\Database\Seeder;

class PlayerSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * Mirrors frontend/src/lib/clubData.ts so the admin dashboard and the
     * public site show the same squad until real fetch() calls replace it.
     */
    public function run(): void
    {
        $squad = [
            ['number' => 1, 'name' => 'Femi Adaralegbe', 'position' => 'GK'],
            ['number' => 4, 'name' => 'Tunde Bakare', 'position' => 'DEF'],
            ['number' => 5, 'name' => 'Chike Obinna', 'position' => 'DEF'],
            ['number' => 7, 'name' => 'Segun Owolabi', 'position' => 'MID'],
            ['number' => 8, 'name' => 'Kelechi Uzo', 'position' => 'MID'],
            ['number' => 9, 'name' => 'Marcus Idehen', 'position' => 'FWD'],
            ['number' => 10, 'name' => 'Dayo Fashola', 'position' => 'FWD'],
            ['number' => 11, 'name' => 'Rasheed Animashaun', 'position' => 'FWD'],
            ['number' => 14, 'name' => 'Ola Jegede', 'position' => 'MID'],
            ['number' => 22, 'name' => 'Biodun Salako', 'position' => 'DEF'],
        ];

        foreach ($squad as $player) {
            Player::updateOrCreate(
                ['number' => $player['number']],
                [
                    'name' => $player['name'],
                    'position' => $player['position'],
                    'active' => true,
                ]
            );
        }
    }
}
