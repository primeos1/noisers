<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Moves the chairman's committee login from chairman@ to president@,
     * unless a president@ account already exists.
     */
    public function up(): void
    {
        if (DB::table('users')->where('email', 'president@noisersfc.com')->exists()) {
            return;
        }

        DB::table('users')
            ->where('email', 'chairman@noisersfc.com')
            ->update(['email' => 'president@noisersfc.com', 'updated_at' => now()]);
    }

    public function down(): void
    {
        if (DB::table('users')->where('email', 'chairman@noisersfc.com')->exists()) {
            return;
        }

        DB::table('users')
            ->where('email', 'president@noisersfc.com')
            ->update(['email' => 'chairman@noisersfc.com', 'updated_at' => now()]);
    }
};
