<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // WhatsApp Config
        Schema::create('whatsapp_config', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained();
            $table->enum('provider', ['ultramsg', 'twilio', 'wati'])->default('ultramsg');
            $table->string('instance_id', 100)->nullable();
            $table->string('api_token')->nullable();
            $table->string('phone_number', 20)->nullable();
            $table->boolean('is_enabled')->default(false);
            $table->timestamp('last_connected_at')->nullable();
            $table->timestamps();
        });

        // WhatsApp Templates
        Schema::create('whatsapp_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained();
            $table->string('template_key', 50);
            $table->string('name', 100);
            $table->text('content');
            $table->json('variables')->nullable();
            $table->boolean('is_enabled')->default(true);
            $table->timestamps();

            $table->unique(['branch_id', 'template_key']);
        });

        // WhatsApp Logs
        Schema::create('whatsapp_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('template_id')->nullable()->constrained('whatsapp_templates');

            $table->string('recipient_phone', 20);
            $table->string('recipient_name', 100)->nullable();

            $table->text('message_content');
            $table->string('attachment_url')->nullable();

            $table->enum('status', ['pending', 'sent', 'delivered', 'failed'])->default('pending');
            $table->text('error_message')->nullable();

            $table->string('related_type', 50)->nullable();
            $table->unsignedBigInteger('related_id')->nullable();

            $table->timestamp('sent_at')->nullable();
            $table->foreignId('sent_by')->nullable()->constrained('users');

            $table->timestamps();
        });

        // Day End Reports
        Schema::create('day_end_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->date('report_date');

            // Summary
            $table->decimal('opening_balance', 15, 2)->default(0);

            // Pledges
            $table->integer('new_pledges_count')->default(0);
            $table->decimal('new_pledges_amount', 15, 2)->default(0);
            $table->decimal('new_pledges_cash', 15, 2)->default(0);
            $table->decimal('new_pledges_transfer', 15, 2)->default(0);

            // Renewals
            $table->integer('renewals_count')->default(0);
            $table->decimal('renewals_amount', 15, 2)->default(0);
            $table->decimal('renewals_cash', 15, 2)->default(0);
            $table->decimal('renewals_transfer', 15, 2)->default(0);

            // Redemptions
            $table->integer('redemptions_count')->default(0);
            $table->decimal('redemptions_amount', 15, 2)->default(0);
            $table->decimal('redemptions_cash', 15, 2)->default(0);
            $table->decimal('redemptions_transfer', 15, 2)->default(0);

            // Items Movement
            $table->integer('items_in_count')->default(0);
            $table->integer('items_out_count')->default(0);

            // Verification
            $table->boolean('all_items_verified')->default(false);
            $table->boolean('all_amounts_verified')->default(false);

            // Status
            $table->enum('status', ['open', 'pending_verification', 'closed'])->default('open');

            $table->foreignId('closed_by')->nullable()->constrained('users');
            $table->timestamp('closed_at')->nullable();

            $table->text('notes')->nullable();

            // WhatsApp & Print
            $table->boolean('whatsapp_sent')->default(false);
            $table->timestamp('whatsapp_sent_at')->nullable();
            $table->boolean('report_printed')->default(false);

            $table->timestamps();

            $table->unique(['branch_id', 'report_date']);
        });

        // Day End Verifications
        Schema::create('day_end_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('day_end_id')->constrained('day_end_reports')->onDelete('cascade');

            $table->enum('verification_type', ['item_in', 'item_out', 'amount']);
            $table->string('related_type', 50)->nullable();
            $table->unsignedBigInteger('related_id')->nullable();

            $table->text('item_description')->nullable();
            $table->decimal('expected_amount', 15, 2)->nullable();

            $table->boolean('is_verified')->default(false);
            $table->foreignId('verified_by')->nullable()->constrained('users');
            $table->timestamp('verified_at')->nullable();

            $table->text('notes')->nullable();
        });

        // Audit Logs
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained();
            $table->foreignId('user_id')->nullable()->constrained();

            $table->string('action', 50);
            $table->string('module', 50);

            $table->string('record_type', 50)->nullable();
            $table->unsignedBigInteger('record_id')->nullable();

            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();

            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();

            $table->timestamp('created_at')->useCurrent();

            $table->index('user_id');
            $table->index('module');
            $table->index('created_at');
        });

        // Passkey Logs
        Schema::create('passkey_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->foreignId('user_id')->constrained();

            $table->string('action', 100);
            $table->string('module', 50);
            $table->unsignedBigInteger('record_id')->nullable();

            $table->foreignId('passkey_user_id')->constrained('users');

            $table->json('details')->nullable();

            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        // Personal Access Tokens (Sanctum)
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        // Cache Table
        Schema::create('cache', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->mediumText('value');
            $table->integer('expiration');
        });

        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('owner');
            $table->integer('expiration');
        });

        // Jobs Table
        Schema::create('jobs', function (Blueprint $table) {
            $table->id();
            $table->string('queue')->index();
            $table->longText('payload');
            $table->unsignedTinyInteger('attempts');
            $table->unsignedInteger('reserved_at')->nullable();
            $table->unsignedInteger('available_at');
            $table->unsignedInteger('created_at');
        });

        Schema::create('job_batches', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->integer('total_jobs');
            $table->integer('pending_jobs');
            $table->integer('failed_jobs');
            $table->longText('failed_job_ids');
            $table->mediumText('options')->nullable();
            $table->integer('cancelled_at')->nullable();
            $table->integer('created_at');
            $table->integer('finished_at')->nullable();
        });

        Schema::create('failed_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('uuid')->unique();
            $table->text('connection');
            $table->text('queue');
            $table->longText('payload');
            $table->longText('exception');
            $table->timestamp('failed_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('failed_jobs');
        Schema::dropIfExists('job_batches');
        Schema::dropIfExists('jobs');
        Schema::dropIfExists('cache_locks');
        Schema::dropIfExists('cache');
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('passkey_logs');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('day_end_verifications');
        Schema::dropIfExists('day_end_reports');
        Schema::dropIfExists('whatsapp_logs');
        Schema::dropIfExists('whatsapp_templates');
        Schema::dropIfExists('whatsapp_config');
    }
};
