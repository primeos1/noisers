<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Opens the Wednesday/Sunday match day (see MatchDaySchedule) wherever a
// scheduler runs; the match day list also does it on read without one.
Schedule::command('matchdays:open')->everyFifteenMinutes();
