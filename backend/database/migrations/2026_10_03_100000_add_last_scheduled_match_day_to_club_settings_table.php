<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The Lagos date (Y-m-d) MatchDaySchedule last opened a match day
        // for — so it opens each one once, even if the admin deletes it.
        Schema::table('club_settings', function (Blueprint $table) {
            $table->string('last_scheduled_match_day')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('club_settings', function (Blueprint $table) {
            $table->dropColumn('last_scheduled_match_day');
        });
    }
};
