<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // First, modify the ENUM columns to include 'cancelled'
        DB::statement("ALTER TABLE pledges MODIFY COLUMN status ENUM('active', 'overdue', 'redeemed', 'forfeited', 'auctioned', 'cancelled') DEFAULT 'active'");
        DB::statement("ALTER TABLE pledge_items MODIFY COLUMN status ENUM('stored', 'released', 'auctioned', 'cancelled') DEFAULT 'stored'");

        // Then add the cancellation tracking fields
        Schema::table('pledges', function (Blueprint $table) {
            $table->timestamp('cancelled_at')->nullable()->after('status');
            $table->foreignId('cancelled_by')->nullable()->after('cancelled_at')
                ->constrained('users')->nullOnDelete();
            $table->string('cancellation_reason')->nullable()->after('cancelled_by');
        });
    }

    public function down(): void
    {
        Schema::table('pledges', function (Blueprint $table) {
            $table->dropForeign(['cancelled_by']);
            $table->dropColumn(['cancelled_at', 'cancelled_by', 'cancellation_reason']);
        });

        // Revert ENUM columns
        DB::statement("ALTER TABLE pledges MODIFY COLUMN status ENUM('active', 'overdue', 'redeemed', 'forfeited', 'auctioned') DEFAULT 'active'");
        DB::statement("ALTER TABLE pledge_items MODIFY COLUMN status ENUM('stored', 'released', 'auctioned') DEFAULT 'stored'");
    }
};