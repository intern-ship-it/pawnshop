<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Advisory hold layer for slot selection. A row means a user has
     * temporarily claimed a slot while filling out the pledge form.
     * Holds are short-lived (1 min TTL, renewed while the form is open)
     * and expire lazily (a row whose expires_at is in the past is simply
     * treated as gone). This table never touches the real slot-assignment
     * logic — it only prevents two pledges aiming at the same slot at once.
     */
    public function up(): void
    {
        Schema::create('slot_holds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('slot_id')->constrained('slots')->cascadeOnDelete();
            $table->foreignId('held_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('expires_at')->index();
            $table->timestamps();

            // At most one hold row per slot. This is the atomic guarantee:
            // two simultaneous claims race on this unique index and exactly
            // one wins; the other gets a duplicate-key error and is rejected.
            $table->unique('slot_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('slot_holds');
    }
};
