<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Videos pulled from the club's Instagram land in highlights with
        // their post id (so each is imported once) and a link to the post.
        // Deleting one only hides it, or the next sync would bring it back.
        Schema::table('highlights', function (Blueprint $table) {
            $table->string('source')->default('manual');
            $table->string('external_id')->nullable()->unique();
            $table->string('permalink', 2048)->nullable();
            $table->boolean('hidden')->default(false);
        });

        // When each feed was last checked, so page views only trigger a
        // sync every so often.
        Schema::table('club_settings', function (Blueprint $table) {
            $table->timestamp('instagram_synced_at')->nullable();
            $table->timestamp('youtube_synced_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('highlights', function (Blueprint $table) {
            $table->dropUnique(['external_id']);
            $table->dropColumn(['source', 'external_id', 'permalink', 'hidden']);
        });

        Schema::table('club_settings', function (Blueprint $table) {
            $table->dropColumn(['instagram_synced_at', 'youtube_synced_at']);
        });
    }
};
