<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ChangePasswordTest extends TestCase
{
    use RefreshDatabase;

    private function signIn(User $user): string
    {
        return $user->createToken('web')->plainTextToken;
    }

    public function test_staff_can_change_their_own_password_with_the_current_one(): void
    {
        $user = User::factory()->create(['role' => 'committee', 'password' => 'old-password']);
        $other = $user->createToken('phone');
        $token = $this->signIn($user);

        $this->withToken($token)->putJson('/api/user/password', [
            'current_password' => 'old-password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])->assertNoContent();

        $this->assertTrue(Hash::check('new-password', $user->fresh()->password));
        // Other devices are signed out, this one isn't.
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $other->accessToken->id]);
        $this->assertSame(1, $user->tokens()->count());
    }

    public function test_the_current_password_must_be_right(): void
    {
        $user = User::factory()->create(['role' => 'admin', 'password' => 'old-password']);

        $this->withToken($this->signIn($user))->putJson('/api/user/password', [
            'current_password' => 'wrong',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->assertTrue(Hash::check('old-password', $user->fresh()->password));
    }

    public function test_the_new_password_must_be_confirmed(): void
    {
        $user = User::factory()->create(['role' => 'admin', 'password' => 'old-password']);

        $this->withToken($this->signIn($user))->putJson('/api/user/password', [
            'current_password' => 'old-password',
            'password' => 'new-password',
            'password_confirmation' => 'typo-password',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_guests_cannot_change_a_password(): void
    {
        $this->putJson('/api/user/password', [])->assertUnauthorized();
    }
}
