<?php

use App\Models\Box;
use App\Models\Slot;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Box::with('slots')->chunk(50, function ($boxes) {
            foreach ($boxes as $box) {
                $per = $box->has_subslots ? max(1, (int) $box->subslots_per_slot) : 1;
                foreach ($box->slots as $slot) {
                    if ($box->has_subslots) {
                        $group = (int) ceil($slot->slot_number / $per);
                        $sub   = (($slot->slot_number - 1) % $per) + 1;
                    } else {
                        $group = $slot->slot_number;
                        $sub   = 1;
                    }
                    $slot->forceFill([
                        'slot_group' => $group,
                        'subslot_number' => $sub,
                    ])->save();
                }
            }
        });
    }

    public function down(): void
    {
        Slot::query()->update(['slot_group' => null, 'subslot_number' => null]);
    }
};
