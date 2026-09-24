<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Links a disciplinary card back to the Match Day card it was created
        // from ("{event}:{game}:{card}"), so ending a match day is idempotent.
        Schema::table('cards', function (Blueprint $table) {
            $table->string('match_day_ref')->nullable()->unique()->after('fixture_id');
        });
    }

    public function down(): void
    {
        Schema::table('cards', function (Blueprint $table) {
            $table->dropUnique(['match_day_ref']);
            $table->dropColumn('match_day_ref');
        });
    }
};
