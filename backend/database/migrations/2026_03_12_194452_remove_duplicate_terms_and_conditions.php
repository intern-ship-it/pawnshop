<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $duplicates = \App\Models\TermsCondition::select('title', 'activity_type')
            ->groupBy('title', 'activity_type')
            ->havingRaw('COUNT(id) > 1')
            ->get();

        foreach ($duplicates as $duplicate) {
            $recordToKeep = \App\Models\TermsCondition::where('title', $duplicate->title)
                ->where('activity_type', $duplicate->activity_type)
                ->orderBy('id', 'desc')
                ->first();

            \App\Models\TermsCondition::where('title', $duplicate->title)
                ->where('activity_type', $duplicate->activity_type)
                ->where('id', '!=', $recordToKeep->id)
                ->delete();
        }

        // Ensuring the seeder runs in live to apply the 'jumlah' update
        \Illuminate\Support\Facades\Artisan::call('db:seed', ['--class' => 'TermsConditionSeeder']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }
};
