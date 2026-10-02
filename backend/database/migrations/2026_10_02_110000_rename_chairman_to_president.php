<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The club calls the role President now: rename the committee login
     * (shown in the admin greeting) and any executive titled Chairman,
     * including Vice Chairman.
     */
    public function up(): void
    {
        DB::table('users')
            ->where('email', 'president@noisersfc.com')
            ->where('name', 'Chairman')
            ->update(['name' => 'President', 'updated_at' => now()]);

        DB::table('executives')
            ->where('title', 'like', '%Chairman%')
            ->update([
                'title' => DB::raw("REPLACE(title, 'Chairman', 'President')"),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('users')
            ->where('email', 'president@noisersfc.com')
            ->where('name', 'President')
            ->update(['name' => 'Chairman', 'updated_at' => now()]);
    }
};
