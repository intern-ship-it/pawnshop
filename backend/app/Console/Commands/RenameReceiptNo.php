<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\Pledge;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RenameReceiptNo extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'pledge:rename-receipt
                          {old : Current receipt_no to rename (e.g. RCP-HQ-2026-0291)}
                          {new : New receipt_no to assign (e.g. RCP-HQ-2026-0253)}
                          {--force : Skip the confirmation prompt}';

    /**
     * The console command description.
     */
    protected $description = 'Rename a single pledge receipt_no, guarding against the UNIQUE constraint';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $old = trim($this->argument('old'));
        $new = trim($this->argument('new'));

        if ($old === $new) {
            $this->error('Old and new receipt numbers are identical. Nothing to do.');
            return 1;
        }

        // 1) The pledge to rename must exist.
        $pledge = Pledge::where('receipt_no', $old)->first();
        if (!$pledge) {
            $this->error("No pledge found with receipt_no = {$old}. Aborting.");
            return 1;
        }

        // 2) The target number must be free (receipt_no is UNIQUE).
        $clash = Pledge::where('receipt_no', $new)->first();
        if ($clash) {
            $this->error("receipt_no {$new} is already used by pledge id {$clash->id} ({$clash->pledge_no}). Aborting.");
            return 1;
        }

        $this->warn('About to rename receipt number:');
        $this->table(
            ['id', 'branch_id', 'pledge_no', 'receipt_no (old)', 'receipt_no (new)', 'status'],
            [[$pledge->id, $pledge->branch_id, $pledge->pledge_no, $old, $new, $pledge->status]]
        );

        if (!$this->option('force') && !$this->confirm('Proceed with the rename?')) {
            $this->info('Cancelled. No changes made.');
            return 0;
        }

        // 3) Apply transactionally and record an audit trail.
        DB::transaction(function () use ($pledge, $old, $new) {
            $pledge->update(['receipt_no' => $new]);

            AuditLog::create([
                'branch_id'   => $pledge->branch_id,
                'user_id'     => null,
                'action'      => 'update',
                'module'      => 'pledge',
                'description' => "Renamed receipt_no {$old} -> {$new} on pledge {$pledge->pledge_no} via artisan",
                'record_type' => 'Pledge',
                'record_id'   => $pledge->id,
                'old_values'  => ['receipt_no' => $old],
                'new_values'  => ['receipt_no' => $new],
                'severity'    => 'warning',
            ]);
        });

        $this->info("✓ Renamed receipt_no {$old} -> {$new} on pledge {$pledge->pledge_no} (id {$pledge->id}).");

        return 0;
    }
}
