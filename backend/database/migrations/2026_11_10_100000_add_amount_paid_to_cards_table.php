<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Fines can be paid off in parts. `paid` stays as "nothing left owing"
        // and is kept in step by the Card model.
        Schema::table('cards', function (Blueprint $table) {
            $table->decimal('amount_paid', 8, 2)->default(0)->after('fine_amount');
        });

        DB::table('cards')->where('paid', true)->update(['amount_paid' => DB::raw('fine_amount')]);
    }

    public function down(): void
    {
        Schema::table('cards', function (Blueprint $table) {
            $table->dropColumn('amount_paid');
        });
    }
};
