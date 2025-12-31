<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Purity extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'karat',
        'percentage',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'percentage' => 'decimal:2',
        'is_active' => 'boolean',
    ];
}
