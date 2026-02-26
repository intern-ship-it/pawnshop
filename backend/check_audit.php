<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Console\Kernel');
$kernel->bootstrap();

// Check redemption logs
$logs = \App\Models\AuditLog::where('module', 'redemption')
    ->orderBy('created_at', 'desc')
    ->take(3)
    ->get(['id', 'action', 'module', 'description', 'created_at']);

echo "=== Redemption module logs ===\n";
foreach ($logs as $log) {
    echo "ID: {$log->id}, Action: {$log->action}, Module: {$log->module}, Desc: {$log->description}, Date: {$log->created_at}\n";
}

// Check distinct actions
$actions = \App\Models\AuditLog::distinct()->pluck('action');
echo "\n=== Distinct actions in DB ===\n";
echo $actions->join(', ') . "\n";

// Check distinct modules
$modules = \App\Models\AuditLog::distinct()->pluck('module');
echo "\n=== Distinct modules in DB ===\n";
echo $modules->join(', ') . "\n";

// Check users who have logs
$userIds = \App\Models\AuditLog::distinct()->pluck('user_id')->filter();
$users = \App\Models\User::whereIn('id', $userIds)->select('id', 'name')->get();
echo "\n=== Users with audit logs ===\n";
foreach ($users as $user) {
    echo "ID: {$user->id}, Name: {$user->name}\n";
}
