<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Cards are no longer necessarily tied to an external Fixture — Match
        // Day cards are standalone disciplinary records. Raw SQL avoids an
        // extra doctrine/dbal dependency just for one column-nullability change.
        DB::statement('ALTER TABLE cards MODIFY fixture_id BIGINT UNSIGNED NULL');

        Schema::table('cards', function (Blueprint $table) {
            $table->string('reason')->nullable()->after('type');
            $table->date('occurred_on')->nullable()->after('fine_amount');
        });
    }

    public function down(): void
    {
        Schema::table('cards', function (Blueprint $table) {
            $table->dropColumn(['reason', 'occurred_on']);
        });

        DB::statement('ALTER TABLE cards MODIFY fixture_id BIGINT UNSIGNED NOT NULL');
    }
};
