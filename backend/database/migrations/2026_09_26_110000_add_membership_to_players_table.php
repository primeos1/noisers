<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Whether a player is a full member of the club or a guest member.
     * Everyone already in the squad is a member.
     */
    public function up(): void
    {
        Schema::table('players', function (Blueprint $table) {
            $table->enum('membership', ['member', 'guest'])->default('member')->after('secondary_position');
        });
    }

    public function down(): void
    {
        Schema::table('players', function (Blueprint $table) {
            $table->dropColumn('membership');
        });
    }
};
