<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // firstOrCreate, not update — reseeding on deploy mustn't undo a
        // password changed in Settings.
        User::firstOrCreate(
            ['email' => env('ADMIN_EMAIL', 'admin@noisersfc.com')],
            [
                'name' => 'Club Admin',
                'password' => Hash::make(env('ADMIN_PASSWORD', 'password')),
                'role' => 'admin',
                'email_verified_at' => now(),
            ]
        );

        User::firstOrCreate(
            ['email' => env('CHAIRMAN_EMAIL', 'chairman@noisersfc.com')],
            [
                'name' => 'Chairman',
                'password' => Hash::make(env('CHAIRMAN_PASSWORD', 'password')),
                'role' => 'committee',
                'email_verified_at' => now(),
            ]
        );
    }
}
