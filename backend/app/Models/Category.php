<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name_en',
        'name_ms',
        'description',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function getNameAttribute(): string
    {
        return app()->getLocale() === 'ms' ? $this->name_ms : $this->name_en;
    }
}
