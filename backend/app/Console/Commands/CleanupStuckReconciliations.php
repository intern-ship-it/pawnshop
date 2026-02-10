<?php

namespace App\Console\Commands;

use App\Models\Reconciliation;
use Illuminate\Console\Command;

class CleanupStuckReconciliations extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'reconciliation:cleanup
                          {--force : Force cleanup without confirmation}
                          {--branch= : Cleanup for specific branch ID only}';

    /**
     * The console command description.
     */
    protected $description = 'Cleanup stuck in-progress reconciliations';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $query = Reconciliation::where('status', 'in_progress');

        // Filter by branch if specified
        if ($branchId = $this->option('branch')) {
            $query->where('branch_id', $branchId);
        }

        $stuckReconciliations = $query->get();

        if ($stuckReconciliations->isEmpty()) {
            $this->info('✓ No stuck reconciliations found.'); // Added checkmark for consistency
            return 0;
        }

        $this->warn("Found {$stuckReconciliations->count()} stuck reconciliation(s):");
        
        foreach ($stuckReconciliations as $rec) {
            $this->line("  - ID: {$rec->id} | {$rec->reconciliation_no} | Branch: {$rec->branch_id} | Started: {$rec->started_at}");
        }

        // Ask for confirmation unless --force is used
        if (!$this->option('force')) {
            if (!$this->confirm('Do you want to cancel these reconciliations?')) {
                $this->info('Cancelled. No changes made.');
                return 0;
            }
        }

        // Cancel the stuck reconciliations
        $cancelled = 0;
        foreach ($stuckReconciliations as $rec) {
            $rec->update([
                'status' => 'cancelled',
                'notes' => ($rec->notes ? $rec->notes . ' | ' : '') . 'Auto-cancelled due to stuck status at ' . now(),
            ]);
            $cancelled++;
            $this->info("✓ Cancelled: {$rec->reconciliation_no}");
        }

        $this->info("✓ Successfully cancelled {$cancelled} reconciliation(s).");
        
        return 0;
    }
}
