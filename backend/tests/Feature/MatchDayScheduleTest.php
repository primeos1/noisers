<?php

namespace Tests\Feature;

use App\Models\ClubSetting;
use App\Models\MatchDayEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MatchDayScheduleTest extends TestCase
{
    use RefreshDatabase;

    /** Freezes the clock at a Lagos local time. */
    private function at(string $lagos): void
    {
        Carbon::setTestNow(Carbon::parse($lagos, 'Africa/Lagos'));
    }

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.auto_match_days' => true]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_opens_wednesdays_match_day_on_tuesday_evening(): void
    {
        ClubSetting::current()->update(['match_default_venue' => 'Zenith Astro']);
        $this->at('2026-10-06 21:00'); // Tuesday, a day before kickoff

        $this->getJson('/api/match-day-events')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $event = MatchDayEvent::sole();
        $this->assertSame('live', $event->status);
        $this->assertSame('Wed 7 Oct', $event->date);
        $this->assertSame('Zenith Astro', $event->venue);
        $this->assertSame('Matchday 1', $event->title);

        // Only once, including on the day itself.
        $this->at('2026-10-07 22:00');
        $this->getJson('/api/match-day-events')->assertJsonCount(1, 'data');
    }

    public function test_opens_sundays_match_day_but_not_before_the_window(): void
    {
        $this->at('2026-10-10 20:59'); // Saturday, just too early
        $this->getJson('/api/match-day-events')->assertJsonCount(0, 'data');

        $this->at('2026-10-09 21:00'); // Friday
        $this->getJson('/api/match-day-events')->assertJsonCount(0, 'data');

        $this->at('2026-10-11 09:00'); // Sunday morning, still in the window
        $this->getJson('/api/match-day-events')->assertJsonCount(1, 'data');
        $this->assertSame('Sun 11 Oct', MatchDayEvent::sole()->date);
    }

    public function test_leaves_alone_a_match_day_the_admin_already_made_or_deleted(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        MatchDayEvent::create([
            'id' => 'manual', 'title' => 'Matchday 1', 'venue' => 'Pitch 2', 'date' => 'Wed 7 Oct',
            'status' => 'live', 'present_players' => [], 'guests' => [], 'groups' => [], 'games' => [],
        ]);
        $this->at('2026-10-06 22:00');
        $this->getJson('/api/match-day-events')->assertJsonCount(1, 'data');

        $this->at('2026-10-10 22:00');
        $this->getJson('/api/match-day-events')->assertJsonCount(2, 'data');
        $auto = MatchDayEvent::where('date', 'Sun 11 Oct')->sole();
        $this->deleteJson("/api/match-day-events/{$auto->id}")->assertNoContent();

        $this->getJson('/api/match-day-events')->assertJsonCount(1, 'data');
    }
}
