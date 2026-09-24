<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per player per ended match day — a rating history, and the
        // guard that keeps PlayerRatings::apply() from counting a day twice.
        Schema::create('player_rating_changes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('player_id')->constrained()->cascadeOnDelete();
            $table->string('match_day_event_id');
            $table->decimal('points', 5, 2);
            $table->decimal('rating_before', 3, 1);
            $table->decimal('rating_after', 3, 1);
            $table->timestamps();

            $table->unique(['player_id', 'match_day_event_id']);
        });

        // Ratings now live in [4.0, 9.5]. Unrated players (0) start at 6.0.
        DB::table('players')->where('rating', 0)->update(['rating' => 6.0]);
        DB::table('players')->where('rating', '<', 4.0)->update(['rating' => 4.0]);
        DB::table('players')->where('rating', '>', 9.5)->update(['rating' => 9.5]);

        Schema::table('players', function (Blueprint $table) {
            $table->decimal('rating', 3, 1)->default(6.0)->change();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('player_rating_changes');

        Schema::table('players', function (Blueprint $table) {
            $table->decimal('rating', 3, 1)->default(0)->change();
        });
    }
};
