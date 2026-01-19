<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HardwareDevice extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'name',
        'type',
        'brand',
        'model',
        'connection',
        'paper_size',
        'description',
        'ip_address',
        'port',
        'settings',
        'is_default',
        'is_active',
        'status',
        'last_tested_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'settings' => 'array',
        'is_default' => 'boolean',
        'is_active' => 'boolean',
        'last_tested_at' => 'datetime',
    ];

    // Device type constants
    public const TYPE_DOT_MATRIX_PRINTER = 'dot_matrix_printer';
    public const TYPE_THERMAL_PRINTER = 'thermal_printer';
    public const TYPE_BARCODE_SCANNER = 'barcode_scanner';
    public const TYPE_WEIGHING_SCALE = 'weighing_scale';

    // Connection type constants
    public const CONN_USB = 'usb';
    public const CONN_ETHERNET = 'ethernet';
    public const CONN_WIRELESS = 'wireless';
    public const CONN_BLUETOOTH = 'bluetooth';
    public const CONN_SERIAL = 'serial';

    // Status constants
    public const STATUS_CONNECTED = 'connected';
    public const STATUS_DISCONNECTED = 'disconnected';
    public const STATUS_ERROR = 'error';
    public const STATUS_UNKNOWN = 'unknown';

    /**
     * Get available device types
     */
    public static function getTypes(): array
    {
        return [
            self::TYPE_DOT_MATRIX_PRINTER => 'Dot Matrix Printer',
            self::TYPE_THERMAL_PRINTER => 'Thermal Printer',
            self::TYPE_BARCODE_SCANNER => 'Barcode Scanner',
            self::TYPE_WEIGHING_SCALE => 'Weighing Scale',
        ];
    }

    /**
     * Get available connection types
     */
    public static function getConnectionTypes(): array
    {
        return [
            self::CONN_USB => 'USB',
            self::CONN_ETHERNET => 'Ethernet',
            self::CONN_WIRELESS => 'Wireless',
            self::CONN_BLUETOOTH => 'Bluetooth',
            self::CONN_SERIAL => 'Serial',
        ];
    }

    /**
     * Branch relationship
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * Created by user relationship
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Updated by user relationship
     */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Scope: Active devices
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: By type
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope: Default devices
     */
    public function scopeDefault($query)
    {
        return $query->where('is_default', true);
    }

    /**
     * Scope: By branch
     */
    public function scopeForBranch($query, int $branchId)
    {
        return $query->where('branch_id', $branchId);
    }

    /**
     * Get default device for a type in a branch
     */
    public static function getDefaultForType(int $branchId, string $type): ?self
    {
        return static::forBranch($branchId)
            ->ofType($type)
            ->active()
            ->default()
            ->first();
    }

    /**
     * Set this device as default (unset others of same type)
     */
    public function setAsDefault(): bool
    {
        // Unset other defaults of same type in branch
        static::where('branch_id', $this->branch_id)
            ->where('type', $this->type)
            ->where('id', '!=', $this->id)
            ->update(['is_default' => false]);

        return $this->update(['is_default' => true]);
    }

    /**
     * Update device status
     */
    public function updateStatus(string $status): bool
    {
        return $this->update([
            'status' => $status,
            'last_tested_at' => now(),
        ]);
    }

    /**
     * Check if device is a printer
     */
    public function isPrinter(): bool
    {
        return in_array($this->type, [
            self::TYPE_DOT_MATRIX_PRINTER,
            self::TYPE_THERMAL_PRINTER,
        ]);
    }

    /**
     * Get type label
     */
    public function getTypeLabelAttribute(): string
    {
        return self::getTypes()[$this->type] ?? $this->type;
    }

    /**
     * Get connection label
     */
    public function getConnectionLabelAttribute(): string
    {
        return self::getConnectionTypes()[$this->connection] ?? $this->connection;
    }
}