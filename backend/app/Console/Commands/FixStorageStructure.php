<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Vault;
use App\Models\Box;
use App\Models\Slot;
use App\Models\PledgeItem;
use App\Models\ItemLocationHistory;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class FixStorageStructure extends Command
{
    protected $signature = 'storage:fix-structure';
    protected $description = 'Clean up old storage data and set up SAFE A/B structure';

    public function handle()
    {
        $this->info('Starting storage cleanup and setup...');

        DB::beginTransaction();

        try {
            // 1. Unassign all items from locations
            $this->info('Unassigning pledge items from existing locations...');
            PledgeItem::query()->update([
                'vault_id' => null,
                'box_id' => null,
                'slot_id' => null,
                'location_assigned_at' => null,
                'location_assigned_by' => null,
            ]);

            // 2. Clear location history slot references (to avoid FK errors)
            $this->info('Clearing slot references in location history...');
            ItemLocationHistory::query()->update([
                'from_slot_id' => null,
                'to_slot_id' => null,
            ]);

            // 3. Delete existing storage structure
            $this->info('Deleting old slots, drawers, and safes...');
            Slot::query()->delete();
            Box::query()->delete();
            Vault::query()->delete();

            // 4. Create proper structure
            $user = User::first();
            $branchId = $user ? $user->branch_id : 1;

            $safes = [
                ['name' => 'SAFE A', 'code' => 'SAFE-A'],
                ['name' => 'SAFE B', 'code' => 'SAFE-B'],
            ];

            $drawers = ['A', 'B', 'C', 'D'];
            $slotsPerDrawer = 9;

            foreach ($safes as $safeData) {
                $this->info("Creating {$safeData['name']}...");
                $vault = Vault::create([
                    'branch_id' => $branchId,
                    'code' => $safeData['code'],
                    'name' => $safeData['name'],
                    'total_boxes' => count($drawers),
                    'is_active' => true,
                ]);

                foreach ($drawers as $drawerLetter) {
                    $this->info("  Creating DRAWER {$drawerLetter}...");
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

            DB::commit();
            $this->info('Storage system has been successfully reset and initialized!');

        } catch (\Exception $e) {
            DB::rollBack();
            $this->error('Failed to reset storage: ' . $e->getMessage());
            return 1;
        }

        return 0;
    }
}
