<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Ratings move in small steps after each match day, so keep two decimal
    // places instead of rounding most of the movement away.
    public function up(): void
    {
        Schema::table('players', function (Blueprint $table) {
            $table->decimal('rating', 4, 2)->default(6.0)->change();
        });

        Schema::table('player_rating_changes', function (Blueprint $table) {
            $table->decimal('rating_before', 4, 2)->change();
            $table->decimal('rating_after', 4, 2)->change();
        });

        Schema::table('vale_content', function (Blueprint $table) {
            $table->decimal('improved_prev_rating', 4, 2)->nullable()->change();
            $table->decimal('improved_curr_rating', 4, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('players', function (Blueprint $table) {
            $table->decimal('rating', 3, 1)->default(6.0)->change();
        });

        Schema::table('player_rating_changes', function (Blueprint $table) {
            $table->decimal('rating_before', 3, 1)->change();
            $table->decimal('rating_after', 3, 1)->change();
        });

        Schema::table('vale_content', function (Blueprint $table) {
            $table->decimal('improved_prev_rating', 3, 1)->nullable()->change();
            $table->decimal('improved_curr_rating', 3, 1)->nullable()->change();
        });
    }
};
