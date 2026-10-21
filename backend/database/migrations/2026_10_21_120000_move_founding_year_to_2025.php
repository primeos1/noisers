<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * The new crest reads EST 2025: move the saved Home page copy and any
     * "Founded" number tile off 2021 so the site matches the badge.
     */
    public function up(): void
    {
        $this->swapYear('2021', '2025');
    }

    public function down(): void
    {
        $this->swapYear('2025', '2021');
    }

    private function swapYear(string $from, string $to): void
    {
        DB::table('home_content')->update([
            'hero_eyebrow' => DB::raw("REPLACE(hero_eyebrow, 'Est. {$from}', 'Est. {$to}')"),
            'story_paragraph_1' => DB::raw("REPLACE(story_paragraph_1, 'started in {$from}', 'started in {$to}')"),
            'footer_tagline' => DB::raw("REPLACE(footer_tagline, 'Est. {$from}', 'Est. {$to}')"),
        ]);

        DB::table('home_stats')
            ->where('value', $from)
            ->where('label', 'like', '%Founded%')
            ->update(['value' => $to, 'updated_at' => now()]);
    }
};
