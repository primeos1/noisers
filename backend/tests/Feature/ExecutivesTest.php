<?php

namespace Tests\Feature;

use App\Models\Executive;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExecutivesTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_can_list_executives_in_order(): void
    {
        Executive::create(['name' => 'Second', 'title' => 'Secretary', 'sort_order' => 1]);
        Executive::create(['name' => 'First', 'title' => 'Chairman', 'sort_order' => 0]);

        $this->getJson('/api/executives')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'First')
            ->assertJsonPath('data.0.title', 'Chairman')
            ->assertJsonPath('data.1.name', 'Second');
    }

    public function test_writes_require_auth(): void
    {
        $this->postJson('/api/executives', ['name' => 'X', 'title' => 'Y'])->assertUnauthorized();
        $this->putJson('/api/executives/order', ['ids' => []])->assertUnauthorized();
    }

    public function test_committee_can_manage_executives(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));

        $a = $this->postJson('/api/executives', [
            'name' => 'Tunde Bakare',
            'title' => 'Chairman',
            'photo_url' => 'https://media.noisersfc.com/tunde.jpg',
        ])->assertCreated()
            ->assertJsonPath('data.sortOrder', 0)
            ->assertJsonPath('data.group', 'executive')
            ->json('data.id');

        $b = $this->postJson('/api/executives', ['name' => 'Ada Obi', 'title' => 'Treasurer'])
            ->assertCreated()
            ->assertJsonPath('data.sortOrder', 1)
            ->assertJsonPath('data.photo', null)
            ->json('data.id');

        $this->postJson('/api/executives', ['name' => 'No title'])->assertUnprocessable();

        $this->postJson('/api/executives', ['name' => 'Kemi', 'title' => 'Kit manager', 'group' => 'staff'])
            ->assertCreated()
            ->assertJsonPath('data.group', 'staff');

        $this->postJson('/api/executives', ['name' => 'X', 'title' => 'Y', 'group' => 'fans'])->assertUnprocessable();

        $this->putJson("/api/executives/{$a}", ['group' => 'disciplinary'])
            ->assertOk()
            ->assertJsonPath('data.group', 'disciplinary');

        $this->putJson("/api/executives/{$b}", ['title' => 'Vice Chairman'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Vice Chairman')
            ->assertJsonPath('data.name', 'Ada Obi');

        $this->putJson('/api/executives/order', ['ids' => [$b, $a]])
            ->assertOk()
            ->assertJsonPath('data.0.id', $b)
            ->assertJsonPath('data.1.id', $a);

        $this->deleteJson("/api/executives/{$a}")->assertNoContent();
        $this->assertDatabaseMissing('executives', ['id' => $a]);
    }
}
