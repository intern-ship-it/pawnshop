<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StoneDeduction extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'deduction_type',
        'value',
        'description',
        'is_default',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'value' => 'decimal:3',
        'is_default' => 'boolean',
        'is_active' => 'boolean',
    ];
}
