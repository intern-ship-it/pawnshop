<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'customer_no',
        'name',
        'ic_number',
        'ic_type',
        'gender',
        'date_of_birth',
        'age',
        'nationality',
        'occupation',
        'phone',
        'country_code',
        'whatsapp',
        'phone_alt',
        'email',
        'address_line1',
        'address_line2',
        'city',
        'state',
        'postcode',
        'ic_front_photo',
        'ic_back_photo',
        'selfie_photo',
        'total_pledges',
        'active_pledges',
        'total_loan_amount',
        'is_blacklisted',
        'blacklist_reason',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'is_blacklisted' => 'boolean',
        'total_loan_amount' => 'decimal:2',
    ];

    /**
     * ISSUE 1 FIX: Append computed attributes to JSON/Array
     * This makes 'is_active' automatically available when serializing
     */
    protected $appends = ['is_active'];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function pledges(): HasMany
    {
        return $this->hasMany(Pledge::class);
    }

    /**
     * Get active pledges (status = 'active' only)
     */
    public function activePledges(): HasMany
    {
        return $this->hasMany(Pledge::class)->where('status', 'active');
    }

    /**
     * Get all outstanding pledges (active + overdue)
     */
    public function outstandingPledges(): HasMany
    {
        return $this->hasMany(Pledge::class)->whereIn('status', ['active', 'overdue']);
    }

    public function owners(): HasMany
    {
        return $this->hasMany(CustomerOwner::class);
    }

    public function getFullAddressAttribute(): string
    {
        $parts = array_filter([
            $this->address_line1,
            $this->address_line2,
            $this->city,
            $this->state,
            $this->postcode,
        ]);
        return implode(', ', $parts);
    }

    /**
     * ISSUE 1 FIX: Computed attribute for customer active status
     * 
     * Customer is "Active" if they have at least 1 outstanding pledge
     * (status = 'active' OR 'overdue')
     * 
     * Customer is "Inactive" if they have no outstanding pledges
     * 
     * @return bool
     */
    public function getIsActiveAttribute(): bool
    {
        // If blacklisted, always show as inactive
        if ($this->is_blacklisted) {
            return false;
        }

        // Check stored active_pledges count first (performance optimization)
        if ($this->active_pledges !== null && $this->active_pledges > 0) {
            return true;
        }

        // Fallback: Query database directly
        // This handles cases where active_pledges count might be stale
        return $this->pledges()
            ->whereIn('status', ['active', 'overdue'])
            ->exists();
    }

    /**
     * ISSUE 1 FIX: Update customer statistics
     * 
     * Now counts BOTH 'active' AND 'overdue' pledges as "active_pledges"
     * since both represent outstanding loans
     */
    public function updateStats(): void
    {
        // Count pledges with outstanding status (active + overdue)
        $outstandingCount = $this->pledges()
            ->whereIn('status', ['active', 'overdue'])
            ->count();

        // Calculate total loan amount for outstanding pledges only
        $totalLoanAmount = $this->pledges()
            ->whereIn('status', ['active', 'overdue'])
            ->sum('loan_amount');

        $this->update([
            'total_pledges' => $this->pledges()->count(),
            'active_pledges' => $outstandingCount,
            'total_loan_amount' => $totalLoanAmount,
        ]);
    }

    public static function generateCustomerNo(int $branchId): string
    {
        $branch = Branch::find($branchId);
        $lastCustomer = static::where('branch_id', $branchId)
            ->orderBy('id', 'desc')
            ->first();

        $number = $lastCustomer ? (int) substr($lastCustomer->customer_no, -4) + 1 : 1;
        return sprintf('CUST-%s-%04d', $branch->code, $number);
    }
}