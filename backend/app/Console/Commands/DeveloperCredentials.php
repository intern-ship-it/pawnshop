<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Mints credentials for the hidden developer account at deploy time.
 *
 * The migration deliberately seeds that account dormant (no password, no passkey,
 * inactive) so that no usable credential is ever committed to the repository.
 * This command is the only way to make it usable, and the credentials it prints
 * exist only in the operator's terminal.
 */
class DeveloperCredentials extends Command
{
    protected $signature = 'developer:credentials
                            {--password= : Set an explicit password instead of a generated one}
                            {--deactivate : Disable the developer account instead of issuing credentials}';

    protected $description = 'Issue (or revoke) credentials for the hidden developer account';

    public function handle(): int
    {
        $user = User::with('role')->where('username', 'developer')->first();

        if (!$user) {
            $this->error('No developer account found. Run `php artisan migrate` first.');
            return self::FAILURE;
        }

        if ($this->option('deactivate')) {
            $user->update(['is_active' => false, 'password' => '', 'passkey' => null]);
            $this->info('Developer account deactivated and its credentials cleared.');
            return self::SUCCESS;
        }

        // Strong random by default. random_int() is CSPRNG-backed; rand() is not.
        $password = $this->option('password') ?: Str::random(24);
        $passkey  = (string) random_int(100000, 999999);

        $user->update([
            'password'  => Hash::make($password),
            'passkey'   => Hash::make($passkey),
            'is_active' => true,
        ]);

        $this->newLine();
        $this->warn('Shown once. Store these in your password manager now — they are not recoverable.');
        $this->newLine();
        $this->line('  URL:      /dev/missing-images');
        $this->line('  Username: developer');
        $this->line('  Password: ' . $password);
        $this->line('  Passkey:  ' . $passkey);
        $this->newLine();
        $this->warn('Revoke when finished:  php artisan developer:credentials --deactivate');
        $this->newLine();

        return self::SUCCESS;
    }
}
