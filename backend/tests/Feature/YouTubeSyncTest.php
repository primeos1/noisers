<?php

namespace Tests\Feature;

use App\Models\Highlight;
use App\Support\YouTubeSync;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class YouTubeSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_imports_channel_videos_once(): void
    {
        config(['services.youtube.channel_id' => 'UCabc']);
        Http::fake(['www.youtube.com/feeds/*' => Http::response(<<<'XML'
            <?xml version="1.0" encoding="UTF-8"?>
            <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
              <entry>
                <yt:videoId>dQw4w9WgXcQ</yt:videoId>
                <title>Matchday 12 goals</title>
                <published>2026-11-16T18:00:00+00:00</published>
              </entry>
            </feed>
            XML)]);

        $this->assertSame(1, YouTubeSync::sync());
        $this->assertSame(0, YouTubeSync::sync());

        $video = Highlight::sole();
        $this->assertSame('youtube', $video->source);
        $this->assertSame('Matchday 12 goals', $video->caption);
        $this->assertSame('https://www.youtube.com/watch?v=dQw4w9WgXcQ', $video->permalink);
        $this->assertSame('2026-11-16', $video->occurred_on->toDateString());
    }

    public function test_does_nothing_without_a_channel(): void
    {
        Http::fake();
        $this->assertSame(0, YouTubeSync::sync());
        Http::assertNothingSent();
    }
}
