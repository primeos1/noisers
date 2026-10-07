<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\PlayerRatingChange;
use App\Models\User;
use App\Models\ValeContent;
use App\Support\PlayerStats;
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
        $this->assertSame([
            ['playerId' => $this->scorer->id, 'yellowCards' => 0, 'redCards' => 1],
            ['playerId' => $this->other->id, 'yellowCards' => 1, 'redCards' => 0],
        ], ValeContent::current()->leader_bad_boys);
    }

    public function test_removing_a_match_day_card_takes_it_off_the_game_for_good(): void
    {
        $this->endedMatchDay([
            $this->game('g1', [], [['id' => 'c1', 'playerId' => $this->other->id, 'type' => 'yellow', 'reason' => 'Dissent']]),
        ]);

        $this->deleteJson('/api/cards/'.Card::first()->id)->assertNoContent();

        $this->assertSame([], MatchDayEvent::find('md')->games[0]['cards']);
        $this->assertSame([], ValeContent::current()->leader_bad_boys);

        // A later edit of the record doesn't bring the fine back.
        $this->putJson('/api/match-day-events/md', ['date' => 'Sun 5 Oct'])->assertOk();
        $this->assertSame(0, Card::count());
        $this->assertSame('Sun 5 Oct', ValeContent::current()->team_week_date_range);
    }

    public function test_clean_sheet_leader_is_the_team_with_the_most_clean_sheets(): void
    {
        $red = fn ($id) => ['id' => $id, 'teamIndex' => 0, 'playerId' => $this->scorer->id];
        $blue = fn ($id) => ['id' => $id, 'teamIndex' => 1, 'playerId' => $this->other->id];
        // Blues are team of the week on goal difference; Reds kept two clean sheets to their one.
        $this->endedMatchDay([
            $this->game('g1', [$blue('a'), $blue('b'), $blue('c'), $red('d')]),
            $this->game('g2', []),
            $this->game('g3', [$red('e')]),
        ]);

        $vale = ValeContent::current();
        $this->assertSame('Reds', $vale->leader_clean_sheet_team);
        $this->assertSame(2, $vale->leader_clean_sheet_value);
        // The Reds' only player is a forward, and forwards don't keep clean sheets.
        $this->assertSame([], $vale->leader_clean_sheet_player_ids);
        $this->assertSame(0, PlayerStats::computeAll(MatchDayEvent::all(), PlayerStats::noCleanSheetIds())[$this->scorer->id]['cleanSheets']);
        $this->assertSame(1, PlayerStats::computeAll(MatchDayEvent::all(), PlayerStats::noCleanSheetIds())[$this->other->id]['cleanSheets']);
    }

    public function test_the_vale_names_the_keeper_with_the_most_saves(): void
    {
        $keeper = Player::factory()->create(['position' => 'DEF', 'secondary_position' => 'GK', 'rating' => 6.0]);
        $game = $this->game('g1', []);
        $game['teams'][1]['players'][] = $keeper->id;
        $game['saves'] = [
            ['id' => 's1', 'teamIndex' => 1, 'playerId' => $keeper->id, 'minute' => 2],
            ['id' => 's2', 'teamIndex' => 1, 'playerId' => $keeper->id, 'minute' => 7],
        ];
        $this->endedMatchDay([$game]);

        $vale = ValeContent::current();
        $this->assertSame($keeper->id, $vale->leader_top_saves_player_id);
        $this->assertSame(2, $vale->leader_top_saves_value);
        $this->getJson('/api/players/'.$keeper->id)->assertJsonPath('data.saves', 2);
        $this->getJson('/api/vale-content')->assertJsonPath('data.weeklyLeaders.topSaves.value', 2);
    }

    public function test_clean_sheet_tie_goes_to_the_days_best_side(): void
    {
        $this->endedMatchDay([
            $this->game('g1', [['id' => 'a', 'teamIndex' => 1, 'playerId' => $this->other->id], ['id' => 'b', 'teamIndex' => 1, 'playerId' => $this->other->id]]),
            $this->game('g2', [['id' => 'c', 'teamIndex' => 0, 'playerId' => $this->scorer->id]]),
        ]);

        $vale = ValeContent::current();
        // The team of the week is a picked six: the defender, then the forward.
        $this->assertSame([$this->other->id, $this->scorer->id], $vale->team_lineup_player_ids);
        $this->assertSame('Blues', $vale->leader_clean_sheet_team);
        $this->assertSame(1, $vale->leader_clean_sheet_value);
    }

    public function test_deleting_every_game_clears_the_vale_it_fed(): void
    {
        $this->endedMatchDay([$this->game('g1', [['id' => 'goal1', 'teamIndex' => 0, 'playerId' => $this->scorer->id]])]);
        $this->assertSame('Matchday 1', ValeContent::current()->team_week_title);

        $this->putJson('/api/match-day-events/md', ['games' => []])->assertOk();

        $this->assertSame([], MatchDayEvent::find('md')->games);
        $this->assertNull(ValeContent::current()->team_week_title);
        $this->assertEqualsWithDelta(6.0, (float) $this->scorer->fresh()->rating, 0.001);
    }
}
