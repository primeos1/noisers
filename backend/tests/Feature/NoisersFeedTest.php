<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\Player;
use App\Models\PlayerAbsence;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NoisersFeedTest extends TestCase
{
    use RefreshDatabase;

    private Player $striker;

    private Player $keeper;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-09-30 12:00');
        $this->striker = Player::factory()->create(['name' => 'Tunde Bakare', 'position' => 'FWD']);
        $this->keeper = Player::factory()->create(['name' => 'Ada Obi', 'position' => 'GK']);
    }

    private function endedMatchDay(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $goal = fn ($id) => ['id' => $id, 'teamIndex' => 0, 'playerId' => $this->striker->id, 'minute' => 3];
        $game = fn ($id, $goals, $cards = []) => [
            'id' => $id,
            'status' => 'finished',
            'teams' => [
                ['name' => 'Reds', 'players' => [$this->striker->id]],
                ['name' => 'Blues', 'players' => [$this->keeper->id, 'guest-1']],
            ],
            'goals' => $goals,
            'cards' => $cards,
        ];

        $this->postJson('/api/match-day-events', [
            'id' => 'md',
            'title' => 'Session 7',
            'venue' => 'The Vale',
            'date' => 'Sun 28 Sept',
            'status' => 'live',
            'present_players' => [],
            'guests' => [['id' => 'guest-1', 'name' => 'Kola']],
            'groups' => [],
            'games' => [
                $game('g1', [$goal('a'), $goal('b')]),
                $game('g2', [$goal('c')], [
                    ['id' => 'c1', 'playerId' => 'guest-1', 'type' => 'red', 'reason' => 'Violent conduct', 'minute' => 7],
                ]),
            ],
        ])->assertCreated();
        $this->putJson('/api/match-day-events/md', ['status' => 'ended'])->assertOk();
    }

    public function test_a_finished_match_day_writes_a_report_team_of_the_match_day_and_discipline(): void
    {
        $this->endedMatchDay();

        $stories = collect($this->getJson('/api/noisers')->assertOk()->json('data'))->keyBy('id');

        $report = $stories['report-md'];
        $this->assertSame('match_report', $report['kind']);
        $this->assertStringContainsString('Tunde Bakare', $report['headline']); // a hat-trick leads
        $this->assertSame($this->striker->id, $report['playerIds'][0]);
        $this->assertSame([
            ['home' => 'Reds', 'away' => 'Blues', 'homeScore' => 2, 'awayScore' => 0],
            ['home' => 'Reds', 'away' => 'Blues', 'homeScore' => 1, 'awayScore' => 0],
        ], $report['scoreline']);

        // The day's best player in each position, keeper first — from both sides.
        $totw = $stories['totw-md'];
        $this->assertSame('Team of the match day', $totw['tag']);
        $this->assertSame([$this->keeper->id, $this->striker->id], $totw['lineup']['playerIds']);
        $this->assertSame(['GK', 'FWD'], $totw['lineup']['positions']);

        $book = $stories['book-md'];
        $this->assertSame('discipline', $book['kind']);
        $this->assertStringContainsString('Kola', $book['headline']); // guests are named from the event
        $this->assertNull($book['cards'][0]['playerId']);
        $this->assertSame('red', $book['cards'][0]['type']);
    }

    public function test_the_wording_is_stable_between_loads(): void
    {
        $this->endedMatchDay();

        $this->assertSame($this->getJson('/api/noisers')->json('data'), $this->getJson('/api/noisers')->json('data'));
    }

    public function test_absences_get_a_story_and_a_welcome_back_once_over(): void
    {
        PlayerAbsence::create([
            'player_id' => $this->keeper->id, 'type' => 'injury', 'reason' => 'Broken finger',
            'starts_on' => '2026-09-01', 'ends_on' => '2026-09-20',
        ]);
        PlayerAbsence::create([
            'player_id' => $this->striker->id, 'type' => 'travel', 'starts_on' => '2026-10-02',
        ]);

        $stories = collect($this->getJson('/api/noisers')->json('data'))->keyBy('kind');

        $this->assertSame('Treatment room', $stories['injury']['tag']);
        $this->assertSame('ended', $stories['injury']['absence']['status']);
        $this->assertStringContainsString('Ada Obi', $stories['comeback']['body'][0]);
        $this->assertStringContainsString('3 weeks', $stories['comeback']['body'][0]);
        $this->assertSame('upcoming', $stories['travel']['absence']['status']);
        $this->assertStringContainsString('No return date yet', implode(' ', $stories['travel']['body']));
    }

    public function test_hand_logged_cards_get_their_own_story(): void
    {
        Card::create(['player_id' => $this->keeper->id, 'type' => 'yellow', 'reason' => 'Late to training', 'fine_amount' => 500, 'occurred_on' => '2026-09-29']);

        $story = $this->getJson('/api/noisers')->json('data.0');

        $this->assertSame('discipline', $story['kind']);
        $this->assertStringContainsString('Ada Obi', $story['headline']);
        $this->assertStringContainsString('₦500', implode(' ', $story['body']));
    }

    public function test_the_feed_is_empty_without_anything_to_write_about(): void
    {
        $this->getJson('/api/noisers')->assertOk()->assertExactJson(['data' => []]);
    }
}
