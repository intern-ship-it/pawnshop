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
        'phone',
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

    public function activePledges(): HasMany
    {
        return $this->hasMany(Pledge::class)->where('status', 'active');
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

    public function updateStats(): void
    {
        $this->update([
            'total_pledges' => $this->pledges()->count(),
            'active_pledges' => $this->pledges()->where('status', 'active')->count(),
            'total_loan_amount' => $this->pledges()->sum('loan_amount'),
        ]);
    }

    public static function generateCustomerNo(int $branchId): string
    {
        $branch = Branch::find($branchId);
        $lastCustomer = static::where('branch_id', $branchId)
            ->orderBy('id', 'desc')
            ->first();

        $number = $lastCustomer ? (int)substr($lastCustomer->customer_no, -4) + 1 : 1;
        return sprintf('CUST-%s-%04d', $branch->code, $number);
    }
}
