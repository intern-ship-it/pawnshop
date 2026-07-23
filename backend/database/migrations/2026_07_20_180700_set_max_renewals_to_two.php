<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Renewals allowed per pledge: 3 -> 2.
 *
 * The limit is read from the `max_renewals` setting, falling back to
 * config('pawnsys.pledge.max_renewals') only when that row is absent. The row
 * exists and is not editable from the Settings UI, so changing the config alone
 * would leave the database still returning 3 — this brings the stored value in
 * line so the new limit actually applies.
 */
return new class extends Migration
{
    private const KEY = 'max_renewals';

    public function up(): void
    {
        $this->setValue('2', '3');
    }

    /**
     * Restores 2 -> 3, but only if the value is still the 2 we wrote: if someone
     * has since set a different limit, leave their choice alone.
     */
    public function down(): void
    {
        $this->setValue('3', '2');
    }

    private function setValue(string $to, string $onlyIfCurrentlyIs): void
    {
        $existing = DB::table('settings')->where('key_name', self::KEY)->first();

        if (!$existing) {
            // No row: the config default already governs, so nothing to correct.
            return;
        }

        if ((string) $existing->value !== $onlyIfCurrentlyIs) {
            // Someone has set a deliberate value. Do not overwrite it.
            return;
        }

        DB::table('settings')
            ->where('key_name', self::KEY)
            ->update(['value' => $to, 'updated_at' => now()]);
    }
};
