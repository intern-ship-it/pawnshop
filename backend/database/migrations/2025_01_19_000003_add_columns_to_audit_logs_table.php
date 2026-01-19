<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            // Add description column if not exists
            if (!Schema::hasColumn('audit_logs', 'description')) {
                $table->string('description')->nullable()->after('action');
            }

            // Add metadata column if not exists
            if (!Schema::hasColumn('audit_logs', 'metadata')) {
                $table->json('metadata')->nullable()->after('new_values');
            }

            // Add severity column if not exists
            if (!Schema::hasColumn('audit_logs', 'severity')) {
                $table->string('severity')->default('info')->after('user_agent');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropColumn(['description', 'metadata', 'severity']);
        });
    }
};
