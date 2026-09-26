<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Shirt numbers are unique again (players are still identified by id).
 *
 * The index can't be added while two players share a number, so in that
 * case this logs who clashes and skips — and takes itself back off the
 * migrations list once the command finishes, so the next deploy tries
 * again. Once the admin gives one of them a new number, the index goes on.
 * New clashes are blocked in the meantime by request validation.
 */
return new class extends Migration
{
    public function up(): void
    {
        if ($this->hasUniqueIndex()) {
            return;
        }

        $clashes = DB::table('players')
            ->select('number')
            ->groupBy('number')
            ->havingRaw('count(*) > 1')
            ->pluck('number');

        if ($clashes->isNotEmpty()) {
            $names = DB::table('players')->whereIn('number', $clashes)->orderBy('number')->get(['number', 'name'])
                ->map(fn ($p) => "#{$p->number} {$p->name}")->implode(', ');
            Log::warning("Shirt numbers aren't unique yet ({$names}); the unique index will be added on a later deploy.");

            $migration = basename(__FILE__, '.php');
            app()->terminating(fn () => DB::table('migrations')->where('migration', $migration)->delete());

            return;
        }

        Schema::table('players', function (Blueprint $table) {
            $table->unique('number');
        });
    }

    public function down(): void
    {
        if ($this->hasUniqueIndex()) {
            Schema::table('players', function (Blueprint $table) {
                $table->dropUnique(['number']);
            });
        }
    }

    private function hasUniqueIndex(): bool
    {
        return collect(Schema::getIndexes('players'))
            ->contains(fn ($index) => $index['unique'] && $index['columns'] === ['number']);
    }
};
