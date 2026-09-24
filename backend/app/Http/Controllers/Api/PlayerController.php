<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePlayerRequest;
use App\Http\Requests\UpdatePlayerRequest;
use App\Http\Resources\PlayerResource;
use App\Models\Card;
use App\Models\ClubSetting;
use App\Models\MatchDayEvent;
use App\Models\Media;
use App\Models\Player;
use App\Support\PlayerStats;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class PlayerController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Player::query();

        if ($request->boolean('active_only', true)) {
            $query->where('active', true);
        }

        if ($request->filled('position')) {
            $query->where('position', $request->string('position'));
        }

        $players = $query->orderBy('number')->get();

        $this->attachMatchDayStats($players);

        return PlayerResource::collection($players);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StorePlayerRequest $request)
    {
        $this->authorize('create', Player::class);

        $data = $request->validated();
        $data['rating'] ??= ClubSetting::current()->rating_new_player;

        $player = Player::create($data);

        return new PlayerResource($player);
    }

    /**
     * Public sign-up from the /join link. Gated by the squad passcode so
     * only people the committee has told can add themselves. Rating and
     * active status aren't the player's to choose — they get the club's
     * new-player rating like anyone added from the admin.
     */
    public function join(Request $request)
    {
        $data = $request->validate([
            'passcode' => ['required', 'string', 'max:64'],
            'number' => ['required', 'integer', 'min:1', 'max:99', 'unique:players,number'],
            'name' => ['required', 'string', 'max:255'],
            'position' => ['required', 'in:GK,DEF,MID,FWD'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'photo' => ['nullable', 'image', 'max:5120'],
        ], [
            'number.unique' => 'That shirt number is already taken — pick another.',
        ]);

        $setting = ClubSetting::current();

        if (! $setting->checkPlayerPasscode($data['passcode'])) {
            throw ValidationException::withMessages([
                'passcode' => ["That passcode isn't right — check with the committee."],
            ]);
        }

        // Stored like an admin upload (same disk, shows in the media library),
        // but only once the passcode has checked out.
        if ($file = $request->file('photo')) {
            $disk = config('filesystems.media_disk');
            $path = $file->store('media', $disk);

            $media = Media::create([
                'disk' => $disk,
                'path' => $path,
                'url' => Storage::disk($disk)->url($path),
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size' => $file->getSize(),
                'alt_text' => $data['name'],
            ]);
            $data['photo_url'] = $media->url;
        }

        unset($data['passcode'], $data['photo']);
        $data['rating'] = $setting->rating_new_player;
        $data['active'] = true;

        $player = Player::create($data);

        return new PlayerResource($player);
    }

    /**
     * Display the specified resource.
     */
    public function show(Player $player)
    {
        $this->attachMatchDayStats(collect([$player]));

        return new PlayerResource($player);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdatePlayerRequest $request, Player $player)
    {
        $this->authorize('update', $player);

        $player->update($request->validated());
        $this->attachMatchDayStats(collect([$player]));

        return new PlayerResource($player);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Player $player)
    {
        $this->authorize('delete', $player);

        $player->delete();

        return response()->noContent();
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Player>  $players
     */
    private function attachMatchDayStats($players): void
    {
        // Oldest first, so the portal can draw each player's rating journey.
        (new EloquentCollection($players->all()))->load(['ratingChanges' => fn ($q) => $q->orderBy('id')]);

        $stats = PlayerStats::computeAll(MatchDayEvent::query()->get());

        // Cards logged by hand (fixtures, not match days) count towards the
        // season's discipline too. Match-day cards are already in $stats, so
        // their Card records are skipped to avoid counting them twice.
        $manualCards = Card::query()
            ->whereNull('match_day_ref')
            ->whereIn('player_id', $players->pluck('id'))
            ->selectRaw('player_id, type, count(*) as total')
            ->groupBy('player_id', 'type')
            ->get()
            ->groupBy('player_id');

        foreach ($players as $player) {
            $row = $stats[$player->number] ?? null;
            foreach ($manualCards[$player->id] ?? [] as $count) {
                $row ??= ['appearances' => 0, 'goals' => 0, 'assists' => 0, 'cleanSheets' => 0, 'yellowCards' => 0, 'redCards' => 0];
                $row[$count->type === 'red' ? 'redCards' : 'yellowCards'] += (int) $count->total;
            }
            $player->setAttribute('match_day_stats', $row);
        }
    }
}
