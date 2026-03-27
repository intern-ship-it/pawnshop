<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('temp_card_data', function (Blueprint $table) {
            $table->id();
            $table->longText('data')->nullable();
            $table->timestamps();
        });

        // Uncomment the section below if you need to insert default/test data during migration
        /*
        DB::table('temp_card_data')->insert([
            'data' => '{"Addr1":"NO 6 (LOT 10043)","Addr2":"JALAN AWAN BESAR","Addr3":"TAMAN YARL","BirthPlace":"W. PERSEKUTUAN(KL)","City":"KUALA LUMPUR","DOB":"04\/03\/1951","ERR_CODE":"OK","Gender":"L","ICNo":"510304145317","Left_FP_Verify_Status":"X","Name":"JOE BIDEN","Nationality":"WARGANEGARA","OldICNo":"6456783","Photo":"","Postcode":"58200","Race":"CINA","RegDate":"20191101","Religion":"BUDDHA","Right_FP_Verify_Status":"X","State":"W. PERSEKUTUAN(KL)","Version":"03"}',
            'created_at' => now(),
            'updated_at' => '2026-03-27 06:45:26',
        ]);
        */
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('temp_card_data');
    }
};
