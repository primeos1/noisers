<?php

use App\Models\ValeContent;
use Illuminate\Database\Migrations\Migration;

/**
 * The player of the week note no longer names the match day ("… of the week
 * at Matchday 4."). Drop it from the saved note.
 */
return new class extends Migration
{
    public function up(): void
    {
        $vale = ValeContent::query()->first();
        if (! $vale || $vale->potw_note === null) {
            return;
        }

        $vale->update(['potw_note' => preg_replace('/ of the week at Matchday \d+\.$/', ' of the week.', $vale->potw_note)]);
    }

    public function down(): void
    {
        // Data only — nothing to undo.
    }
};
