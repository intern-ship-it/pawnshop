<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppTemplate extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_templates';

    protected $fillable = [
        'branch_id',
        'template_key',
        'name',
        'content',
        'variables',
        'is_enabled',
    ];

    protected $casts = [
        'variables' => 'array',
        'is_enabled' => 'boolean',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function render(array $data): string
    {
        $content = $this->content;
        foreach ($data as $key => $value) {
            $content = str_replace('{' . $key . '}', $value, $content);
        }
        return $content;
    }
}
