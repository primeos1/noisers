<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('players', function (Blueprint $table) {
            // The only player "stat" that's an admin judgment call rather
            // than derived from match history — used to balance teams on
            // Match Day ("distribute by rating").
            $table->decimal('rating', 3, 1)->default(0)->after('position');
        });
    }

    public function down(): void
    {
        Schema::table('players', function (Blueprint $table) {
            $table->dropColumn('rating');
        });
    }
};
