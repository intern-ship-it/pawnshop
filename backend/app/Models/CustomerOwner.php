<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerOwner extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'name',
        'ic_number',
        'gender',
        'age',
        'nationality',
        'address',
        'relationship',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
