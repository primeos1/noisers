<?php

namespace Tests\Feature;

use App\Models\MatchDayEvent;
use App\Models\Player;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The migration rewrites saved match days and The Vale from shirt numbers to
 * player ids. Runs it backwards (ids → numbers, as the data looked before)
 * and forwards again, checking each step lands on the right players.
 */
class IdentifyPlayersByIdMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_numbers_in_saved_data_become_player_ids(): void
    {
        // Numbers deliberately differ from ids so a mix-up can't pass.
        $scorer = Player::create(['number' => 9, 'name' => 'Scorer', 'position' => 'FWD']);
        $keeper = Player::create(['number' => 1, 'name' => 'Keeper', 'position' => 'GK']);

        MatchDayEvent::create([
            'id' => 'old-day',
            'title' => 'Old Day',
            'date' => 'Sun 1 Sep',
            'status' => 'ended',
            'present_players' => [$scorer->id, $keeper->id],
            'guests' => [['id' => 'guest-1', 'name' => 'Guest']],
            'groups' => [['name' => 'Team A', 'players' => [$scorer->id, 'guest-1']]],
            'games' => [[
                'id' => 'g1',
                'status' => 'finished',
                'teams' => [
                    ['name' => 'Team A', 'players' => [$scorer->id, 'guest-1']],
                    ['name' => 'Team B', 'players' => [$keeper->id]],
                ],
                'goals' => [['id' => 'go1', 'teamIndex' => 0, 'playerId' => $scorer->id, 'assistPlayerId' => 'guest-1', 'ownGoal' => false]],
                'cards' => [['id' => 'c1', 'teamIndex' => 1, 'playerId' => $keeper->id, 'type' => 'yellow']],
            ]],
        ]);
        DB::table('vale_content')->insert([
            'id' => 1,
            'potw_player_id' => $scorer->id,
            'team_lineup_player_ids' => json_encode([$scorer->id]),
            'leader_clean_sheet_player_ids' => json_encode([$keeper->id]),
        ]);

        // Start from how things were before numbers became unique again.
        (require database_path('migrations/2026_09_26_120000_make_shirt_numbers_unique_again.php'))->down();
        $migration = require database_path('migrations/2026_09_26_100000_identify_players_by_id.php');

        // Backwards: the data as it was stored before the switch.
        $migration->down();
        $old = MatchDayEvent::find('old-day');
        $this->assertSame([9, 1], $old->present_players);
        $this->assertSame([9, 'guest-1'], $old->games[0]['teams'][0]['players']);
        $this->assertSame(9, $old->games[0]['goals'][0]['playerId']);
        $this->assertSame(1, $old->games[0]['cards'][0]['playerId']);
        $this->assertEquals(9, DB::table('vale_content')->value('potw_player_number'));

        // A match day that mentions a since-deleted player (#30).
        $games = $old->games;
        $games[0]['teams'][1]['players'][] = 30;
        $old->update(['games' => $games]);

        // Forwards: numbers become ids again.
        $migration->up();
        $new = MatchDayEvent::find('old-day');
        $this->assertSame([$scorer->id, $keeper->id], $new->present_players);
        $this->assertSame([$scorer->id, 'guest-1'], $new->groups[0]['players']);
        $this->assertSame([$keeper->id, '#30'], $new->games[0]['teams'][1]['players']);
        $this->assertSame($scorer->id, $new->games[0]['goals'][0]['playerId']);
        $this->assertSame('guest-1', $new->games[0]['goals'][0]['assistPlayerId']);
        $this->assertSame($keeper->id, $new->games[0]['cards'][0]['playerId']);

        $vale = DB::table('vale_content')->first();
        $this->assertEquals($scorer->id, $vale->potw_player_id);
        $this->assertSame([$scorer->id], json_decode($vale->team_lineup_player_ids));
        $this->assertSame([$keeper->id], json_decode($vale->leader_clean_sheet_player_ids));
    }
}
