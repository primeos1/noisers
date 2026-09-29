<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('executives', function (Blueprint $table) {
            // executive | staff | disciplinary — which section of the page they appear in.
            $table->string('group', 20)->default('executive')->after('title');
        });
    }

    public function down(): void
    {
        Schema::table('executives', function (Blueprint $table) {
            $table->dropColumn('group');
        });
    }
};
