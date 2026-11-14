<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClubSetting;
use App\Models\LeagueFantasyPick;
use App\Models\LeagueGamePlayer;
use App\Models\LeaguePrediction;
use App\Models\LeagueResult;
use App\Models\LeagueState;
use App\Models\Player;
use App\Support\LeagueMatchDaySync;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * The league's free-to-play games on league.noisersfc.com/play: score
 * predictions and a three-player fantasy pick per Sunday. Points are worked
 * out on the league site from the public results, so the server only keeps
 * the picks, and keeps them hidden until they lock.
 *
 * Squad players have no accounts, so a request carries the squad passcode,
 * the player's id and a personal 4-digit PIN they chose the first time.
 */
class LeagueGameController extends Controller
{
    /** Everyone's picks once they've locked, for the leaderboards. */
    public function show()
    {
        $started = $this->startedMatches();
        $joined = LeagueGamePlayer::pluck('player_id')->flip();

        return response()->json(['data' => [
            // Who can play, and who has set a PIN already (so the site asks to sign in, not to set one).
            'players' => Player::query()->where('active', true)->orderBy('name')->get(['id', 'name'])
                ->map(fn (Player $p) => ['id' => $p->id, 'name' => $p->name, 'joined' => isset($joined[$p->id])])
                ->values(),
            'predictions' => LeaguePrediction::whereIn('match_no', $started)->get()->map(fn ($p) => $this->prediction($p))->values(),
            'fantasy' => LeagueFantasyPick::whereIn('night', $this->startedNights($started))->get()->map(fn ($f) => $this->pick($f))->values(),
        ]]);
    }

    /** Signs in, setting the PIN on a player's first visit. Returns their own picks, locked or not. */
    public function login(Request $request)
    {
        $player = $this->signIn($request, allowSetup: true);

        return response()->json(['data' => $this->mine($player)]);
    }

    public function savePredictions(Request $request)
    {
        $player = $this->signIn($request);
        $data = $request->validate([
            'predictions' => ['required', 'array', 'max:'.LeagueController::MATCHES],
            'predictions.*.match_no' => ['required', 'integer', 'min:1', 'max:'.LeagueController::MATCHES],
            'predictions.*.home' => ['required', 'integer', 'min:0', 'max:20'],
            'predictions.*.away' => ['required', 'integer', 'min:0', 'max:20'],
        ]);

        $started = $this->startedMatches();
        foreach ($data['predictions'] as $p) {
            if (in_array((int) $p['match_no'], $started, true)) {
                throw ValidationException::withMessages(['predictions' => "Game {$p['match_no']} has kicked off, so its prediction is locked."]);
            }
        }
        foreach ($data['predictions'] as $p) {
            LeaguePrediction::updateOrCreate(
                ['player_id' => $player->id, 'match_no' => (int) $p['match_no']],
                ['home' => (int) $p['home'], 'away' => (int) $p['away']],
            );
        }

        return response()->json(['data' => $this->mine($player)]);
    }

    public function saveFantasy(Request $request)
    {
        $player = $this->signIn($request);
        $data = $request->validate([
            'night' => ['required', 'integer', 'min:1', 'max:'.LeagueController::NIGHTS],
            'pick_ids' => ['required', 'array', 'size:3'],
            'pick_ids.*' => ['integer', 'distinct'],
            'captain_id' => ['required', 'integer'],
        ]);

        if (in_array($data['night'], $this->startedNights($this->startedMatches()), true)) {
            throw ValidationException::withMessages(['night' => "Sunday {$data['night']} has kicked off, so its picks are locked."]);
        }
        $eligible = LeagueController::leaguePlayerIds();
        foreach ($data['pick_ids'] as $id) {
            if (! in_array((int) $id, $eligible, true)) {
                throw ValidationException::withMessages(['pick_ids' => 'Pick players who are in the league.']);
            }
        }
        if (! in_array((int) $data['captain_id'], array_map('intval', $data['pick_ids']), true)) {
            throw ValidationException::withMessages(['captain_id' => 'Your captain has to be one of your three picks.']);
        }

        LeagueFantasyPick::updateOrCreate(
            ['player_id' => $player->id, 'night' => $data['night']],
            ['pick_ids' => array_map('intval', $data['pick_ids']), 'captain_id' => (int) $data['captain_id']],
        );

        return response()->json(['data' => $this->mine($player)]);
    }

    /** Committee: clears a forgotten PIN so the player can set a new one. Their picks stay. */
    public function resetPin(Request $request, Player $player)
    {
        abort_unless($request->user()?->isCommittee(), 403);
        LeagueGamePlayer::where('player_id', $player->id)->delete();

        return response()->noContent();
    }

    private function signIn(Request $request, bool $allowSetup = false): Player
    {
        $data = $request->validate([
            'passcode' => ['required', 'string', 'max:64'],
            'player_id' => ['required', 'integer', 'exists:players,id'],
            'pin' => ['required', 'string', 'regex:/^\d{4}$/'],
        ], ['pin.regex' => 'Your PIN is 4 digits.']);

        if (! ClubSetting::current()->checkPlayerPasscode($data['passcode'])) {
            throw ValidationException::withMessages(['passcode' => "That passcode isn't right. Check with the committee."]);
        }

        $player = Player::findOrFail($data['player_id']);
        $entry = LeagueGamePlayer::where('player_id', $player->id)->first();
        if (! $entry) {
            if (! $allowSetup) {
                throw ValidationException::withMessages(['pin' => 'Sign in again to set your PIN.']);
            }
            LeagueGamePlayer::create(['player_id' => $player->id, 'pin_hash' => Hash::make($data['pin'])]);
        } elseif (! Hash::check($data['pin'], $entry->pin_hash)) {
            throw ValidationException::withMessages(['pin' => "That PIN isn't right. Ask the committee to reset it if you've forgotten it."]);
        }

        return $player;
    }

    /** @return array<string, mixed> */
    private function mine(Player $player): array
    {
        return [
            'playerId' => $player->id,
            'predictions' => LeaguePrediction::where('player_id', $player->id)->get()->map(fn ($p) => $this->prediction($p))->values(),
            'fantasy' => LeagueFantasyPick::where('player_id', $player->id)->get()->map(fn ($f) => $this->pick($f))->values(),
        ];
    }

    /** @return int[] fixtures that have kicked off */
    private function startedMatches(): array
    {
        return LeagueResult::whereIn('status', ['live', 'final'])->pluck('match_no')->map(fn ($n) => (int) $n)->all();
    }

    /**
     * @param  int[]  $started
     * @return int[] Sundays whose first game has kicked off
     */
    private function startedNights(array $started): array
    {
        $nights = [];
        $liveNight = LeagueState::current()->live_night;
        for ($n = 1; $n <= LeagueController::NIGHTS; $n++) {
            if (array_intersect(LeagueMatchDaySync::matchNumbers($n), $started) || $liveNight === $n) {
                $nights[] = $n;
            }
        }

        return $nights;
    }

    private function prediction(LeaguePrediction $p): array
    {
        return ['playerId' => $p->player_id, 'matchNo' => $p->match_no, 'home' => $p->home, 'away' => $p->away];
    }

    private function pick(LeagueFantasyPick $f): array
    {
        return ['playerId' => $f->player_id, 'night' => $f->night, 'pickIds' => $f->pick_ids, 'captainId' => $f->captain_id];
    }
}
