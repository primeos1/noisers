<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Adds the team stat analyst role, which may only run Match Day, and its
     * login. The password comes from ANALYST_PASSWORD so it stays out of the
     * repo; without it set, no account is made (the seeder can add one later).
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['admin', 'committee', 'analyst'])->default('committee')->change();
        });

        $email = env('ANALYST_EMAIL', 'analyst@noisersfc.com');
        $password = env('ANALYST_PASSWORD');
        if (! $password || DB::table('users')->where('email', $email)->exists()) {
            return;
        }

        DB::table('users')->insert([
            'name' => 'Stat Analyst',
            'email' => $email,
            'password' => Hash::make($password),
            'role' => 'analyst',
            'email_verified_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        $analysts = DB::table('users')->where('role', 'analyst');
        DB::table('personal_access_tokens')
            ->where('tokenable_type', 'App\Models\User')
            ->whereIn('tokenable_id', (clone $analysts)->pluck('id'))
            ->delete();
        $analysts->delete();

        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['admin', 'committee'])->default('committee')->change();
        });
    }
};
