<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Vault;
use App\Models\Box;
use App\Models\Slot;
use App\Models\PledgeItem;
use App\Models\ItemLocationHistory;
use Illuminate\Database\Seeder;

class VaultSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * Cleans up old storage data and creates LOCKER A/B structure
     * with 4 drawers (A-D) × 9 slots each.
     */
    public function run(): void
    {
        // 1. Unassign all items from existing locations
        $this->command->info('Unassigning pledge items from existing locations...');
        PledgeItem::query()->update([
            'vault_id' => null,
            'box_id' => null,
            'slot_id' => null,
            'location_assigned_at' => null,
            'location_assigned_by' => null,
        ]);

        // 2. Clear location history slot references
        $this->command->info('Clearing slot references in location history...');
        if (class_exists(ItemLocationHistory::class)) {
            ItemLocationHistory::query()->update([
                'from_slot_id' => null,
                'to_slot_id' => null,
            ]);
        }

        // 3. Delete existing storage structure
        $this->command->info('Deleting old slots, drawers, and lockers...');
        Slot::query()->delete();
        Box::query()->delete();
        Vault::query()->delete();

        // 4. Create proper LOCKER structure
        $branch = Branch::first();
        $branchId = $branch ? $branch->id : 1;

        $lockers = [
            ['name' => 'LOCKER A', 'code' => 'LOCKER-A'],
            ['name' => 'LOCKER B', 'code' => 'LOCKER-B'],
        ];

        $drawers = ['A', 'B', 'C', 'D'];
        $slotsPerDrawer = 9;

        foreach ($lockers as $lockerData) {
            $this->command->info("Creating {$lockerData['name']}...");
            $vault = Vault::create([
                'branch_id' => $branchId,
                'code' => $lockerData['code'],
                'name' => $lockerData['name'],
                'total_boxes' => count($drawers),
                'is_active' => true,
            ]);

            foreach ($drawers as $drawerLetter) {
                $this->command->info("  Creating DRAWER {$drawerLetter}...");
                $box = Box::create([
                    'vault_id' => $vault->id,
                    'box_number' => $drawerLetter,
                    'name' => "DRAWER {$drawerLetter}",
                    'total_slots' => $slotsPerDrawer,
                    'is_active' => true,
                ]);

                for ($s = 1; $s <= $slotsPerDrawer; $s++) {
                    Slot::create([
                        'box_id' => $box->id,
                        'slot_number' => $s,
                        'is_occupied' => false,
                        'is_active' => true,
                    ]);
                }
            }
        }

        $this->command->info('Lockers, Drawers, and Slots seeded successfully!');
    }
}
