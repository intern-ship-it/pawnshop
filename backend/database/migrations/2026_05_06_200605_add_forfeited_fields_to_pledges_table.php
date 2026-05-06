<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('pledges', function (Blueprint $table) {
            $table->timestamp('forfeited_at')->nullable()->after('cancellation_notes');
            $table->unsignedBigInteger('forfeited_by')->nullable()->after('forfeited_at');
            $table->foreign('forfeited_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pledges', function (Blueprint $table) {
            $table->dropForeign(['forfeited_by']);
            $table->dropColumn(['forfeited_at', 'forfeited_by']);
        });
    }
};
