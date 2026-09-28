<?php

namespace Tests\Feature;

use App\Models\Player;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlayerProfileTest extends TestCase
{
    use RefreshDatabase;

    // 1x1 PNG — avoids needing GD for UploadedFile::fake()->image().
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    private function player(array $attributes = []): Player
    {
        return Player::create($attributes + [
            'number' => 9,
            'name' => 'Old Name',
            'position' => 'FWD',
            'phone' => '0800',
            'email' => 'old@example.com',
            'rating' => 6.0,
        ]);
    }

    public function test_player_can_edit_their_profile_with_the_passcode(): void
    {
        $player = $this->player();

        $this->postJson("/api/players/{$player->id}/profile", [
            'passcode' => 'vale2zenith',
            'name' => 'New Name',
            'number' => 10,
            'position' => 'MID',
            'secondary_position' => 'FWD',
            'bio' => 'Box-to-box.',
        ])->assertOk()
            ->assertJsonPath('data.name', 'New Name')
            ->assertJsonPath('data.number', 10)
            ->assertJsonPath('data.secondaryPosition', 'FWD')
            ->assertJsonPath('data.bio', 'Box-to-box.');
    }

    public function test_committee_fields_cannot_be_changed(): void
    {
        $player = $this->player();

        $this->postJson("/api/players/{$player->id}/profile", [
            'passcode' => 'vale2zenith',
            'rating' => 9.5,
            'membership' => 'guest',
            'active' => false,
        ])->assertOk();

        $player->refresh();
        $this->assertSame('6.00', $player->rating);
        $this->assertSame('member', $player->membership);
        $this->assertTrue($player->active);
    }

    public function test_wrong_passcode_is_rejected_and_no_photo_is_stored(): void
    {
        Storage::fake(config('filesystems.media_disk'));
        $player = $this->player();

        $this->post("/api/players/{$player->id}/profile", [
            'passcode' => 'nope',
            'name' => 'Hijacked',
            'photo' => UploadedFile::fake()->createWithContent('me.png', base64_decode(self::PNG)),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('passcode');

        $this->assertSame('Old Name', $player->fresh()->name);
        $this->assertDatabaseCount('media', 0);
    }

    public function test_passcode_is_required_without_a_committee_sign_in(): void
    {
        $player = $this->player();

        $this->postJson("/api/players/{$player->id}/profile", ['name' => 'X'])
            ->assertUnprocessable()->assertJsonValidationErrors('passcode');
    }

    public function test_committee_can_edit_without_the_passcode(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));
        $player = $this->player();

        $this->postJson("/api/players/{$player->id}/profile", ['name' => 'By Staff'])
            ->assertOk()->assertJsonPath('data.name', 'By Staff');
    }

    public function test_player_can_upload_and_remove_a_photo(): void
    {
        Storage::fake(config('filesystems.media_disk'));
        $player = $this->player();

        $this->post("/api/players/{$player->id}/profile", [
            'passcode' => 'vale2zenith',
            'photo' => UploadedFile::fake()->createWithContent('me.png', base64_decode(self::PNG)),
        ], ['Accept' => 'application/json'])->assertOk();

        $url = $player->fresh()->photo_url;
        $this->assertNotNull($url);
        $this->assertDatabaseHas('media', ['url' => $url, 'alt_text' => 'Old Name']);

        $this->postJson("/api/players/{$player->id}/profile", [
            'passcode' => 'vale2zenith',
            'remove_photo' => true,
        ])->assertOk()->assertJsonPath('data.photoUrl', null);
    }

    public function test_blank_contact_details_keep_the_old_ones(): void
    {
        $player = $this->player();

        $this->postJson("/api/players/{$player->id}/profile", [
            'passcode' => 'vale2zenith',
            'phone' => '',
            'email' => 'new@example.com',
        ])->assertOk();

        $player->refresh();
        $this->assertSame('0800', $player->phone);
        $this->assertSame('new@example.com', $player->email);
    }

    public function test_a_taken_number_is_rejected_but_keeping_your_own_is_fine(): void
    {
        $player = $this->player();
        Player::create(['number' => 7, 'name' => 'Existing Seven', 'position' => 'FWD']);

        $this->postJson("/api/players/{$player->id}/profile", ['passcode' => 'vale2zenith', 'number' => 7])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['number' => 'Number 7 is already taken by Existing Seven']);

        $this->postJson("/api/players/{$player->id}/profile", ['passcode' => 'vale2zenith', 'number' => 9])
            ->assertOk();
    }

    public function test_second_position_matching_the_main_one_is_cleared(): void
    {
        $player = $this->player(['secondary_position' => 'MID']);

        $this->postJson("/api/players/{$player->id}/profile", [
            'passcode' => 'vale2zenith',
            'secondary_position' => 'FWD',
        ])->assertOk()->assertJsonPath('data.secondaryPosition', null);
    }
}
