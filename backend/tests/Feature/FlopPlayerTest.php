<?php

namespace Tests\Feature;

use App\Models\MatchDayEvent;
use App\Models\Player;
use App\Models\ValeContent;
use App\Support\MatchDayFinalizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FlopPlayerTest extends TestCase
{
    use RefreshDatabase;

    private function game(array $red, array $blue, array $goals = []): array
    {
        return [
            'id' => uniqid('g'),
            'status' => 'finished',
            'teams' => [['name' => 'Reds', 'players' => $red], ['name' => 'Blues', 'players' => $blue]],
            'goals' => $goals,
            'cards' => [],
        ];
    }

    public function test_there_is_a_flop_even_when_every_game_is_drawn(): void
    {
        // 1–1 then 0–0: nobody lost, so the fewest goal involvements decides.
        $event = new MatchDayEvent(['games' => [
            $this->game([1, 2], [3, 4], [
                ['id' => 'a', 'teamIndex' => 0, 'playerId' => 1, 'assistPlayerId' => 2, 'ownGoal' => false],
                ['id' => 'b', 'teamIndex' => 1, 'playerId' => 3, 'ownGoal' => false],
            ]),
            $this->game([1, 3], [2, 4]),
        ]]);

        $flop = MatchDayFinalizer::computeFlopPlayer($event, [1, 2, 3, 4]);

        $this->assertSame(4, $flop['playerId']);
        $this->assertSame(0, $flop['lost']);
        $this->assertSame(0, $flop['involvements']);
    }

    public function test_losses_still_come_first(): void
    {
        $event = new MatchDayEvent(['games' => [
            $this->game([1], [2], [['id' => 'a', 'teamIndex' => 0, 'playerId' => 1, 'ownGoal' => false]]),
        ]]);

        $this->assertSame(2, MatchDayFinalizer::computeFlopPlayer($event, [1, 2])['playerId']);
    }

    public function test_the_flop_is_worst_across_both_match_days_of_the_week(): void
    {
        $a = Player::factory()->create();
        $b = Player::factory()->create();
        $goal = fn ($team, $scorer) => ['id' => uniqid('x'), 'teamIndex' => $team, 'playerId' => $scorer, 'ownGoal' => false];
        $day = fn ($n, $games) => MatchDayEvent::create([
            'id' => "matchday-{$n}", 'title' => "Matchday {$n}", 'date' => "Sun {$n} Oct", 'status' => 'ended',
            'present_players' => [], 'guests' => [], 'groups' => [], 'games' => $games,
        ]);
        // $b loses both games of Matchday 1, $a the one of Matchday 2: on
        // Matchday 2 alone $a is the flop, but across the week it's $b.
        $day(1, [
            $this->game([$a->id], [$b->id], [$goal(0, $a->id)]),
            $this->game([$a->id], [$b->id], [$goal(0, $a->id)]),
        ]);
        $second = $day(2, [$this->game([$a->id], [$b->id], [$goal(1, $b->id)])]);

        $flop = MatchDayFinalizer::computeFlopPlayer($second, [$a->id, $b->id]);

        $this->assertSame($b->id, $flop['playerId']);
        $this->assertSame(3, $flop['played']);
        $this->assertSame(2, $flop['lost']);
        $this->assertStringEndsWith('across Matchday 1 and Matchday 2.', MatchDayFinalizer::flopFields($second, [$a->id, $b->id])['flop_note']);
    }

    public function test_refresh_reworks_the_saved_flop_across_the_week(): void
    {
        $a = Player::factory()->create();
        $b = Player::factory()->create();
        $goal = fn ($team, $scorer) => ['id' => uniqid('x'), 'teamIndex' => $team, 'playerId' => $scorer, 'ownGoal' => false];
        $day = fn ($n, $games) => MatchDayEvent::create([
            'id' => "matchday-{$n}", 'title' => "Matchday {$n}", 'date' => "Sun {$n} Oct", 'status' => 'ended',
            'present_players' => [], 'guests' => [], 'groups' => [], 'games' => $games,
        ]);
        $day(1, [
            $this->game([$a->id], [$b->id], [$goal(0, $a->id)]),
            $this->game([$a->id], [$b->id], [$goal(0, $a->id)]),
        ]);
        $day(2, [$this->game([$a->id], [$b->id], [$goal(1, $b->id)])]);
        // What the old rule saved: Matchday 2's flop alone.
        ValeContent::current()->update([
            'team_week_title' => 'Matchday 2', 'team_week_date_range' => 'Sun 2 Oct',
            'flop_player_id' => $a->id, 'flop_note' => 'Lost 1 of 1 game at Matchday 2.',
        ]);

        (require database_path('migrations/2026_10_08_120000_refresh_vale_flop_player_of_the_week.php'))->up();

        $vale = ValeContent::current();
        $this->assertSame($b->id, $vale->flop_player_id);
        $this->assertStringEndsWith('across Matchday 1 and Matchday 2.', $vale->flop_note);
    }

    public function test_backfill_fills_an_empty_flop_from_the_match_day_the_vale_shows(): void
    {
        $a = Player::factory()->create();
        $b = Player::factory()->create();
        MatchDayEvent::create([
            'id' => 'matchday-3', 'title' => 'Matchday 3', 'date' => 'Sun 5 Oct', 'status' => 'ended',
            'present_players' => [], 'guests' => [], 'groups' => [],
            'games' => [$this->game([$a->id], [$b->id], [
                ['id' => 'x', 'teamIndex' => 0, 'playerId' => $a->id, 'ownGoal' => false],
                ['id' => 'y', 'teamIndex' => 1, 'playerId' => $b->id, 'ownGoal' => false],
                ['id' => 'z', 'teamIndex' => 0, 'playerId' => $a->id, 'assistPlayerId' => $a->id, 'ownGoal' => false],
            ]), $this->game([$a->id], [$b->id])],
        ]);
        ValeContent::current()->update([
            'team_week_title' => 'Matchday 3', 'team_week_date_range' => 'Sun 5 Oct',
            'flop_player_id' => null, 'flop_note' => null,
        ]);

        (require database_path('migrations/2026_10_06_120000_backfill_flop_player_of_the_week.php'))->up();

        $vale = ValeContent::current();
        $this->assertSame($b->id, $vale->flop_player_id);
        $this->assertStringEndsWith('at Matchday 3.', $vale->flop_note);
    }

    public function test_backfill_leaves_a_chosen_flop_alone(): void
    {
        $a = Player::factory()->create();
        ValeContent::current()->update(['team_week_title' => 'Matchday 1', 'flop_player_id' => $a->id, 'flop_note' => 'Picked']);

        (require database_path('migrations/2026_10_06_120000_backfill_flop_player_of_the_week.php'))->up();

        $this->assertSame('Picked', ValeContent::current()->flop_note);
    }

    public function test_no_flop_when_no_squad_player_finished_a_game(): void
    {
        $event = new MatchDayEvent(['games' => [$this->game(['guest-1'], ['guest-2'])]]);

        $this->assertNull(MatchDayFinalizer::computeFlopPlayer($event, [1, 2]));
    }
}
