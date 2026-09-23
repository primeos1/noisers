<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vale_content', function (Blueprint $table) {
            $table->id();

            // Team of the Week
            $table->string('team_week_title')->nullable();
            $table->string('team_week_date_range')->nullable();
            $table->unsignedInteger('team_sessions_won')->default(0);
            $table->unsignedInteger('team_sessions_played')->default(0);
            $table->string('team_rival')->nullable();
            $table->string('team_score')->nullable();
            $table->string('team_photo_url')->nullable();
            $table->json('team_lineup_numbers')->nullable();

            // Player of the Week
            $table->unsignedInteger('potw_player_number')->nullable();
            $table->text('potw_note')->nullable();
            $table->decimal('potw_rating', 3, 1)->nullable();

            // Most Improved
            $table->unsignedInteger('improved_player_number')->nullable();
            $table->text('improved_note')->nullable();
            $table->decimal('improved_prev_rating', 3, 1)->nullable();
            $table->decimal('improved_curr_rating', 3, 1)->nullable();

            // Weekly Leaders
            $table->unsignedInteger('leader_top_scorer_number')->nullable();
            $table->unsignedInteger('leader_top_scorer_value')->nullable();
            $table->unsignedInteger('leader_top_assist_number')->nullable();
            $table->unsignedInteger('leader_top_assist_value')->nullable();
            $table->json('leader_clean_sheet_numbers')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vale_content');
    }
};
