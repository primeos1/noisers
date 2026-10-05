<?php

namespace App\Support;

use App\Models\ClubSetting;
use App\Models\MatchDayEvent;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * The club plays every Wednesday and Sunday at 9pm Lagos time. Each match
 * day is opened automatically a day before kickoff (Tuesday and Saturday
 * 9pm), so the admin only has to press "Resume" on the Match Day screen.
 *
 * Runs on read (MatchDayEventController::index) so it needs no cron, and from
 * the scheduler (routes/console.php) where one is running. Each match day is
 * opened at most once: if the admin already made one for that date, or
 * deleted the automatic one, it's left alone.
 */
class MatchDaySchedule
{
    public const TIMEZONE = 'Africa/Lagos';

    /** @var int[] Carbon day-of-week numbers */
    public const DAYS = [CarbonInterface::WEDNESDAY, CarbonInterface::SUNDAY];

    public const KICKOFF_HOUR = 21;

    /** How many hours before kickoff the match day appears. */
    public const OPENS_HOURS_BEFORE = 24;

    /** Used when the club settings leave the default venue empty. */
    public const DEFAULT_VENUE = 'Greenfield';

    public static function ensure(?CarbonInterface $now = null): ?MatchDayEvent
    {
        if (! config('app.auto_match_days')) {
            return null;
        }

        $now = CarbonImmutable::instance($now ?? now())->setTimezone(self::TIMEZONE);
        $matchDate = self::openMatchDate($now);
        if (! $matchDate) {
            return null;
        }

        $day = $matchDate->toDateString();
        // Cheap check first — this runs on every match day list read.
        if (ClubSetting::current()->last_scheduled_match_day === $day) {
            return null;
        }

        return DB::transaction(function () use ($matchDate, $day) {
            $settings = ClubSetting::query()->lockForUpdate()->find(ClubSetting::current()->id);
            if ($settings->last_scheduled_match_day === $day) {
                return null;
            }
            $settings->update(['last_scheduled_match_day' => $day]);

            $label = self::dateLabel($matchDate);
            if (self::existsFor($label)) {
                return null;
            }

            $event = MatchDayEvent::create([
                'id' => self::uniqueId(),
                'title' => 'Matchday',
                'venue' => $settings->match_default_venue ?: self::DEFAULT_VENUE,
                'date' => $label,
                'status' => 'live',
                'present_players' => [],
                'guests' => [],
                'groups' => [],
                'games' => [],
            ]);
            MatchDayFinalizer::renumber();

            return $event->refresh();
        });
    }

    /**
     * The match date whose window is open now — from OPENS_HOURS_BEFORE
     * before kickoff until the end of that day — or null between windows.
     */
    private static function openMatchDate(CarbonImmutable $now): ?CarbonImmutable
    {
        foreach ([$now->startOfDay(), $now->startOfDay()->addDay()] as $date) {
            $opens = $date->setTime(self::KICKOFF_HOUR, 0)->subHours(self::OPENS_HOURS_BEFORE);
            if (in_array($date->dayOfWeek, self::DAYS, true) && $now->gte($opens) && $now->lt($date->addDay())) {
                return $date;
            }
        }

        return null;
    }

    /** The label the apps write for a date, e.g. "Wed 1 Oct" (en-GB says "Sept"). */
    public static function dateLabel(CarbonInterface $date): string
    {
        $month = $date->month === 9 ? 'Sept' : $date->format('M');

        return $date->format('D j ').$month;
    }

    /** Whether a match day already exists for this date, however its label was written. */
    private static function existsFor(string $label): bool
    {
        $prefix = strtolower(substr($label, 0, strrpos($label, ' ') + 4));

        return MatchDayEvent::query()->pluck('date')
            ->contains(fn ($date) => str_starts_with(strtolower(trim($date)), $prefix));
    }

    private static function uniqueId(): string
    {
        $n = MatchDayEvent::count() + 1;
        while (MatchDayEvent::whereKey("matchday-{$n}")->exists()) {
            $n++;
        }

        return "matchday-{$n}";
    }
}
