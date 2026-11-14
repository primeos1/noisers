<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FnlEntry;
use App\Models\FnlLeague;
use App\Models\FnlTeam;
use App\Models\Player;
use App\Support\Fnl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * FNL, the Fantasy Noisers League (league.noisersfc.com/fantasy): FPL-style
 * squads of nine, one entry per gameweek, and private leagues joined by a
 * code. Managers sign in like the predictor: squad passcode + their PIN.
 */
class FnlController extends Controller
{
    /** Rules, prices, every team, and every squad whose gameweek has locked. */
    public function show()
    {
        $open = Fnl::openGameweek();
        $locked = array_values(array_filter(range(1, LeagueController::NIGHTS), fn ($gw) => $open === null || $gw < $open));

        return response()->json(['data' => [
            'rules' => [
                'budget' => Fnl::BUDGET,
                'squad' => Fnl::SQUAD,
                'starters' => Fnl::STARTERS,
                'maxPerClub' => Fnl::MAX_PER_CLUB,
                'transferCost' => Fnl::TRANSFER_COST,
                'chips' => Fnl::CHIPS,
            ],
            'openGameweek' => $open,
            'deadlines' => array_map(fn ($gw) => Fnl::deadline($gw)->toIso8601String(), range(1, LeagueController::NIGHTS)),
            'players' => collect(LeagueController::leaguePlayers())
                ->map(fn ($p, $id) => ['id' => $id, 'position' => $p['position'], 'price' => Fnl::price($p['rating'])])
                ->values(),
            'teams' => FnlTeam::orderBy('id')->get()->map(fn (FnlTeam $t) => $this->team($t))->values(),
            'entries' => FnlEntry::whereIn('gameweek', $locked)->get()->map(fn (FnlEntry $e) => $this->entry($e))->values(),
            'leagues' => FnlLeague::with('teams:id')->orderBy('id')->get()->map(fn (FnlLeague $l) => $this->league($l))->values(),
        ]]);
    }

    /** Signs in (setting a PIN the first time) and returns the manager's own team, squads and leagues. */
    public function me(Request $request)
    {
        $player = (new LeagueGameController)->signIn($request, allowSetup: true);

        return response()->json(['data' => $this->mine($player)]);
    }

    public function saveTeam(Request $request)
    {
        $player = (new LeagueGameController)->signIn($request);
        $data = $request->validate(['name' => ['required', 'string', 'min:2', 'max:40']]);
        FnlTeam::updateOrCreate(['player_id' => $player->id], ['name' => trim($data['name'])]);

        return response()->json(['data' => $this->mine($player)]);
    }

    public function saveEntry(Request $request)
    {
        $player = (new LeagueGameController)->signIn($request);
        $team = $this->teamOf($player);
        $data = $request->validate([
            'gameweek' => ['required', 'integer', 'min:1', 'max:'.LeagueController::NIGHTS],
            'starters' => ['required', 'array', 'size:'.Fnl::STARTERS],
            'starters.*' => ['integer'],
            'bench' => ['required', 'array', 'size:'.(array_sum(Fnl::SQUAD) - Fnl::STARTERS)],
            'bench.*' => ['integer'],
            'captain_id' => ['required', 'integer'],
            'vice_id' => ['required', 'integer', 'different:captain_id'],
            'chip' => ['nullable', 'in:'.implode(',', Fnl::CHIPS)],
        ]);
        $gw = (int) $data['gameweek'];
        $fail = fn (string $field, string $message) => throw ValidationException::withMessages([$field => $message]);

        if ($gw !== Fnl::openGameweek()) {
            $fail('gameweek', "Gameweek {$gw} isn't open for changes.");
        }

        $starters = array_map('intval', $data['starters']);
        $bench = array_map('intval', $data['bench']);
        $squad = [...$starters, ...$bench];
        if (count(array_unique($squad)) !== count($squad)) {
            $fail('starters', 'A player can only be in your squad once.');
        }

        $pool = LeagueController::leaguePlayers();
        $count = array_fill_keys(array_keys(Fnl::SQUAD), 0);
        $cost = 0.0;
        foreach ($squad as $id) {
            if (! isset($pool[$id])) {
                $fail('starters', 'Pick players who are in the league.');
            }
            $count[$pool[$id]['position']]++;
            $cost += Fnl::price($pool[$id]['rating']);
        }
        if ($count !== Fnl::SQUAD) {
            $fail('starters', 'Your squad needs 1 keeper, 3 defenders, 2 midfielders and 3 forwards.');
        }
        if ($cost > Fnl::BUDGET + 0.001) {
            $fail('starters', 'That squad costs '.number_format($cost, 1).'m, over the '.number_format(Fnl::BUDGET, 1).'m budget.');
        }
        $starting = array_count_values(array_map(fn ($id) => $pool[$id]['position'], $starters));
        if (($starting['GK'] ?? 0) !== 1 || ($starting['DEF'] ?? 0) < 1 || ($starting['MID'] ?? 0) < 1 || ($starting['FWD'] ?? 0) < 1) {
            $fail('starters', 'Start your keeper and at least one defender, one midfielder and one forward.');
        }
        if (! in_array((int) $data['captain_id'], $starters, true) || ! in_array((int) $data['vice_id'], $starters, true)) {
            $fail('captain_id', 'Your captain and vice-captain have to be in your starting six.');
        }

        $chip = $data['chip'] ?? null;
        if ($chip && $team->entries()->where('chip', $chip)->where('gameweek', '!=', $gw)->exists()) {
            $fail('chip', 'You have already played that chip.');
        }

        $previous = $team->entries()->where('gameweek', '<', $gw)->orderByDesc('gameweek')->first();
        $transfers = $previous ? count(array_diff($squad, [...$previous->starters, ...$previous->bench])) : 0;
        $free = Fnl::freeTransfers($team, $gw);
        $hits = $free === null || $chip === 'wildcard' ? 0 : max(0, $transfers - $free);

        FnlEntry::updateOrCreate(['fnl_team_id' => $team->id, 'gameweek' => $gw], [
            'starters' => $starters,
            'bench' => $bench,
            'captain_id' => (int) $data['captain_id'],
            'vice_id' => (int) $data['vice_id'],
            'chip' => $chip,
            'transfers' => $transfers,
            'transfer_cost' => $hits * Fnl::TRANSFER_COST,
        ]);

        return response()->json(['data' => $this->mine($player)]);
    }

    public function createLeague(Request $request)
    {
        $player = (new LeagueGameController)->signIn($request);
        $team = $this->teamOf($player);
        $data = $request->validate(['name' => ['required', 'string', 'min:2', 'max:40']]);

        DB::transaction(function () use ($team, $data) {
            do {
                $code = Str::upper(Str::random(6));
            } while (FnlLeague::where('code', $code)->exists());
            $league = FnlLeague::create(['name' => trim($data['name']), 'code' => $code, 'owner_team_id' => $team->id]);
            $league->teams()->attach($team->id);
        });

        return response()->json(['data' => $this->mine($player)], 201);
    }

    public function joinLeague(Request $request)
    {
        $player = (new LeagueGameController)->signIn($request);
        $team = $this->teamOf($player);
        $data = $request->validate(['code' => ['required', 'string', 'max:8']]);
        $league = FnlLeague::where('code', Str::upper(trim($data['code'])))->first();
        if (! $league) {
            throw ValidationException::withMessages(['code' => 'No league has that code. Check it with whoever made the league.']);
        }
        $league->teams()->syncWithoutDetaching([$team->id]);

        return response()->json(['data' => $this->mine($player)]);
    }

    public function leaveLeague(Request $request, FnlLeague $fnlLeague)
    {
        $player = (new LeagueGameController)->signIn($request);
        $fnlLeague->teams()->detach($this->teamOf($player)->id);

        return response()->json(['data' => $this->mine($player)]);
    }

    private function teamOf(Player $player): FnlTeam
    {
        return FnlTeam::where('player_id', $player->id)->first()
            ?? throw ValidationException::withMessages(['name' => 'Name your team first.']);
    }

    /** @return array<string, mixed> */
    private function mine(Player $player): array
    {
        $team = FnlTeam::where('player_id', $player->id)->first();
        $open = Fnl::openGameweek();

        return [
            'playerId' => $player->id,
            'team' => $team ? $this->team($team) : null,
            'entries' => $team ? $team->entries()->orderBy('gameweek')->get()->map(fn (FnlEntry $e) => $this->entry($e))->values() : [],
            // Free transfers for the open gameweek; null means unlimited (the first squad).
            'freeTransfers' => $team && $open ? Fnl::freeTransfers($team, $open) : null,
            'leagues' => $team
                ? $team->leagues()->with('teams:id')->get()->map(fn (FnlLeague $l) => $this->league($l) + ['code' => $l->code])->values()
                : [],
        ];
    }

    private function team(FnlTeam $t): array
    {
        return ['id' => $t->id, 'playerId' => $t->player_id, 'name' => $t->name];
    }

    private function entry(FnlEntry $e): array
    {
        return [
            'teamId' => $e->fnl_team_id,
            'gameweek' => $e->gameweek,
            'starters' => $e->starters,
            'bench' => $e->bench,
            'captainId' => $e->captain_id,
            'viceId' => $e->vice_id,
            'chip' => $e->chip,
            'transfers' => $e->transfers,
            'transferCost' => $e->transfer_cost,
        ];
    }

    private function league(FnlLeague $l): array
    {
        return ['id' => $l->id, 'name' => $l->name, 'ownerTeamId' => $l->owner_team_id, 'teamIds' => $l->teams->pluck('id')->values()];
    }
}
