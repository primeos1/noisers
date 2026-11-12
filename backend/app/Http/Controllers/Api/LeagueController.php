<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeagueGoal;
use App\Models\LeagueResult;
use App\Models\LeagueState;
use App\Models\Player;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The Noisers League (league.noisersfc.com): who's in, the sealed live draw,
 * and the match day results. Fixtures and squads are worked out on the
 * client from the schedule and the draw seed, so only the inputs live here.
 */
class LeagueController extends Controller
{
    /** 6 clubs, every pair three times. */
    public const MATCHES = 45;

    /**
     * Players who joined after the draw was sealed. They're sent with the
     * entrants so the league site can place them (see league/draw.ts), but
     * they never feed the draw itself.
     */
    private const LATE_SIGNINGS = [70]; // Buchi

    /** Moved into goal for the league after the draw. */
    private const LATE_KEEPERS = [50]; // Shubby

    public const NIGHTS = 5;

    /** Everything the league site shows, in one call it can poll. */
    public function show()
    {
        return response()->json(['data' => $this->payload(LeagueState::current())]);
    }

    /** Mark which squad players are in the league. Locked once the draw is sealed. */
    public function updateEntrants(Request $request)
    {
        $this->authorizeCommittee($request);
        $state = LeagueState::current();

        if ($state->hasDraw()) {
            throw ValidationException::withMessages([
                'player_ids' => 'The draw is sealed with the current players. Cancel the draw to change who is in.',
            ]);
        }

        $data = $request->validate([
            'player_ids' => ['present', 'array'],
            'player_ids.*' => ['integer', 'distinct', 'exists:players,id'],
            'keeper_ids' => ['sometimes', 'array'],
            'keeper_ids.*' => ['integer', 'distinct', 'exists:players,id'],
        ]);

        $ids = array_values(array_map('intval', $data['player_ids']));
        sort($ids);
        $update = ['entrant_ids' => $ids];
        if (array_key_exists('keeper_ids', $data)) {
            $keepers = array_values(array_map('intval', $data['keeper_ids']));
            sort($keepers);
            $update['keeper_ids'] = $keepers;
        }
        $state->update($update);

        return response()->json(['data' => $this->payload($state)]);
    }

    /**
     * Seal the draw: freeze the players, pick a secret seed and publish only
     * its fingerprint. The seed is revealed when the draw starts.
     */
    public function scheduleDraw(Request $request)
    {
        $this->authorizeCommittee($request);
        $state = LeagueState::current();

        $data = $request->validate([
            'starts_at' => ['required', 'date', 'after:now'],
            'speed' => ['sometimes', 'numeric', 'min:0.5', 'max:8'],
        ]);

        if ($state->hasDraw()) {
            throw ValidationException::withMessages(['starts_at' => 'A draw is already sealed. Cancel it first.']);
        }

        $entrants = $this->entrantPlayers($state->entrant_ids ?? [], $state->keeper_ids ?? []);
        if (count($entrants) < 6) {
            throw ValidationException::withMessages(['starts_at' => 'Mark at least 6 players as in the league before sealing the draw.']);
        }

        $seed = bin2hex(random_bytes(16));
        $state->update([
            'draw_seed' => $seed,
            'draw_hash' => hash('sha256', $seed),
            // Parsed to UTC first, or an offset like +01:00 would be stored as if it were UTC.
            'draw_starts_at' => Carbon::parse($data['starts_at'])->utc(),
            'draw_speed' => $data['speed'] ?? 1,
            'draw_entrants' => $entrants,
        ]);

        return response()->json(['data' => $this->payload($state->refresh())], 201);
    }

    /** Cancel a pending draw. Revealed official teams are permanently locked. */
    public function cancelDraw(Request $request)
    {
        $this->authorizeCommittee($request);
        $state = LeagueState::current();

        if ($state->drawRevealed()) {
            throw ValidationException::withMessages(['draw' => 'The official teams are locked. A revealed draw cannot be cancelled or redrawn.']);
        }

        $state->update([
            'draw_seed' => null,
            'draw_hash' => null,
            'draw_starts_at' => null,
            'draw_speed' => 1,
            'draw_entrants' => null,
        ]);

        return response()->json(['data' => $this->payload($state)]);
    }

    /** Start (night 1-5) or end (null) a league match day. */
    public function updateMatchday(Request $request)
    {
        $this->authorizeCommittee($request);
        $data = $request->validate(['night' => ['present', 'nullable', 'integer', 'min:1', 'max:'.self::NIGHTS]]);

        $state = LeagueState::current();
        $state->update(['live_night' => $data['night']]);

        return response()->json(['data' => $this->payload($state)]);
    }

    /** Kick off, finish, or reset (wipes its goals) one fixture. */
    public function updateMatch(Request $request, int $matchNo)
    {
        $this->authorizeCommittee($request);
        $this->checkMatchNo($matchNo);
        $data = $request->validate([
            'status' => ['required', 'in:scheduled,live,final'],
            'saves' => ['sometimes', 'array'],
            'saves.*' => ['integer', 'min:0', 'max:1000'],
        ]);
        if (isset($data['saves'])) {
            $state = LeagueState::current();
            $keepers = [
                ...collect($state->draw_entrants ?? $this->entrantPlayers($state->entrant_ids ?? [], $state->keeper_ids ?? []))
                    ->where('position', 'GK')->pluck('id')->all(),
                ...self::LATE_KEEPERS,
            ];
            foreach (array_keys($data['saves']) as $id) {
                if (! in_array((int) $id, $keepers, true)) {
                    throw ValidationException::withMessages(['saves' => 'Saves must belong to league keepers.']);
                }
            }
        }

        DB::transaction(function () use ($matchNo, $data) {
            $result = LeagueResult::firstOrNew(['match_no' => $matchNo]);
            $result->status = $data['status'];
            if (isset($data['saves'])) {
                $result->saves = $data['saves'];
            }
            if ($data['status'] === 'scheduled') {
                $result->saves = [];
                $result->started_at = null;
                $result->finished_at = null;
                LeagueGoal::where('match_no', $matchNo)->delete();
            } else {
                $result->started_at ??= now();
                $result->finished_at = $data['status'] === 'final' ? ($result->finished_at ?? now()) : null;
            }
            $result->save();
        });

        return response()->json(['data' => $this->payload(LeagueState::current())]);
    }

    public function storeGoal(Request $request, int $matchNo)
    {
        $this->authorizeCommittee($request);
        $this->checkMatchNo($matchNo);
        $data = $request->validate([
            'side' => ['required', 'in:home,away'],
            'player_id' => ['nullable', 'integer', 'exists:players,id'],
            'assist_player_id' => ['nullable', 'integer', 'exists:players,id', 'different:player_id'],
            'own_goal' => ['sometimes', 'boolean'],
        ]);

        DB::transaction(function () use ($matchNo, $data) {
            LeagueGoal::create(['match_no' => $matchNo, ...$data]);
            // A goal means the game is on, even if nobody pressed kick-off.
            $result = LeagueResult::firstOrNew(['match_no' => $matchNo]);
            if ($result->status === null || $result->status === 'scheduled') {
                $result->status = 'live';
                $result->started_at ??= now();
                $result->save();
            }
        });

        return response()->json(['data' => $this->payload(LeagueState::current())], 201);
    }

    public function destroyGoal(Request $request, LeagueGoal $goal)
    {
        $this->authorizeCommittee($request);
        $goal->delete();

        return response()->json(['data' => $this->payload(LeagueState::current())]);
    }

    private function payload(LeagueState $state): array
    {
        $goals = LeagueGoal::orderBy('id')->get();
        $results = LeagueResult::orderBy('match_no')->get()->map(function (LeagueResult $r) use ($goals) {
            $mine = $goals->where('match_no', $r->match_no);

            return [
                'matchNo' => $r->match_no,
                'saves' => (object) ($r->saves ?? []),
                'status' => $r->status,
                'homeScore' => $mine->where('side', 'home')->count(),
                'awayScore' => $mine->where('side', 'away')->count(),
                'startedAt' => $r->started_at?->toIso8601String(),
                'finishedAt' => $r->finished_at?->toIso8601String(),
            ];
        })->values();

        $draw = null;
        if ($state->hasDraw()) {
            $revealed = $state->drawRevealed();
            $draw = [
                'hash' => $state->draw_hash,
                'startsAt' => $state->draw_starts_at->toIso8601String(),
                'speed' => $state->draw_speed,
                'revealed' => $revealed,
                'seed' => $revealed ? $state->draw_seed : null,
            ];
        }

        return [
            'entrantIds' => $state->entrant_ids ?? [],
            'keeperIds' => $state->keeper_ids ?? [],
            // The frozen list once the draw is sealed, the live one before.
            'entrants' => $state->draw_entrants
                ? [...$state->draw_entrants, ...$this->entrantPlayers(array_values(array_diff(self::LATE_SIGNINGS, array_column($state->draw_entrants, 'id'))))]
                : $this->entrantPlayers($state->entrant_ids ?? [], $state->keeper_ids ?? []),
            'draw' => $draw,
            'liveNight' => $state->live_night,
            'results' => $results,
            'goals' => $goals->map(fn (LeagueGoal $g) => [
                'id' => $g->id,
                'matchNo' => $g->match_no,
                'side' => $g->side,
                'playerId' => $g->player_id,
                'assistPlayerId' => $g->assist_player_id,
                'ownGoal' => $g->own_goal,
            ])->values(),
            'serverTime' => now()->toIso8601ZuluString('millisecond'),
        ];
    }

    /** @return list<array{id:int,name:string,position:string,rating:float,photoUrl:?string}> */
    private function entrantPlayers(array $ids, array $keeperIds = []): array
    {
        if ($ids === []) {
            return [];
        }

        return Player::whereIn('id', $ids)->orderBy('id')->get()->map(fn (Player $p) => [
            'id' => $p->id,
            'name' => $p->name,
            // League keepers play in goal here; their squad position is unchanged.
            'position' => in_array($p->id, $keeperIds, true) ? 'GK' : $p->position,
            'rating' => round((float) $p->rating, 2),
            'photoUrl' => $p->photo_url,
        ])->values()->all();
    }

    private function checkMatchNo(int $matchNo): void
    {
        abort_unless($matchNo >= 1 && $matchNo <= self::MATCHES, 404);
    }

    private function authorizeCommittee(Request $request): void
    {
        abort_unless($request->user()?->isCommittee(), 403);
    }
}
