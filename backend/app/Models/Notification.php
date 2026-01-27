<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class Notification extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'branch_id',
        'type',
        'title',
        'message',
        'category',
        'data',
        'action_url',
        'is_read',
        'read_at',
    ];

    protected $casts = [
        'data' => 'array',
        'is_read' => 'boolean',
        'read_at' => 'datetime',
    ];

    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    // Scopes
    public function scopeUnread($query)
    {
        return $query->where('is_read', false);
    }

    public function scopeForUser($query, $userId)
    {
        return $query->where(function ($q) use ($userId) {
            $q->where('user_id', $userId)
                ->orWhereNull('user_id'); // Include global notifications
        });
    }

    public function scopeForBranch($query, $branchId)
    {
        return $query->where(function ($q) use ($branchId) {
            $q->where('branch_id', $branchId)
                ->orWhereNull('branch_id'); // Include global notifications
        });
    }

    public function scopeRecent($query, $days = 7)
    {
        return $query->where('created_at', '>=', Carbon::now()->subDays($days));
    }

    // Helper methods
    public function markAsRead()
    {
        $this->update([
            'is_read' => true,
            'read_at' => now()
        ]);
    }

    public function getTimeAgoAttribute()
    {
        return $this->created_at->diffForHumans();
    }

    // Static helper to create notifications
    public static function notify($type, $title, $message, $options = [])
    {
        return self::create([
            'user_id' => $options['user_id'] ?? null,
            'branch_id' => $options['branch_id'] ?? null,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'category' => $options['category'] ?? 'system',
            'data' => $options['data'] ?? null,
            'action_url' => $options['action_url'] ?? null,
        ]);
    }

    // Shorthand methods
    public static function info($title, $message, $options = [])
    {
        return self::notify('info', $title, $message, $options);
    }

    public static function success($title, $message, $options = [])
    {
        return self::notify('success', $title, $message, $options);
    }

    public static function warning($title, $message, $options = [])
    {
        return self::notify('warning', $title, $message, $options);
    }

    public static function danger($title, $message, $options = [])
    {
        return self::notify('danger', $title, $message, $options);
    }
}
