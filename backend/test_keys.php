<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$box = clone \App\Models\Box::has('slots')->first();
$slots = $box->slots()->with('currentItem')->get();
echo implode(",", array_keys($slots[0]->toArray()));
