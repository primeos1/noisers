<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('club_settings', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('yellow_card_fine')->default(2000);
            $table->unsignedInteger('red_card_fine')->default(5000);
            $table->unsignedTinyInteger('match_team_size')->default(6);
            $table->unsignedTinyInteger('match_win_goals')->default(2);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('club_settings');
    }
};
