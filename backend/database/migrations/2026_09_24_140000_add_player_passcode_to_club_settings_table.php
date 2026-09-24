<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Encrypted at rest (the model casts it). Null means "still the
        // default passcode" — see ClubSetting::DEFAULT_PLAYER_PASSCODE.
        Schema::table('club_settings', function (Blueprint $table) {
            $table->text('player_passcode')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('club_settings', function (Blueprint $table) {
            $table->dropColumn('player_passcode');
        });
    }
};
