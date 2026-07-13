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

    /**
     * The gold prices currently on offer, resolved the same way the New Pledge
     * screen resolves them: when the branch's price source is "manual", the
     * per-purity price from settings wins, falling back to the 999 price scaled
     * by the purity's gold content. Otherwise the latest gold_prices row applies.
     *
     * Returns ['prices' => ['916' => 600.0, ...], 'source' => 'manual'|'api'],
     * or null when no manual prices are configured and the caller should fall
     * back to the gold_prices table.
     *
     * Kept here rather than in the pledge flow because Settings writes to this
     * table while gold_prices is only written by the API fetch — the two are
     * separate sources of truth and callers must not read the wrong one.
     */
    public static function goldPriceSettings(?int $branchId = null): ?array
    {
        $rows = static::where('category', 'gold_price')
            ->when($branchId, fn($q) => $q->where('branch_id', $branchId))
            ->pluck('value', 'key_name');

        $source = $rows['source'] ?? null;
        if ($source !== 'manual') {
            return null;
        }

        $perPurity = json_decode($rows['manual_prices'] ?? '{}', true) ?: [];
        $base999 = (float) ($rows['manual_price'] ?? 0);

        $prices = [];
        foreach (\App\Models\Purity::all() as $purity) {
            $explicit = (float) ($perPurity[$purity->code] ?? 0);
            $prices[$purity->code] = $explicit > 0
                ? $explicit
                : round($base999 * ((float) $purity->percentage / 100), 2);
        }

        return ['prices' => $prices, 'source' => 'manual'];
    }
}
