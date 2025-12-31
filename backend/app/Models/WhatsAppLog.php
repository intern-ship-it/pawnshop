<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppLog extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_logs';

    protected $fillable = [
        'branch_id',
        'template_id',
        'recipient_phone',
        'recipient_name',
        'message_content',
        'attachment_url',
        'status',
        'error_message',
        'related_type',
        'related_id',
        'sent_at',
        'sent_by',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(WhatsAppTemplate::class, 'template_id');
    }

    public function sentBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }
}
