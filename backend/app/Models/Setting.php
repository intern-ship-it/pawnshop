<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Setting extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'category',
        'key_name',
        'value',
        'value_type',
        'description',
        'updated_by',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function getTypedValueAttribute()
    {
        return match ($this->value_type) {
            'number' => (float) $this->value,
            'boolean' => filter_var($this->value, FILTER_VALIDATE_BOOLEAN),
            'json' => json_decode($this->value, true),
            default => $this->value,
        };
    }

    public static function get(string $key, ?int $branchId = null, $default = null)
    {
        $setting = static::where('key_name', $key)
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->first();

        return $setting ? $setting->typed_value : $default;
    }

    public static function set(string $key, $value, string $category = 'general', ?int $branchId = null): void
    {
        $valueType = match (true) {
            is_bool($value) => 'boolean',
            is_numeric($value) => 'number',
            is_array($value) => 'json',
            default => 'string',
        };

        static::updateOrCreate(
            ['key_name' => $key, 'branch_id' => $branchId],
            [
                'category' => $category,
                'value' => is_array($value) ? json_encode($value) : (string) $value,
                'value_type' => $valueType,
            ]
        );
    }
}
