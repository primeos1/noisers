<?php

namespace App\Support;

use App\Models\ClubSetting;
use App\Models\Highlight;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Copies the club's YouTube uploads into highlights, from the channel's
 * public feed (its latest 15 videos) — no API key needed, just the
 * channel id in YOUTUBE_CHANNEL_ID. Runs the same way as InstagramSync.
 */
class YouTubeSync
{
    private const FEED = 'https://www.youtube.com/feeds/videos.xml';

    private const STALE_AFTER_MINUTES = 30;

    public static function syncIfStale(): void
    {
        if (! self::channelId()) {
            return;
        }
        $synced = ClubSetting::current()->youtube_synced_at;
        if ($synced && $synced->gt(now()->subMinutes(self::STALE_AFTER_MINUTES))) {
            return;
        }

        Cache::lock('youtube-sync', 120)->get(fn () => self::sync());
    }

    /**
     * @return int how many new highlights were added
     */
    public static function sync(): int
    {
        $channel = self::channelId();
        if (! $channel) {
            return 0;
        }

        ClubSetting::current()->forceFill(['youtube_synced_at' => now()])->save();

        try {
            $response = Http::timeout(15)->get(self::FEED, ['channel_id' => $channel]);
            if (! $response->successful()) {
                Log::warning('YouTube sync failed', ['status' => $response->status()]);

                return 0;
            }

            $feed = simplexml_load_string($response->body());
            if ($feed === false) {
                return 0;
            }

            $added = 0;
            foreach ($feed->entry as $entry) {
                $videoId = (string) $entry->children('yt', true)->videoId;
                if ($videoId === '' || Highlight::where('external_id', 'yt:'.$videoId)->exists()) {
                    continue;
                }

                $title = trim((string) $entry->title);
                $published = (string) $entry->published;

                Highlight::create([
                    'source' => 'youtube',
                    'external_id' => 'yt:'.$videoId,
                    'permalink' => 'https://www.youtube.com/watch?v='.$videoId,
                    'type' => 'video',
                    // YouTube's thumbnail links are permanent, unlike Instagram's.
                    'media_url' => 'https://i.ytimg.com/vi/'.$videoId.'/hqdefault.jpg',
                    'alt' => 'YouTube video',
                    'caption' => $title === '' ? null : Str::limit($title, 250),
                    'category' => 'Matchday',
                    'occurred_on' => $published !== '' ? substr($published, 0, 10) : null,
                ]);
                $added++;
            }

            return $added;
        } catch (Throwable $e) {
            Log::warning('YouTube sync failed', ['error' => $e->getMessage()]);

            return 0;
        }
    }

    private static function channelId(): ?string
    {
        return config('services.youtube.channel_id') ?: null;
    }
}
