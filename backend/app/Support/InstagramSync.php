<?php

namespace App\Support;

use App\Models\ClubSetting;
use App\Models\Highlight;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Copies the club's Instagram videos and reels into highlights, from a
 * Behold (behold.so) JSON feed — Behold handles the Instagram login, so
 * all we need is the feed URL in INSTAGRAM_FEED_URL. There's no scheduler
 * in production, so the highlights list calls syncIfStale() after each
 * response; `php artisan instagram:sync` forces a run.
 *
 * The free feed only lists the latest few posts, but each video is kept
 * here once imported, so the page keeps everything posted since.
 */
class InstagramSync
{
    /** How long a sync stays fresh before the next page view runs another. */
    private const STALE_AFTER_MINUTES = 30;

    /** How many video files one run copies over. */
    private const DOWNLOADS_PER_RUN = 3;

    public static function syncIfStale(): void
    {
        if (! self::feedUrl()) {
            return;
        }
        $synced = ClubSetting::current()->instagram_synced_at;
        if ($synced && $synced->gt(now()->subMinutes(self::STALE_AFTER_MINUTES))) {
            return;
        }

        Cache::lock('instagram-sync', 600)->get(fn () => self::sync());
    }

    /**
     * @return int how many new highlights were added
     */
    public static function sync(): int
    {
        $feed = self::feedUrl();
        if (! $feed) {
            return 0;
        }

        // Count this as a run even if it fails, so an outage doesn't mean
        // calling the feed on every page view.
        ClubSetting::current()->forceFill(['instagram_synced_at' => now()])->save();

        try {
            $response = Http::timeout(15)->get($feed);
            if (! $response->successful()) {
                Log::warning('Instagram sync failed', ['status' => $response->status()]);

                return 0;
            }

            $added = 0;
            $downloads = 0;
            foreach ($response->json('posts', []) as $post) {
                if (($post['mediaType'] ?? null) !== 'VIDEO' || empty($post['id'])) {
                    continue;
                }

                $highlight = Highlight::where('external_id', $post['id'])->first();
                if (! $highlight) {
                    $highlight = self::import($post);
                    if (! $highlight) {
                        continue;
                    }
                    $added++;
                }

                // Videos are big, so fetch a few per run; the rest follow
                // on the next one while they're still in the feed.
                if (! $highlight->video_url && $downloads < self::DOWNLOADS_PER_RUN) {
                    $downloads++;
                    $video = self::storeVideo($post['id'], $post['mediaUrl'] ?? null);
                    if ($video) {
                        $highlight->update(['video_url' => $video]);
                    }
                }
            }

            return $added;
        } catch (Throwable $e) {
            Log::warning('Instagram sync failed', ['error' => $e->getMessage()]);

            return 0;
        }
    }

    /**
     * @param  array<string, mixed>  $post
     */
    private static function import(array $post): ?Highlight
    {
        // Instagram's CDN links expire, so keep our own copy of the cover.
        $cover = $post['sizes']['large']['mediaUrl'] ?? $post['thumbnailUrl'] ?? null;
        $thumbnail = self::storeThumbnail($post['id'], $cover);
        if (! $thumbnail) {
            return null;
        }

        $caption = trim(preg_replace('/\s+/', ' ', (string) ($post['prunedCaption'] ?? $post['caption'] ?? '')));

        return Highlight::create([
            'source' => 'instagram',
            'external_id' => $post['id'],
            'permalink' => $post['permalink'] ?? null,
            'type' => 'video',
            'media_url' => $thumbnail,
            'alt' => 'Instagram video',
            'caption' => $caption === '' ? null : Str::limit($caption, 250),
            'category' => 'Matchday',
            'occurred_on' => isset($post['timestamp']) ? substr($post['timestamp'], 0, 10) : null,
            // Reels are portrait, so give them a tall tile.
            'tall' => true,
        ]);
    }

    private static function storeVideo(string $id, ?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        // Stream to a temp file rather than holding the video in memory.
        $tmp = tempnam(sys_get_temp_dir(), 'ig');
        try {
            $response = Http::timeout(90)->sink($tmp)->get($url);
            if (! $response->successful() || filesize($tmp) === 0) {
                return null;
            }

            $disk = config('filesystems.media_disk');
            $path = 'media/instagram/'.preg_replace('/\W/', '', $id).'.mp4';
            $stream = fopen($tmp, 'r');
            Storage::disk($disk)->put($path, $stream, ['visibility' => 'public', 'ContentType' => 'video/mp4']);
            if (is_resource($stream)) {
                fclose($stream);
            }

            return Storage::disk($disk)->url($path);
        } catch (Throwable $e) {
            Log::warning('Instagram video download failed', ['id' => $id, 'error' => $e->getMessage()]);

            return null;
        } finally {
            @unlink($tmp);
        }
    }

    private static function storeThumbnail(string $id, ?string $url): ?string
    {
        if (! $url) {
            return null;
        }
        $image = Http::timeout(15)->get($url);
        if (! $image->successful()) {
            return null;
        }

        $disk = config('filesystems.media_disk');
        $path = 'media/instagram/'.preg_replace('/\W/', '', $id).'.jpg';
        Storage::disk($disk)->put($path, $image->body(), 'public');

        return Storage::disk($disk)->url($path);
    }

    private static function feedUrl(): ?string
    {
        return config('services.instagram.feed_url') ?: null;
    }
}
