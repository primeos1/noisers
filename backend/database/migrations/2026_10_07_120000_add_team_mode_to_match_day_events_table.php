<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // How the teams were last drawn (random, by rating or by position) —
        // shown on the public Live Match page. Null until teams are drawn.
        Schema::table('match_day_events', function (Blueprint $table) {
            $table->string('team_mode')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('match_day_events', function (Blueprint $table) {
            $table->dropColumn('team_mode');
        });
    }
};
