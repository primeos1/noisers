<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    /**
     * Adds the chairman's committee login. The password comes from
     * CHAIRMAN_PASSWORD so it stays out of the repo; without it set, no
     * account is made (the seeder can add one later).
     */
    public function up(): void
    {
        $email = env('CHAIRMAN_EMAIL', 'chairman@noisersfc.com');
        $password = env('CHAIRMAN_PASSWORD');
        if (! $password || DB::table('users')->where('email', $email)->exists()) {
            return;
        }

        DB::table('users')->insert([
            'name' => 'Chairman',
            'email' => $email,
            'password' => Hash::make($password),
            'role' => 'committee',
            'email_verified_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('users')->where('email', env('CHAIRMAN_EMAIL', 'chairman@noisersfc.com'))->delete();
    }
};
