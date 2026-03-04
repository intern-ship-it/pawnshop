<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Slot;
use App\Models\PledgeItem;

// Find all slots marked as occupied
$occupiedSlots = Slot::where('is_occupied', true)->get();
echo "Slots marked occupied: " . $occupiedSlots->count() . "\n";

// Check which occupied slots actually have an active pledge item
foreach ($occupiedSlots as $slot) {
    $activeItem = PledgeItem::where('slot_id', $slot->id)
        ->whereHas('pledge', function($q) {
            $q->where('status', 'active');
        })
        ->first();
    
    if (!$activeItem) {
        echo "  Slot {$slot->id} (#{$slot->slot_number}) - NO active item -> Freeing!\n";
        $slot->is_occupied = false;
        $slot->save();
    } else {
        echo "  Slot {$slot->id} (#{$slot->slot_number}) - has active pledge item {$activeItem->id}\n";
    }
}

// Final count
$stillOccupied = Slot::where('is_occupied', true)->count();
$total = Slot::count();
echo "\nAfter cleanup: {$stillOccupied}/{$total} occupied, " . ($total - $stillOccupied) . " available\n";
