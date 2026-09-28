<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\PlayerRatingChange;
use App\Models\User;
use App\Models\ValeContent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MatchDayEditTest extends TestCase
{
    use RefreshDatabase;

    private Player $scorer;

    private Player $other;

    protected function setUp(): void
    {
        parent::setUp();

        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->scorer = Player::factory()->create(['position' => 'FWD', 'rating' => 6.0]);
        $this->other = Player::factory()->create(['position' => 'DEF', 'rating' => 6.0]);
    }

    /** @return array<string, mixed> */
    private function game(string $id, array $goals, array $cards = []): array
    {
        return [
            'id' => $id,
            'status' => 'finished',
            'teams' => [
                ['name' => 'Reds', 'players' => [$this->scorer->id]],
                ['name' => 'Blues', 'players' => [$this->other->id]],
            ],
            'goals' => $goals,
            'cards' => $cards,
        ];
    }

    private function endedMatchDay(array $games): void
    {
        $this->postJson('/api/match-day-events', [
            'id' => 'md',
            'title' => 'Session md',
            'date' => 'Sun 28 Sept',
            'status' => 'live',
            'present_players' => [],
            'guests' => [],
            'groups' => [],
            'games' => $games,
        ])->assertCreated();

        $this->putJson('/api/match-day-events/md', ['status' => 'ended'])->assertOk();
    }

    public function test_deleting_a_game_removes_its_cards_and_rolls_its_rating_moves_back(): void
    {
        $goal = ['id' => 'goal1', 'teamIndex' => 0, 'playerId' => $this->scorer->id];
        $this->endedMatchDay([
            $this->game('g1', [$goal]),
            $this->game('g2', [$goal], [['id' => 'c1', 'playerId' => $this->other->id, 'type' => 'yellow', 'reason' => 'Dissent']]),
        ]);
        $this->assertSame(1, Card::count());
        $twoGameRating = (float) $this->scorer->fresh()->rating;

        $this->putJson('/api/match-day-events/md', ['games' => [$this->game('g1', [$goal])]])->assertOk();

        $this->assertSame(0, Card::count());
        $this->assertSame(1, PlayerRatingChange::where('player_id', $this->scorer->id)->count());
        $this->assertLessThan($twoGameRating, (float) $this->scorer->fresh()->rating);
        $this->assertGreaterThan(6.0, (float) $this->scorer->fresh()->rating);
        $this->assertSame(1, ValeContent::current()->leader_top_scorer_value);
    }

    public function test_editing_cards_keeps_paid_status_and_adds_new_fines(): void
    {
        $this->endedMatchDay([
            $this->game('g1', [], [['id' => 'c1', 'playerId' => $this->other->id, 'type' => 'yellow', 'reason' => 'Dissent']]),
        ]);
        Card::first()->update(['paid' => true]);

        $this->putJson('/api/match-day-events/md', ['games' => [$this->game('g1', [], [
            ['id' => 'c1', 'playerId' => $this->other->id, 'type' => 'yellow', 'reason' => 'Dissent (corrected)'],
            ['id' => 'c2', 'playerId' => $this->scorer->id, 'type' => 'red', 'reason' => 'Violent conduct'],
        ])]])->assertOk();

        $this->assertSame(2, Card::count());
        $kept = Card::where('match_day_ref', 'md:g1:c1')->first();
        $this->assertTrue($kept->paid);
        $this->assertSame('Dissent (corrected)', $kept->reason);
        $this->assertSame('red', Card::where('match_day_ref', 'md:g1:c2')->first()->type);
        $this->assertSame($this->scorer->id, ValeContent::current()->leader_roughest_player_id);
    }

    public function test_removing_a_match_day_card_takes_it_off_the_game_for_good(): void
    {
        $this->endedMatchDay([
            $this->game('g1', [], [['id' => 'c1', 'playerId' => $this->other->id, 'type' => 'yellow', 'reason' => 'Dissent']]),
        ]);

        $this->deleteJson('/api/cards/'.Card::first()->id)->assertNoContent();

        $this->assertSame([], MatchDayEvent::find('md')->games[0]['cards']);
        $this->assertNull(ValeContent::current()->leader_roughest_player_id);

        // A later edit of the record doesn't bring the fine back.
        $this->putJson('/api/match-day-events/md', ['title' => 'Session md (renamed)'])->assertOk();
        $this->assertSame(0, Card::count());
        $this->assertSame('Session md (renamed)', ValeContent::current()->team_week_title);
    }

    public function test_deleting_every_game_clears_the_vale_it_fed(): void
    {
        $this->endedMatchDay([$this->game('g1', [['id' => 'goal1', 'teamIndex' => 0, 'playerId' => $this->scorer->id]])]);
        $this->assertSame('Session md', ValeContent::current()->team_week_title);

        $this->putJson('/api/match-day-events/md', ['games' => []])->assertOk();

        $this->assertSame([], MatchDayEvent::find('md')->games);
        $this->assertNull(ValeContent::current()->team_week_title);
        $this->assertEqualsWithDelta(6.0, (float) $this->scorer->fresh()->rating, 0.001);
    }
}
