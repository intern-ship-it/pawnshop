<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TermsCondition extends Model
{
    use HasFactory;

    protected $table = 'terms_conditions';

    protected $fillable = [
        'branch_id',
        'activity_type',
        'title',
        'content_ms',
        'content_en',
        'print_with_receipt',
        'require_consent',
        'show_on_screen',
        'attach_to_whatsapp',
        'is_active',
        'version',
    ];

    protected $casts = [
        'print_with_receipt' => 'boolean',
        'require_consent' => 'boolean',
        'show_on_screen' => 'boolean',
        'attach_to_whatsapp' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public static function getForActivity(string $activityType, ?int $branchId = null): ?self
    {
        return static::where('activity_type', $activityType)
            ->where('is_active', true)
            ->where(function ($q) use ($branchId) {
                $q->where('branch_id', $branchId)->orWhereNull('branch_id');
            })
            ->orderBy('branch_id', 'desc') // Branch-specific takes priority
            ->first();
    }
}
