<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppConfig extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_config';

    protected $fillable = [
        'branch_id',
        'provider',
        'instance_id',
        'api_token',
        'phone_number',
        'is_enabled',
        'last_connected_at',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
        'last_connected_at' => 'datetime',
    ];

    protected $hidden = [
        'api_token',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
