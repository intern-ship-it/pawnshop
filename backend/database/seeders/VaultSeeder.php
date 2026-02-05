<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Vault;
use App\Models\Box;
use App\Models\Slot;
use Illuminate\Database\Seeder;

class VaultSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * Creates vaults with boxes and slots for each branch.
     */
    public function run(): void
    {
        $branches = Branch::all();

        foreach ($branches as $branch) {
            // Create vaults for each branch
            $vaults = $this->createVaultsForBranch($branch);

            foreach ($vaults as $vault) {
                $this->createBoxesForVault($vault);
            }
        }

        $this->command->info('Vaults, Boxes, and Slots seeded successfully!');
    }

    /**
     * Create vaults for a specific branch
     */
    private function createVaultsForBranch(Branch $branch): array
    {
        $isHQ = $branch->is_headquarters ?? $branch->code === 'HQ';
        
        $vaultConfigs = [
            [
                'code' => $branch->code . '-V1',
                'name' => 'Main Vault',
                'description' => 'Primary vault for high-value gold items',
                'total_boxes' => $isHQ ? 10 : 6,
                'is_active' => true,
            ],
            [
                'code' => $branch->code . '-V2',
                'name' => 'Secondary Vault',
                'description' => 'Secondary vault for general items',
                'total_boxes' => $isHQ ? 8 : 4,
                'is_active' => true,
            ],
        ];

        // HQ gets an additional vault
        if ($isHQ) {
            $vaultConfigs[] = [
                'code' => $branch->code . '-V3',
                'name' => 'High Security Vault',
                'description' => 'Premium vault for VIP customers and high-value items',
                'total_boxes' => 5,
                'is_active' => true,
            ];
        }

        $vaults = [];
        foreach ($vaultConfigs as $config) {
            $vaults[] = Vault::create([
                'branch_id' => $branch->id,
                'code' => $config['code'],
                'name' => $config['name'],
                'description' => $config['description'],
                'total_boxes' => $config['total_boxes'],
                'is_active' => $config['is_active'],
            ]);
        }

        return $vaults;
    }

    /**
     * Create boxes with slots for a vault
     */
    private function createBoxesForVault(Vault $vault): void
    {
        $totalBoxes = $vault->total_boxes;
        $slotsPerBox = 20; // Each box can hold 20 items

        for ($boxNum = 1; $boxNum <= $totalBoxes; $boxNum++) {
            $box = Box::create([
                'vault_id' => $vault->id,
                'box_number' => $boxNum,
                'name' => "Box {$boxNum}",
                'total_slots' => $slotsPerBox,
                'occupied_slots' => 0,
                'is_active' => true,
            ]);

            // Create slots for each box
            $this->createSlotsForBox($box);
        }
    }

    /**
     * Create slots for a box
     */
    private function createSlotsForBox(Box $box): void
    {
        for ($slotNum = 1; $slotNum <= $box->total_slots; $slotNum++) {
            Slot::create([
                'box_id' => $box->id,
                'slot_number' => $slotNum,
                'is_occupied' => false,
                'current_item_id' => null,
                'occupied_at' => null,
            ]);
        }
    }
}
