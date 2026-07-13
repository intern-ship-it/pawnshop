<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('webauthn_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Base64url credential id from the authenticator. Unique per credential.
            // 512 chars keeps the index under MySQL's key-length limit.
            $table->string('credential_id', 512)->unique();

            // The serialized PublicKeyCredentialSource (JSON). This is a PUBLIC key —
            // it is not a secret, and no biometric is stored anywhere, ever.
            $table->text('public_key');

            // Advanced on each use; a non-increasing counter signals a cloned authenticator.
            $table->unsignedBigInteger('sign_count')->default(0);

            // The RP-ID this credential was registered against. Credentials are
            // origin-bound, so a staging credential is invalid on production.
            $table->string('rp_id');

            $table->string('device_label')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'rp_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webauthn_credentials');
    }
};
