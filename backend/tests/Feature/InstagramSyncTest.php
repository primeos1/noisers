<?php

namespace Tests\Feature;

use App\Models\ClubSetting;
use App\Models\Highlight;
use App\Models\User;
use App\Support\InstagramSync;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InstagramSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake(config('filesystems.media_disk'));
        config(['services.instagram.feed_url' => 'https://feeds.behold.so/abc123']);

        Http::fake([
            'feeds.behold.so/*' => Http::response(['username' => 'noisersfc', 'posts' => [
                [
                    'id' => '111', 'mediaType' => 'VIDEO', 'isReel' => true,
                    'mediaUrl' => 'https://cdn.example/111.mp4',
                    'thumbnailUrl' => 'https://cdn.example/111-thumb.jpg',
                    'sizes' => ['large' => ['mediaUrl' => 'https://cdn.example/111-large.jpg']],
                    'permalink' => 'https://www.instagram.com/reel/AAA/',
                    'caption' => "Last-minute\nwinner #noisers", 'prunedCaption' => "Last-minute\nwinner",
                    'timestamp' => '2026-11-16T18:00:00+0000',
                ],
                ['id' => '222', 'mediaType' => 'IMAGE', 'mediaUrl' => 'https://cdn.example/222.jpg', 'permalink' => 'https://www.instagram.com/p/BBB/'],
            ]]),
            // A fresh response per request: the cover and the video each read one.
            'cdn.example/*' => fn () => Http::response('media-bytes'),
        ]);
    }

    public function test_imports_only_videos_once(): void
    {
        $this->assertSame(1, InstagramSync::sync());
        $this->assertSame(0, InstagramSync::sync());

        $video = Highlight::sole();
        $this->assertSame('instagram', $video->source);
        $this->assertSame('video', $video->type);
        $this->assertSame('Last-minute winner', $video->caption);
        $this->assertSame('https://www.instagram.com/reel/AAA/', $video->permalink);
        Storage::disk(config('filesystems.media_disk'))->assertExists('media/instagram/111.jpg');
        Storage::disk(config('filesystems.media_disk'))->assertExists('media/instagram/111.mp4');
        $this->assertStringEndsWith('media/instagram/111.mp4', $video->fresh()->video_url);
    }

    public function test_highlights_list_syncs_when_stale(): void
    {
        $this->getJson('/api/highlights')->assertOk();

        $this->getJson('/api/highlights')
            ->assertOk()
            ->assertJsonPath('data.0.link', 'https://www.instagram.com/reel/AAA/');
    }

    public function test_deleting_a_synced_video_keeps_it_hidden(): void
    {
        InstagramSync::sync();
        $id = Highlight::sole()->id;

        Sanctum::actingAs(User::factory()->create(['role' => 'committee']));
        $this->deleteJson("/api/highlights/{$id}")->assertNoContent();

        ClubSetting::current()->forceFill(['instagram_synced_at' => null])->save();
        InstagramSync::sync();

        $this->assertCount(0, $this->getJson('/api/highlights')->json('data'));
    }

    public function test_does_nothing_without_a_feed(): void
    {
        config(['services.instagram.feed_url' => null]);

        $this->assertSame(0, InstagramSync::sync());
        Http::assertNothingSent();
    }
}
