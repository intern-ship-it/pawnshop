<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GoldPriceSource extends Model
{
    protected $table = 'gold_price_sources';

    protected $fillable = [
        'code',
        'name',
        'provider',
        'api_endpoint',
        'api_key',
        'priority',
        'is_active',
        'rate_limit_per_month',
        'current_month_usage',
        'last_reset_at',
        'settings',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'settings' => 'array',
        'last_reset_at' => 'datetime',
    ];

    protected $hidden = [
        'api_key', // Never expose API key
    ];

    /**
     * Scopes
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopePrimary($query)
    {
        return $query->where('priority', 'primary');
    }

    public function scopeSecondary($query)
    {
        return $query->where('priority', 'secondary');
    }

    public function scopeByPriority($query)
    {
        return $query->orderByRaw("FIELD(priority, 'primary', 'secondary', 'backup')");
    }

    /**
     * Check if rate limit is exceeded
     */
    public function isRateLimitExceeded(): bool
    {
        if (!$this->rate_limit_per_month) {
            return false; // No limit
        }

        return $this->current_month_usage >= $this->rate_limit_per_month;
    }

    /**
     * Get remaining API calls this month
     */
    public function getRemainingCalls(): ?int
    {
        if (!$this->rate_limit_per_month) {
            return null; // Unlimited
        }

        return max(0, $this->rate_limit_per_month - $this->current_month_usage);
    }

    /**
     * Get usage percentage
     */
    public function getUsagePercent(): ?float
    {
        if (!$this->rate_limit_per_month) {
            return null;
        }

        return round(($this->current_month_usage / $this->rate_limit_per_month) * 100, 2);
    }

    /**
     * Increment usage counter
     */
    public function incrementUsage(): void
    {
        $this->increment('current_month_usage');
    }

    /**
     * Reset monthly usage
     */
    public function resetUsage(): void
    {
        $this->update([
            'current_month_usage' => 0,
            'last_reset_at' => now(),
        ]);
    }

    /**
     * Get decrypted API key (if stored encrypted)
     */
    public function getDecryptedApiKey(): ?string
    {
        if (!$this->api_key) {
            return null;
        }

        // If using Laravel encryption
        try {
            return decrypt($this->api_key);
        } catch (\Exception $e) {
            // Not encrypted, return as-is
            return $this->api_key;
        }
    }

    /**
     * Get setting value
     */
    public function getSetting(string $key, $default = null)
    {
        $settings = $this->settings ?? [];
        return $settings[$key] ?? $default;
    }

    /**
     * Check if source has bid/ask prices
     */
    public function hasBidAsk(): bool
    {
        return $this->getSetting('has_bid_ask', false);
    }

    /**
     * Get priority label
     */
    public function getPriorityLabelAttribute(): string
    {
        return match ($this->priority) {
            'primary' => 'Primary (Main)',
            'secondary' => 'Secondary (Reference)',
            'backup' => 'Backup (Fallback)',
            default => 'Unknown',
        };
    }
}