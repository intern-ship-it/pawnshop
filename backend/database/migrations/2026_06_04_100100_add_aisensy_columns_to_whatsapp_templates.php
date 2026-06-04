<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whatsapp_templates', function (Blueprint $table) {
            $table->string('aisensy_campaign')->nullable()->after('content');
            $table->json('aisensy_params')->nullable()->after('aisensy_campaign');
        });
    }

    public function down(): void
    {
        Schema::table('whatsapp_templates', function (Blueprint $table) {
            $table->dropColumn(['aisensy_campaign', 'aisensy_params']);
        });
    }
};
