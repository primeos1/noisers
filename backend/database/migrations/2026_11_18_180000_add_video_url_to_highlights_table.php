<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Our own copy of a synced Instagram video — Instagram won't play
        // its posts inside other sites, and its CDN links expire.
        Schema::table('highlights', function (Blueprint $table) {
            $table->string('video_url', 2048)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('highlights', function (Blueprint $table) {
            $table->dropColumn('video_url');
        });
    }
};
