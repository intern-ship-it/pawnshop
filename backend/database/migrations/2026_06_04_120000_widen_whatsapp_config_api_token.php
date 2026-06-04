<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * AiSensy API keys are JWTs (~300-600+ chars), far longer than UltraMsg tokens.
     * Widen api_token from VARCHAR(255) to TEXT so any provider's credential fits.
     */
    public function up(): void
    {
        Schema::table('whatsapp_config', function (Blueprint $table) {
            $table->text('api_token')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('whatsapp_config', function (Blueprint $table) {
            $table->string('api_token', 255)->nullable()->change();
        });
    }
};
