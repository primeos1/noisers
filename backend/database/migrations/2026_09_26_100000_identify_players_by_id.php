<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Players used to be identified by their shirt number everywhere — match day
 * rosters/goals/cards and The Vale's awards stored numbers. Numbers can now
 * repeat, so everything switches to the player's database id and the number
 * becomes display-only. Also adds an optional second position.
 */
return new class extends Migration
{
    private const VALE_COLUMNS = [
        'potw_player_number' => 'potw_player_id',
        'improved_player_number' => 'improved_player_id',
        'leader_top_scorer_number' => 'leader_top_scorer_player_id',
        'leader_top_assist_number' => 'leader_top_assist_player_id',
        'leader_roughest_number' => 'leader_roughest_player_id',
    ];

    private const VALE_LIST_COLUMNS = [
        'team_lineup_numbers' => 'team_lineup_player_ids',
        'leader_clean_sheet_numbers' => 'leader_clean_sheet_player_ids',
    ];

    public function up(): void
    {
        // Rewrite stored data while numbers are still unique, so the mapping is exact.
        $idByNumber = DB::table('players')->pluck('id', 'number')->all();
        $this->rewriteMatchDays($idByNumber);
        $this->rewriteVale(self::VALE_COLUMNS, self::VALE_LIST_COLUMNS, $idByNumber);

        Schema::table('players', function (Blueprint $table) {
            $table->dropUnique(['number']);
            $table->enum('secondary_position', ['GK', 'DEF', 'MID', 'FWD'])->nullable()->after('position');
        });
    }

    public function down(): void
    {
        Schema::table('players', function (Blueprint $table) {
            $table->dropColumn('secondary_position');
        });

        // Only reversible while numbers are still unique; if two players now
        // share a number, the last one wins in this mapping.
        $numberById = DB::table('players')->pluck('number', 'id')->all();
        $this->rewriteMatchDays($numberById);
        $this->rewriteVale(array_flip(self::VALE_COLUMNS), array_flip(self::VALE_LIST_COLUMNS), $numberById);

        Schema::table('players', function (Blueprint $table) {
            $table->unique('number');
        });
    }

    /**
     * Squad participants are ints; guests are strings ("guest-1"). An int
     * with no matching player (someone since deleted) becomes the string
     * "#<n>" — it can't be left as an int, where it could collide with an
     * unrelated player's id, and "#<n>" is what the app already displays
     * for an unknown participant.
     *
     * @param  array<int, int>  $map
     */
    private function rewriteMatchDays(array $map): void
    {
        $convert = fn ($id) => is_int($id) ? ($map[$id] ?? "#{$id}") : $id;
        $convertList = fn ($ids) => array_values(array_map($convert, $ids ?? []));

        foreach (DB::table('match_day_events')->get() as $event) {
            $present = json_decode($event->present_players, true) ?? [];
            $groups = json_decode($event->groups, true) ?? [];
            $games = json_decode($event->games, true) ?? [];

            // Present players are squad-only, so drop anyone unmapped.
            $present = array_values(array_filter(array_map($convert, $present), 'is_int'));

            foreach ($groups as &$group) {
                $group['players'] = $convertList($group['players'] ?? []);
            }
            unset($group);

            foreach ($games as &$game) {
                foreach ($game['teams'] ?? [] as $i => $team) {
                    $game['teams'][$i]['players'] = $convertList($team['players'] ?? []);
                }
                foreach ($game['goals'] ?? [] as $i => $goal) {
                    $game['goals'][$i]['playerId'] = $convert($goal['playerId'] ?? null);
                    if (array_key_exists('assistPlayerId', $goal) && $goal['assistPlayerId'] !== null) {
                        $game['goals'][$i]['assistPlayerId'] = $convert($goal['assistPlayerId']);
                    }
                }
                foreach ($game['cards'] ?? [] as $i => $card) {
                    $game['cards'][$i]['playerId'] = $convert($card['playerId'] ?? null);
                }
            }
            unset($game);

            DB::table('match_day_events')->where('id', $event->id)->update([
                'present_players' => json_encode($present),
                'groups' => json_encode($groups),
                'games' => json_encode($games),
            ]);
        }
    }

    /**
     * @param  array<string, string>  $columns  old => new single-player columns
     * @param  array<string, string>  $listColumns  old => new player-list columns
     * @param  array<int, int>  $map
     */
    private function rewriteVale(array $columns, array $listColumns, array $map): void
    {
        $rows = DB::table('vale_content')->get();

        Schema::table('vale_content', function (Blueprint $table) use ($columns, $listColumns) {
            foreach ($columns as $old => $new) {
                $table->renameColumn($old, $new);
            }
            foreach ($listColumns as $old => $new) {
                $table->renameColumn($old, $new);
            }
        });

        foreach ($rows as $row) {
            $changes = [];
            foreach ($columns as $old => $new) {
                $changes[$new] = $row->{$old} === null ? null : ($map[(int) $row->{$old}] ?? null);
            }
            foreach ($listColumns as $old => $new) {
                $list = json_decode($row->{$old} ?? 'null', true);
                $changes[$new] = $list === null ? null : json_encode(array_values(array_filter(
                    array_map(fn ($n) => $map[(int) $n] ?? null, $list),
                    fn ($id) => $id !== null,
                )));
            }
            DB::table('vale_content')->where('id', $row->id)->update($changes);
        }
    }
};
