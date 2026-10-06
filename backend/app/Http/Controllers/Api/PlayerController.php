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
use App\Support\MatchDayFinalizer;
use App\Support\PlayerStats;
use App\Support\ShirtNumbers;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
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

        $players = $query->orderBy('number')->orderBy('name')->get();

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
            'number' => ['required', 'integer', 'min:1', 'max:99', ShirtNumbers::free()],
            'name' => ['required', 'string', 'max:255'],
            'position' => ['required', 'in:GK,DEF,MID,FWD'],
            'secondary_position' => ['nullable', 'in:GK,DEF,MID,FWD', 'different:position'],
            'membership' => ['required', 'in:member,guest'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'photo' => ['nullable', 'image', 'max:5120'],
        ], [
            'secondary_position.different' => 'Pick a second position that differs from your main one.',
        ]);

        $setting = ClubSetting::current();

        if (! $setting->checkPlayerPasscode($data['passcode'])) {
            throw ValidationException::withMessages([
                'passcode' => ["That passcode isn't right — check with the committee."],
            ]);
        }

        // Only stored once the passcode has checked out.
        if ($file = $request->file('photo')) {
            $data['photo_url'] = $this->storePhoto($file, $data['name']);
        }

        unset($data['passcode'], $data['photo']);
        $data['rating'] = $setting->rating_new_player;
        $data['active'] = true;

        $player = Player::create($data);

        return new PlayerResource($player);
    }

    /**
     * A player editing their own profile from the portal or the app. Players
     * have no accounts, so it's gated like /join: the squad passcode, or a
     * committee sign-in. Rating, membership and active status stay with the
     * committee. Phone and email are write-only here — they're never shown
     * to the squad — so they only change when sent non-empty.
     */
    public function updateProfile(Request $request, Player $player)
    {
        $staff = $request->user('sanctum')?->isCommittee() ?? false;

        $data = $request->validate([
            'passcode' => [$staff ? 'nullable' : 'required', 'string', 'max:64'],
            'number' => ['sometimes', 'required', 'integer', 'min:1', 'max:99', ShirtNumbers::free($player)],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'position' => ['sometimes', 'required', 'in:GK,DEF,MID,FWD'],
            'secondary_position' => ['nullable', 'in:GK,DEF,MID,FWD'],
            'bio' => ['nullable', 'string', 'max:500'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'photo' => ['nullable', 'image', 'max:5120'],
            'remove_photo' => ['boolean'],
        ]);

        if (! $staff && ! ClubSetting::current()->checkPlayerPasscode($data['passcode'])) {
            throw ValidationException::withMessages([
                'passcode' => ["That passcode isn't right — check with the committee."],
            ]);
        }

        foreach (['phone', 'email'] as $contact) {
            if (blank($data[$contact] ?? null)) {
                unset($data[$contact]);
            }
        }

        if ($file = $request->file('photo')) {
            $data['photo_url'] = $this->storePhoto($file, $data['name'] ?? $player->name);
        } elseif ($request->boolean('remove_photo')) {
            $data['photo_url'] = null;
        }

        // A second position matching the main one is no second position.
        if (array_key_exists('secondary_position', $data)
            && $data['secondary_position'] === ($data['position'] ?? $player->position)) {
            $data['secondary_position'] = null;
        }

        unset($data['passcode'], $data['photo'], $data['remove_photo']);
        $player->update($data);
        $this->attachMatchDayStats(collect([$player]));

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

        $data = $request->validated();
        // A second position matching the main one is no second position.
        if (($data['secondary_position'] ?? $player->secondary_position) === ($data['position'] ?? $player->position)) {
            $data['secondary_position'] = null;
        }
        $player->update($data);
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
     * Stored like an admin upload — same disk, and it shows in the media
     * library. Returns the public URL for the player's photo_url.
     */
    private function storePhoto(UploadedFile $file, string $name): string
    {
        $disk = config('filesystems.media_disk');
        $path = $file->store('media', $disk);

        return Media::create([
            'disk' => $disk,
            'path' => $path,
            'url' => Storage::disk($disk)->url($path),
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'alt_text' => $name,
        ])->url;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Player>  $players
     */
    private function attachMatchDayStats($players): void
    {
        // Oldest first, so the portal can draw each player's rating journey.
        (new EloquentCollection($players->all()))->load(['ratingChanges' => fn ($q) => $q->orderBy('id')]);

        $stats = PlayerStats::computeAll(MatchDayEvent::query()->get(), PlayerStats::forwardIds());
        $honours = MatchDayFinalizer::weeklyHonours();

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
            $row = $stats[$player->id] ?? null;
            foreach ($manualCards[$player->id] ?? [] as $count) {
                $row ??= ['appearances' => 0, 'goals' => 0, 'assists' => 0, 'cleanSheets' => 0, 'saves' => 0, 'penaltySaves' => 0, 'yellowCards' => 0, 'redCards' => 0];
                $row[$count->type === 'red' ? 'redCards' : 'yellowCards'] += (int) $count->total;
            }
            $player->setAttribute('match_day_stats', $row);
            $player->setAttribute('weekly_honours', $honours[$player->id] ?? null);
        }
    }
}
