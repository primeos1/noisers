<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeagueGamePlayer;
use App\Models\LeaguePrediction;
use App\Models\LeagueResult;
use App\Models\Player;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * The league's score predictor on league.noisersfc.com/play (FNL, the
 * fantasy game, is FnlController). Points are worked
 * out on the league site from the public results, so the server only keeps
 * the picks, and keeps them hidden until they lock.
 *
 * Squad players have no accounts, so a request carries
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
            'players' => Player::query()->where('active', true)->orderBy('name')->get()
                ->map(fn (Player $p) => ['id' => $p->id, 'name' => $p->name, 'photoUrl' => $p->photo_url, 'joined' => isset($joined[$p->id])])
                ->values(),
            // Who has made predictions and how many, without giving away the scores before kick-off.
            'predictors' => LeaguePrediction::query()->selectRaw('player_id, count(*) as n')->groupBy('player_id')->get()
                ->map(fn ($r) => ['playerId' => (int) $r->player_id, 'count' => (int) $r->n])
                ->values(),
            'predictions' => LeaguePrediction::whereIn('match_no', $started)->get()->map(fn ($p) => $this->prediction($p))->values(),
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

    /** Committee: clears a forgotten PIN so the player can set a new one. Their picks stay. */
    public function resetPin(Request $request, Player $player)
    {
        abort_unless($request->user()?->isCommittee(), 403);
        LeagueGamePlayer::where('player_id', $player->id)->delete();

        return response()->noContent();
    }

    public function signIn(Request $request, bool $allowSetup = false): Player
    {
        // Just the player and their PIN: the PIN they set the first time keeps their picks theirs.
        $data = $request->validate([
            'player_id' => ['required', 'integer', 'exists:players,id'],
            'pin' => ['required', 'string', 'regex:/^\d{4}$/'],
        ], ['pin.regex' => 'Your PIN is 4 digits.']);

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
        ];
    }

    /** @return int[] fixtures that have kicked off */
    private function startedMatches(): array
    {
        return LeagueResult::whereIn('status', ['live', 'final'])->pluck('match_no')->map(fn ($n) => (int) $n)->all();
    }

    private function prediction(LeaguePrediction $p): array
    {
        return ['playerId' => $p->player_id, 'matchNo' => $p->match_no, 'home' => $p->home, 'away' => $p->away];
    }
}
