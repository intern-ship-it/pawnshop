<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained();
            $table->string('customer_no', 20)->unique();

            // Personal Info
            $table->string('name', 100);
            $table->string('ic_number', 20);
            $table->enum('ic_type', ['mykad', 'passport', 'other'])->default('mykad');
            $table->enum('gender', ['male', 'female']);
            $table->date('date_of_birth')->nullable();
            $table->integer('age')->nullable();
            $table->string('nationality', 50)->default('Malaysian');

            // Contact
            $table->string('phone', 20);
            $table->string('phone_alt', 20)->nullable();
            $table->string('email', 100)->nullable();

            // Address
            $table->string('address_line1')->nullable();
            $table->string('address_line2')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->string('postcode', 10)->nullable();

            // Documents
            $table->string('ic_front_photo')->nullable();
            $table->string('ic_back_photo')->nullable();
            $table->string('selfie_photo')->nullable();

            // Stats
            $table->integer('total_pledges')->default(0);
            $table->integer('active_pledges')->default(0);
            $table->decimal('total_loan_amount', 15, 2)->default(0);

            // Status
            $table->boolean('is_blacklisted')->default(false);
            $table->text('blacklist_reason')->nullable();
            $table->text('notes')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->index('ic_number');
            $table->index('phone');
            $table->index('name');
        });

        // Customer Owners (if pledger is not owner)
        Schema::create('customer_owners', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->onDelete('cascade');
            $table->string('name', 100);
            $table->string('ic_number', 20);
            $table->enum('gender', ['male', 'female'])->nullable();
            $table->integer('age')->nullable();
            $table->string('nationality', 50)->nullable();
            $table->text('address')->nullable();
            $table->string('relationship', 50)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_owners');
        Schema::dropIfExists('customers');
    }
};
