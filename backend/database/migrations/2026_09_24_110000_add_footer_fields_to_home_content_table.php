<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('home_content', function (Blueprint $table) {
            $table->string('footer_tagline')->nullable()->after('matchday_body');
            $table->string('footer_copyright')->nullable()->after('footer_tagline');
        });
    }

    public function down(): void
    {
        Schema::table('home_content', function (Blueprint $table) {
            $table->dropColumn(['footer_tagline', 'footer_copyright']);
        });
    }
};
