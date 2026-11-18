<?php

namespace App\Console\Commands;

use App\Support\InstagramSync;
use Illuminate\Console\Command;

class SyncInstagram extends Command
{
    protected $signature = 'instagram:sync';

    protected $description = "Import new videos from the club's Instagram into highlights";

    public function handle(): int
    {
        $added = InstagramSync::sync();
        $this->info("Added {$added} Instagram video(s).");

        return self::SUCCESS;
    }
}
