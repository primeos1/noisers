<?php

use App\Support\MatchDayFinalizer;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Match day titles are no longer typed in — rename the existing ones to
     * "Matchday 1", "Matchday 2"… in the order they were created.
     */
    public function up(): void
    {
        MatchDayFinalizer::renumber();
    }

    public function down(): void
    {
        // The old free-text titles aren't kept.
    }
};
