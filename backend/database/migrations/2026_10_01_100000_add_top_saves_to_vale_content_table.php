<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Keepers' saves are logged on match day now — The Vale names the
     * keeper who made the most.
     */
    public function up(): void
    {
        Schema::table('vale_content', function (Blueprint $table) {
            $table->unsignedInteger('leader_top_saves_player_id')->nullable()->after('leader_top_assist_value');
            $table->unsignedInteger('leader_top_saves_value')->nullable()->after('leader_top_saves_player_id');
        });
    }

    public function down(): void
    {
        Schema::table('vale_content', function (Blueprint $table) {
            $table->dropColumn(['leader_top_saves_player_id', 'leader_top_saves_value']);
        });
    }
};
