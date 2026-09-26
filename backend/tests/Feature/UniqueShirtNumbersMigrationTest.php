<?php

namespace Tests\Feature;

use App\Models\Player;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UniqueShirtNumbersMigrationTest extends TestCase
{
    use RefreshDatabase;

    private function migration(): object
    {
        return require database_path('migrations/2026_09_26_120000_make_shirt_numbers_unique_again.php');
    }

    private function hasUniqueIndex(): bool
    {
        return collect(Schema::getIndexes('players'))
            ->contains(fn ($i) => $i['unique'] && $i['columns'] === ['number']);
    }

    public function test_it_skips_while_numbers_clash_and_adds_the_index_once_they_dont(): void
    {
        $this->migration()->down();
        $a = Player::create(['number' => 11, 'name' => 'First Eleven', 'position' => 'FWD']);
        Player::create(['number' => 11, 'name' => 'Second Eleven', 'position' => 'MID']);

        $this->migration()->up(); // must not throw — a failed deploy would take the API down
        $this->assertFalse($this->hasUniqueIndex());

        $a->update(['number' => 12]);
        $this->migration()->up();
        $this->assertTrue($this->hasUniqueIndex());

        $this->expectException(QueryException::class);
        Player::create(['number' => 12, 'name' => 'Sneaky', 'position' => 'GK']);
    }

    public function test_admin_cannot_give_a_player_a_taken_number_but_can_keep_their_own(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));
        $seven = Player::create(['number' => 7, 'name' => 'Seven', 'position' => 'MID']);
        $nine = Player::create(['number' => 9, 'name' => 'Nine', 'position' => 'FWD']);

        $this->putJson("/api/players/{$nine->id}", ['number' => 7])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['number' => 'Number 7 is already taken by Seven']);
        $this->putJson("/api/players/{$seven->id}", ['number' => 7, 'name' => 'Still Seven'])->assertOk();
        $this->postJson('/api/players', ['number' => 9, 'name' => 'Another Nine', 'position' => 'DEF'])
            ->assertUnprocessable();
    }
}
