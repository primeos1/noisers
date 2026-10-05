<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Bumped on every save, so two admins recording the same match day
        // can't overwrite each other's edits (see MatchDayEventController::update).
        Schema::table('match_day_events', function (Blueprint $table) {
            $table->unsignedInteger('version')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('match_day_events', function (Blueprint $table) {
            $table->dropColumn('version');
        });
    }
};
