<?php

namespace App\Console\Commands;

use App\Support\MatchDaySchedule;
use Illuminate\Console\Command;

class ScheduleMatchDay extends Command
{
    protected $signature = 'matchdays:open';

    protected $description = "Open today's match day if it's a Wednesday or Sunday and it isn't open yet";

    public function handle(): int
    {
        $event = MatchDaySchedule::ensure();
        $this->info($event ? "Opened {$event->title} ({$event->date})." : 'Nothing to open.');

        return self::SUCCESS;
    }
}
