<?php

namespace App\Console\Commands;

use App\Support\YouTubeSync;
use Illuminate\Console\Command;

class SyncYouTube extends Command
{
    protected $signature = 'youtube:sync';

    protected $description = "Import new videos from the club's YouTube channel into highlights";

    public function handle(): int
    {
        $added = YouTubeSync::sync();
        $this->info("Added {$added} YouTube video(s).");

        return self::SUCCESS;
    }
}
