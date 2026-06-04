<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL enum change requires raw SQL. Skipped on sqlite (tests),
        // where the column is a plain string and accepts any value.
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE whatsapp_config MODIFY COLUMN provider ENUM('ultramsg','twilio','wati','aisensy') NOT NULL DEFAULT 'ultramsg'");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE whatsapp_config MODIFY COLUMN provider ENUM('ultramsg','twilio','wati') NOT NULL DEFAULT 'ultramsg'");
        }
    }
};
