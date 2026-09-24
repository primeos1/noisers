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
        // Day cards are standalone disciplinary records. MySQL (dev/prod) uses
        // raw SQL to avoid a doctrine/dbal dependency; SQLite (the test suite,
        // see phpunit.xml) has no MODIFY COLUMN syntax at all, so it goes
        // through Schema's own cross-driver column rebuild instead.
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('cards', function (Blueprint $table) {
                $table->unsignedBigInteger('fixture_id')->nullable()->change();
            });
        } else {
            DB::statement('ALTER TABLE cards MODIFY fixture_id BIGINT UNSIGNED NULL');
        }

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

        if (DB::getDriverName() === 'sqlite') {
            Schema::table('cards', function (Blueprint $table) {
                $table->unsignedBigInteger('fixture_id')->nullable(false)->change();
            });
        } else {
            DB::statement('ALTER TABLE cards MODIFY fixture_id BIGINT UNSIGNED NOT NULL');
        }
    }
};
