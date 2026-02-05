<?php

namespace App\Console\Commands;

use App\Models\Customer;
use Illuminate\Console\Command;

class SyncCustomerStats extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'customers:sync-stats {--customer= : Specific customer ID to sync}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sync customer statistics (total_pledges, active_pledges, total_loan_amount)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $customerId = $this->option('customer');

        if ($customerId) {
            // Sync specific customer
            $customer = Customer::find($customerId);
            if (!$customer) {
                $this->error("Customer {$customerId} not found.");
                return 1;
            }

            $customer->updateStats();
            $this->info("Customer {$customer->customer_no} ({$customer->name}) stats updated:");
            $this->table(
                ['Field', 'Value'],
                [
                    ['Total Pledges', $customer->total_pledges],
                    ['Active Pledges', $customer->active_pledges],
                    ['Total Loan Amount', 'RM ' . number_format($customer->total_loan_amount, 2)],
                    ['Is Active', $customer->is_active ? 'Yes' : 'No'],
                ]
            );
            return 0;
        }

        // Sync all customers
        $this->info('Syncing all customer statistics...');
        $customers = Customer::all();
        $bar = $this->output->createProgressBar($customers->count());
        $bar->start();

        $updated = 0;
        foreach ($customers as $customer) {
            $customer->updateStats();
            $updated++;
            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("✓ Successfully synced {$updated} customers.");

        // Summary
        $activeCustomers = Customer::whereHas('pledges', function ($q) {
            $q->whereIn('status', ['active', 'overdue']);
        })->count();

        $this->table(
            ['Metric', 'Count'],
            [
                ['Total Customers', $customers->count()],
                ['Active Customers', $activeCustomers],
                ['Inactive Customers', $customers->count() - $activeCustomers],
            ]
        );

        return 0;
    }
}