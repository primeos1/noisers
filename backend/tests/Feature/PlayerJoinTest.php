<?php

namespace Tests\Feature;

use App\Models\ClubSetting;
use App\Models\Player;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PlayerJoinTest extends TestCase
{
    use RefreshDatabase;

    public function test_player_can_join_with_the_squad_passcode(): void
    {
        ClubSetting::current()->update(['rating_new_player' => 6.5]);

        $this->postJson('/api/players/join', [
            'passcode' => 'vale2zenith',
            'number' => 14,
            'name' => 'New Signing',
            'position' => 'MID',
            'membership' => 'member',
            'phone' => '08012345678',
            'rating' => 9.5,
            'active' => false,
        ])->assertCreated()->assertJsonPath('data.name', 'New Signing');

        $player = Player::where('number', 14)->firstOrFail();
        $this->assertSame('6.50', $player->rating);
        $this->assertTrue($player->active);
    }

    public function test_player_can_join_with_a_photo(): void
    {
        Storage::fake(config('filesystems.media_disk'));

        // 1x1 PNG — avoids needing GD for UploadedFile::fake()->image().
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');

        $this->post('/api/players/join', [
            'passcode' => 'vale2zenith',
            'number' => 22,
            'name' => 'Photo Guy',
            'position' => 'DEF',
            'membership' => 'member',
            'photo' => UploadedFile::fake()->createWithContent('me.png', $png),
        ], ['Accept' => 'application/json'])->assertCreated();

        $player = Player::where('number', 22)->firstOrFail();
        $this->assertNotNull($player->photo_url);
        $this->assertDatabaseHas('media', ['url' => $player->photo_url]);
    }

    public function test_photo_is_not_stored_when_the_passcode_is_wrong(): void
    {
        Storage::fake(config('filesystems.media_disk'));
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');

        $this->post('/api/players/join', [
            'passcode' => 'nope',
            'number' => 22,
            'name' => 'Stranger',
            'position' => 'DEF',
            'membership' => 'member',
            'photo' => UploadedFile::fake()->createWithContent('me.png', $png),
        ], ['Accept' => 'application/json'])->assertUnprocessable();

        $this->assertDatabaseCount('media', 0);
    }

    public function test_wrong_passcode_is_rejected(): void
    {
        $this->postJson('/api/players/join', [
            'passcode' => 'nope',
            'number' => 14,
            'name' => 'Stranger',
            'position' => 'FWD',
            'membership' => 'member',
        ])->assertUnprocessable()->assertJsonValidationErrors('passcode');

        $this->assertDatabaseCount('players', 0);
    }

    public function test_a_taken_number_is_rejected_with_the_owners_name(): void
    {
        Player::create(['number' => 7, 'name' => 'Existing Seven', 'position' => 'FWD']);

        $this->postJson('/api/players/join', [
            'passcode' => 'vale2zenith',
            'number' => 7,
            'name' => 'Copycat',
            'position' => 'MID',
            'membership' => 'member',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['number' => 'Number 7 is already taken by Existing Seven']);

        $this->assertSame(1, Player::where('number', 7)->count());
    }

    public function test_player_can_pick_a_second_position(): void
    {
        $this->postJson('/api/players/join', [
            'passcode' => 'vale2zenith',
            'number' => 8,
            'name' => 'Second Seven',
            'position' => 'MID',
            'membership' => 'member',
            'secondary_position' => 'FWD',
        ])->assertCreated()->assertJsonPath('data.secondaryPosition', 'FWD');
    }

    public function test_second_position_must_differ_from_the_main_one(): void
    {
        $this->postJson('/api/players/join', [
            'passcode' => 'vale2zenith',
            'number' => 7,
            'name' => 'Double Mid',
            'position' => 'MID',
            'membership' => 'member',
            'secondary_position' => 'MID',
        ])->assertUnprocessable()->assertJsonValidationErrors('secondary_position');
    }

    public function test_player_can_join_as_a_guest_member(): void
    {
        $this->postJson('/api/players/join', [
            'passcode' => 'vale2zenith',
            'number' => 30,
            'name' => 'Visiting Vic',
            'position' => 'FWD',
            'membership' => 'guest',
        ])->assertCreated()->assertJsonPath('data.membership', 'guest');

        $this->postJson('/api/players/join', [
            'passcode' => 'vale2zenith',
            'number' => 31,
            'name' => 'No Choice',
            'position' => 'FWD',
        ])->assertUnprocessable()->assertJsonValidationErrors('membership');
    }
}
