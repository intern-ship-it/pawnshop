<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-branch toggle: when on, WhatsApp confirmations also attach the PDF receipt
     * (works for both UltraMsg and AiSensy). Defaults off — no behavior change until enabled.
     */
    public function up(): void
    {
        Schema::table('whatsapp_config', function (Blueprint $table) {
            $table->boolean('attach_pdf_receipt')->default(false)->after('is_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('whatsapp_config', function (Blueprint $table) {
            $table->dropColumn('attach_pdf_receipt');
        });
    }
};
