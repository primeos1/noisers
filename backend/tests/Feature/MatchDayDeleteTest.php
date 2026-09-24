<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\Player;
use App\Models\PlayerRatingChange;
use App\Models\User;
use App\Models\ValeContent;
use App\Support\PlayerStats;
use App\Models\MatchDayEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MatchDayDeleteTest extends TestCase
{
    use RefreshDatabase;

    private function playMatchDay(string $id, Player $scorer, Player $other): void
    {
        $this->postJson('/api/match-day-events', [
            'id' => $id,
            'title' => "Session {$id}",
            'venue' => 'Pitch 2',
            'date' => 'Sun 28 Sept',
            'status' => 'live',
            'present_players' => [],
            'guests' => [],
            'groups' => [],
            'games' => [],
        ])->assertCreated();

        $this->putJson("/api/match-day-events/{$id}", [
            'games' => [[
                'id' => 'g1',
                'status' => 'finished',
                'teams' => [
                    ['name' => 'Reds', 'players' => [$scorer->number]],
                    ['name' => 'Blues', 'players' => [$other->number]],
                ],
                'goals' => [['id' => 'goal1', 'teamIndex' => 0, 'playerId' => $scorer->number]],
                'cards' => [['id' => 'c1', 'playerId' => $other->number, 'type' => 'yellow', 'reason' => 'Dissent']],
            ]],
        ])->assertOk();

        $this->putJson("/api/match-day-events/{$id}", ['status' => 'ended'])->assertOk();
    }

    public function test_deleting_a_match_day_removes_its_cards_ratings_stats_and_awards(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $scorer = Player::factory()->create(['position' => 'FWD', 'rating' => 6.0]);
        $other = Player::factory()->create(['position' => 'DEF', 'rating' => 6.0]);

        $this->playMatchDay('first', $scorer, $other);
        $ratingAfterFirst = (float) $scorer->fresh()->rating;

        $this->playMatchDay('second', $scorer, $other);
        $this->assertSame(2, Card::count());
        $this->assertGreaterThan($ratingAfterFirst, (float) $scorer->fresh()->rating);
        $this->assertSame('Session second', ValeContent::current()->team_week_title);

        $this->deleteJson('/api/match-day-events/second')->assertNoContent();

        $this->assertNull(MatchDayEvent::find('second'));
        $this->assertSame(1, Card::count());
        $this->assertSame(0, PlayerRatingChange::where('match_day_event_id', 'second')->count());
        $this->assertEqualsWithDelta($ratingAfterFirst, (float) $scorer->fresh()->rating, 0.001);
        $this->assertSame(1, PlayerStats::computeAll(MatchDayEvent::all())[$scorer->number]['goals']);
        $this->assertSame('Session first', ValeContent::current()->team_week_title);

        $this->deleteJson('/api/match-day-events/first')->assertNoContent();

        $this->assertSame(0, Card::count());
        $this->assertEqualsWithDelta(6.0, (float) $scorer->fresh()->rating, 0.001);
        $this->assertEqualsWithDelta(6.0, (float) $other->fresh()->rating, 0.001);
        $this->assertNull(ValeContent::current()->team_week_title);
        $this->assertNull(ValeContent::current()->potw_player_number);
    }
}
