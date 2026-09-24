<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlayerPasscodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_passcode_works_until_changed(): void
    {
        $this->postJson('/api/player-login', ['passcode' => 'vale2zenith'])->assertNoContent();
        $this->postJson('/api/player-login', ['passcode' => 'nope'])->assertUnprocessable();
    }

    public function test_admin_change_replaces_the_old_passcode_for_everyone(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $this->putJson('/api/settings/passcode', ['passcode' => ' newcode99 '])
            ->assertOk()
            ->assertJsonPath('passcode', 'newcode99');

        $this->getJson('/api/settings/passcode')->assertJsonPath('passcode', 'newcode99');
        $this->postJson('/api/player-login', ['passcode' => 'newcode99'])->assertNoContent();
        $this->postJson('/api/player-login', ['passcode' => 'vale2zenith'])->assertUnprocessable();
    }

    public function test_passcode_is_hidden_from_public_settings_and_guests(): void
    {
        $this->getJson('/api/settings')->assertOk()->assertJsonMissingPath('data.playerPasscode');
        $this->getJson('/api/settings/passcode')->assertUnauthorized();
        $this->putJson('/api/settings/passcode', ['passcode' => 'hijacked'])->assertUnauthorized();
    }

    public function test_committee_can_read_but_not_change_the_passcode(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));
        $this->getJson('/api/settings/passcode')->assertOk()->assertJsonPath('passcode', 'vale2zenith');
        $this->putJson('/api/settings/passcode', ['passcode' => 'newcode99'])->assertForbidden();
    }

    public function test_guessing_is_throttled(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/player-login', ['passcode' => "guess$i"])->assertUnprocessable();
        }
        $this->postJson('/api/player-login', ['passcode' => 'vale2zenith'])->assertTooManyRequests();
    }
}
