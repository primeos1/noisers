<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Rating penalties for cards picked up on a match day — entered as
        // positive amounts, like the loss and own-goal weights.
        Schema::table('club_settings', function (Blueprint $table) {
            $table->decimal('rating_yellow_card', 4, 2)->default(0.05);
            $table->decimal('rating_red_card', 4, 2)->default(0.15);
        });

        // The Vale's weekly "roughest player" — most cards that match day.
        Schema::table('vale_content', function (Blueprint $table) {
            $table->unsignedInteger('leader_roughest_number')->nullable();
            $table->unsignedInteger('leader_roughest_yellow')->nullable();
            $table->unsignedInteger('leader_roughest_red')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('club_settings', function (Blueprint $table) {
            $table->dropColumn(['rating_yellow_card', 'rating_red_card']);
        });

        Schema::table('vale_content', function (Blueprint $table) {
            $table->dropColumn(['leader_roughest_number', 'leader_roughest_yellow', 'leader_roughest_red']);
        });
    }
};
