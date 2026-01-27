<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Pledge;
use App\Models\GoldPrice;
use App\Models\Reconciliation;
use App\Models\DayEndReport;
use App\Models\Customer;
use App\Models\Renewal;
use App\Models\Vault;
use App\Models\Slot;
use App\Models\WhatsAppLog;
use Illuminate\Http\Request;
use Carbon\Carbon;

class NotificationController extends Controller
{
    /**
     * Get notifications for current user
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $limit = $request->input('limit', 10);

        // Get notifications for this user and global ones
        $notifications = Notification::forUser($user->id)
            ->forBranch($user->branch_id)
            ->recent(30) // Last 30 days
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get()
            ->map(function ($notif) {
                return [
                    'id' => $notif->id,
                    'type' => $notif->type,
                    'title' => $notif->title,
                    'message' => $notif->message,
                    'category' => $notif->category,
                    'action_url' => $notif->action_url,
                    'is_read' => $notif->is_read,
                    'time_ago' => $notif->time_ago,
                    'created_at' => $notif->created_at->toISOString(),
                ];
            });

        // Count unread
        $unreadCount = Notification::forUser($user->id)
            ->forBranch($user->branch_id)
            ->unread()
            ->recent(30)
            ->count();

        return response()->json([
            'success' => true,
            'data' => [
                'notifications' => $notifications,
                'unread_count' => $unreadCount,
            ]
        ]);
    }

    /**
     * Get live/generated notifications based on system state
     * These are not stored in DB but computed in real-time
     */
    public function live(Request $request)
    {
        $user = $request->user();
        $notifications = [];

        // ====== PLEDGE NOTIFICATIONS ======

        // 1. Overdue pledges (CRITICAL)
        $overduePledges = Pledge::where('status', 'active')
            ->where('due_date', '<', Carbon::today())
            ->count();

        if ($overduePledges > 0) {
            $notifications[] = [
                'id' => 'overdue',
                'type' => 'danger',
                'title' => 'Overdue Pledges',
                'message' => "{$overduePledges} pledge(s) are overdue!",
                'category' => 'pledge',
                'action_url' => '/pledges?status=overdue',
                'is_read' => false,
                'time_ago' => 'urgent',
                'is_live' => true,
                'priority' => 1,
            ];
        }

        // 2. Pledges expiring today
        $expiringToday = Pledge::where('status', 'active')
            ->whereDate('due_date', Carbon::today())
            ->count();

        if ($expiringToday > 0) {
            $notifications[] = [
                'id' => 'expiring_today',
                'type' => 'warning',
                'title' => 'Pledges Expiring Today',
                'message' => "{$expiringToday} pledge(s) expiring today",
                'category' => 'pledge',
                'action_url' => '/pledges?status=active&due=today',
                'is_read' => false,
                'time_ago' => 'today',
                'is_live' => true,
                'priority' => 2,
            ];
        }

        // 3. Pledges expiring in 3 days
        $expiringThreeDays = Pledge::where('status', 'active')
            ->whereBetween('due_date', [Carbon::tomorrow(), Carbon::today()->addDays(3)])
            ->count();

        if ($expiringThreeDays > 0) {
            $notifications[] = [
                'id' => 'expiring_3days',
                'type' => 'info',
                'title' => 'Upcoming Due Dates',
                'message' => "{$expiringThreeDays} pledge(s) due within 3 days",
                'category' => 'pledge',
                'action_url' => '/pledges?status=active',
                'is_read' => false,
                'time_ago' => 'upcoming',
                'is_live' => true,
                'priority' => 5,
            ];
        }

        // 4. Large transactions today (pledges > RM 5000)
        $largeTransactions = Pledge::whereDate('created_at', Carbon::today())
            ->where('loan_amount', '>=', 5000)
            ->count();

        if ($largeTransactions > 0) {
            $notifications[] = [
                'id' => 'large_transactions',
                'type' => 'info',
                'title' => 'Large Transactions',
                'message' => "{$largeTransactions} high-value pledge(s) today (≥RM 5,000)",
                'category' => 'pledge',
                'action_url' => '/pledges',
                'is_read' => false,
                'time_ago' => 'today',
                'is_live' => true,
                'priority' => 6,
            ];
        }

        // ====== RENEWAL NOTIFICATIONS ======

        // 5. Renewals due soon (within 7 days)
        $renewalsDue = Pledge::where('status', 'active')
            ->whereBetween('due_date', [Carbon::today(), Carbon::today()->addDays(7)])
            ->where('renewal_count', '>', 0)
            ->count();

        if ($renewalsDue > 0) {
            $notifications[] = [
                'id' => 'renewals_due',
                'type' => 'info',
                'title' => 'Renewals Due Soon',
                'message' => "{$renewalsDue} pledge(s) eligible for renewal this week",
                'category' => 'renewal',
                'action_url' => '/pledges?status=active',
                'is_read' => false,
                'time_ago' => 'this week',
                'is_live' => true,
                'priority' => 7,
            ];
        }

        // ====== RECONCILIATION & DAY-END ======

        // 6. Stock reconciliation pending (if not done this week)
        $lastReconciliation = Reconciliation::orderBy('created_at', 'desc')->first();
        $daysSinceReconciliation = $lastReconciliation
            ? Carbon::parse($lastReconciliation->created_at)->diffInDays(Carbon::now())
            : 999;

        if ($daysSinceReconciliation >= 7) {
            $notifications[] = [
                'id' => 'reconciliation_pending',
                'type' => 'warning',
                'title' => 'Stock Reconciliation Due',
                'message' => $lastReconciliation
                    ? "Last reconciliation was {$daysSinceReconciliation} days ago"
                    : "No stock reconciliation has been performed",
                'category' => 'reconciliation',
                'action_url' => '/stock-reconciliation',
                'is_read' => false,
                'time_ago' => $lastReconciliation ? "{$daysSinceReconciliation} days ago" : 'never',
                'is_live' => true,
                'priority' => 3,
            ];
        }

        // 7. Day-end status
        $todayDayEnd = DayEndReport::whereDate('report_date', Carbon::today())->first();
        if ($todayDayEnd) {
            $notifications[] = [
                'id' => 'dayend_complete',
                'type' => 'success',
                'title' => 'Day End Complete',
                'message' => 'Daily reconciliation completed successfully',
                'category' => 'reconciliation',
                'action_url' => '/day-end',
                'is_read' => false,
                'time_ago' => $todayDayEnd->created_at->diffForHumans(),
                'is_live' => true,
                'priority' => 10,
            ];
        } else if (Carbon::now()->hour >= 17) {
            // After 5 PM reminder
            $notifications[] = [
                'id' => 'dayend_pending',
                'type' => 'warning',
                'title' => 'Day End Pending',
                'message' => 'Daily reconciliation not yet completed',
                'category' => 'reconciliation',
                'action_url' => '/day-end',
                'is_read' => false,
                'time_ago' => 'action required',
                'is_live' => true,
                'priority' => 2,
            ];
        }

        // ====== STORAGE ALERTS ======

        // 8. Low storage capacity (vaults > 80% full)
        try {
            $vaults = Vault::withCount([
                'slots' => function ($q) {
                    $q->where('status', 'occupied');
                },
                'slots as total_slots_count'
            ])->get();

            $lowStorageVaults = $vaults->filter(function ($vault) {
                if ($vault->total_slots_count == 0)
                    return false;
                $occupancyRate = ($vault->slots_count / $vault->total_slots_count) * 100;
                return $occupancyRate >= 80;
            })->count();

            if ($lowStorageVaults > 0) {
                $notifications[] = [
                    'id' => 'low_storage',
                    'type' => 'warning',
                    'title' => 'Storage Capacity Alert',
                    'message' => "{$lowStorageVaults} vault(s) are >80% full",
                    'category' => 'storage',
                    'action_url' => '/storage',
                    'is_read' => false,
                    'time_ago' => 'check now',
                    'is_live' => true,
                    'priority' => 4,
                ];
            }
        } catch (\Exception $e) {
            // Silently skip if storage tables don't exist
        }

        // ====== CUSTOMER NOTIFICATIONS ======

        // 9. New customers today
        $newCustomers = Customer::whereDate('created_at', Carbon::today())->count();
        if ($newCustomers > 0) {
            $notifications[] = [
                'id' => 'new_customers',
                'type' => 'success',
                'title' => 'New Customers',
                'message' => "{$newCustomers} new customer(s) registered today",
                'category' => 'customer',
                'action_url' => '/customers',
                'is_read' => false,
                'time_ago' => 'today',
                'is_live' => true,
                'priority' => 8,
            ];
        }

        // ====== GOLD PRICE ======

        // 10. Gold price updated
        $todayGoldPrice = GoldPrice::whereDate('created_at', Carbon::today())->first();
        if ($todayGoldPrice) {
            $notifications[] = [
                'id' => 'gold_updated',
                'type' => 'success',
                'title' => 'Gold Price Updated',
                'message' => 'Gold price has been updated today',
                'category' => 'gold_price',
                'action_url' => '/settings',
                'is_read' => false,
                'time_ago' => $todayGoldPrice->created_at->diffForHumans(),
                'is_live' => true,
                'priority' => 9,
            ];
        }

        // ====== WHATSAPP ALERTS ======

        // 11. Failed WhatsApp messages
        try {
            $failedMessages = WhatsAppLog::where('status', 'failed')
                ->whereDate('created_at', Carbon::today())
                ->count();

            if ($failedMessages > 0) {
                $notifications[] = [
                    'id' => 'whatsapp_failed',
                    'type' => 'danger',
                    'title' => 'WhatsApp Alerts',
                    'message' => "{$failedMessages} message(s) failed to send today",
                    'category' => 'whatsapp',
                    'action_url' => '/settings/whatsapp',
                    'is_read' => false,
                    'time_ago' => 'today',
                    'is_live' => true,
                    'priority' => 3,
                ];
            }
        } catch (\Exception $e) {
            // Silently skip if WhatsApp table doesn't exist
        }

        // ====== ACTIVITY SUMMARY ======

        // 12. Today's activity summary
        $todayPledges = Pledge::whereDate('created_at', Carbon::today())->count();
        $todayRedemptions = Pledge::whereDate('redeemed_at', Carbon::today())->count();
        $todayRenewals = Renewal::whereDate('created_at', Carbon::today())->count();

        if ($todayPledges > 0 || $todayRedemptions > 0 || $todayRenewals > 0) {
            $activityParts = [];
            if ($todayPledges > 0)
                $activityParts[] = "{$todayPledges} pledge(s)";
            if ($todayRenewals > 0)
                $activityParts[] = "{$todayRenewals} renewal(s)";
            if ($todayRedemptions > 0)
                $activityParts[] = "{$todayRedemptions} redemption(s)";

            $notifications[] = [
                'id' => 'today_activity',
                'type' => 'info',
                'title' => "Today's Activity",
                'message' => implode(', ', $activityParts),
                'category' => 'activity',
                'action_url' => '/dashboard',
                'is_read' => false,
                'time_ago' => 'today',
                'is_live' => true,
                'priority' => 11,
            ];
        }

        // ====== WEEKLY REPORTS ======

        // 13. Weekly report reminder (on Mondays)
        if (Carbon::now()->dayOfWeek === Carbon::MONDAY) {
            $notifications[] = [
                'id' => 'weekly_report',
                'type' => 'info',
                'title' => 'Weekly Report',
                'message' => 'Weekly summary report is available',
                'category' => 'report',
                'action_url' => '/reports',
                'is_read' => false,
                'time_ago' => 'monday',
                'is_live' => true,
                'priority' => 12,
            ];
        }

        // Sort by priority (lower = more important)
        usort($notifications, function ($a, $b) {
            return ($a['priority'] ?? 99) - ($b['priority'] ?? 99);
        });

        // Remove priority from output
        $notifications = array_map(function ($n) {
            unset($n['priority']);
            return $n;
        }, $notifications);

        return response()->json([
            'success' => true,
            'data' => [
                'notifications' => $notifications,
                'unread_count' => count($notifications),
            ]
        ]);
    }

    /**
     * Get combined notifications (stored + live)
     */
    public function all(Request $request)
    {
        $user = $request->user();
        $limit = $request->input('limit', 10);

        // Get stored notifications
        $storedNotifications = Notification::forUser($user->id)
            ->forBranch($user->branch_id)
            ->recent(30)
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get()
            ->map(function ($notif) {
                return [
                    'id' => $notif->id,
                    'type' => $notif->type,
                    'title' => $notif->title,
                    'message' => $notif->message,
                    'category' => $notif->category,
                    'action_url' => $notif->action_url,
                    'is_read' => $notif->is_read,
                    'time_ago' => $notif->time_ago,
                    'created_at' => $notif->created_at->toISOString(),
                    'is_live' => false,
                ];
            })->toArray();

        // Get live notifications
        $liveResponse = $this->live($request);
        $liveData = json_decode($liveResponse->getContent(), true);
        $liveNotifications = $liveData['data']['notifications'] ?? [];

        // Combine: live first, then stored
        $allNotifications = array_merge($liveNotifications, $storedNotifications);

        // Limit total
        $allNotifications = array_slice($allNotifications, 0, $limit);

        // Count unread
        $storedUnread = Notification::forUser($user->id)
            ->forBranch($user->branch_id)
            ->unread()
            ->recent(30)
            ->count();

        $totalUnread = $storedUnread + count($liveNotifications);

        return response()->json([
            'success' => true,
            'data' => [
                'notifications' => $allNotifications,
                'unread_count' => $totalUnread,
            ]
        ]);
    }

    /**
     * Mark notification as read
     */
    public function markAsRead(Request $request, $id)
    {
        $notification = Notification::findOrFail($id);
        $notification->markAsRead();

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read'
        ]);
    }

    /**
     * Mark all notifications as read
     */
    public function markAllAsRead(Request $request)
    {
        $user = $request->user();

        Notification::forUser($user->id)
            ->forBranch($user->branch_id)
            ->unread()
            ->update([
                'is_read' => true,
                'read_at' => now()
            ]);

        return response()->json([
            'success' => true,
            'message' => 'All notifications marked as read'
        ]);
    }

    /**
     * Delete a notification
     */
    public function destroy($id)
    {
        $notification = Notification::findOrFail($id);
        $notification->delete();

        return response()->json([
            'success' => true,
            'message' => 'Notification deleted'
        ]);
    }

    /**
     * Get unread count only
     */
    public function unreadCount(Request $request)
    {
        $user = $request->user();

        // Stored unread
        $storedUnread = Notification::forUser($user->id)
            ->forBranch($user->branch_id)
            ->unread()
            ->recent(30)
            ->count();

        // Live alerts count
        $liveResponse = $this->live($request);
        $liveData = json_decode($liveResponse->getContent(), true);
        $liveCount = count($liveData['data']['notifications'] ?? []);

        return response()->json([
            'success' => true,
            'data' => [
                'count' => $storedUnread + $liveCount,
                'stored_count' => $storedUnread,
                'live_count' => $liveCount,
            ]
        ]);
    }
}
