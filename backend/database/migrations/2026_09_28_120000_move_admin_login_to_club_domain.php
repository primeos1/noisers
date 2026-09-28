<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    /**
     * Moves the seeded admin off the .test placeholder onto the club's real
     * domain. The new password comes from ADMIN_PASSWORD so it stays out of
     * the repo; without it set, the email moves and the password is left.
     */
    public function up(): void
    {
        $email = env('ADMIN_EMAIL', 'admin@noisersfc.com');
        if (DB::table('users')->where('email', $email)->exists()) {
            return;
        }

        $changes = ['email' => $email, 'updated_at' => now()];
        if ($password = env('ADMIN_PASSWORD')) {
            $changes['password'] = Hash::make($password);
        }

        DB::table('users')->where('email', 'admin@noisersfc.test')->update($changes);
    }

    public function down(): void
    {
        // Irreversible — the old password isn't kept.
    }
};
