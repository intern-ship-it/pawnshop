<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\Pledge;
use App\Models\GoldPrice;
use App\Models\Reconciliation;
use App\Models\DayEndReport;
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

        // 1. Check for pledges expiring today
        $expiringToday = Pledge::where('status', 'active')
            ->whereDate('due_date', Carbon::today())
            ->count();

        if ($expiringToday > 0) {
            $notifications[] = [
                'id' => 'expiring_today',
                'type' => 'warning',
                'title' => 'Pledges Expiring',
                'message' => "{$expiringToday} pledge(s) expiring today",
                'category' => 'pledge',
                'action_url' => '/pledges?status=active&due=today',
                'is_read' => false,
                'time_ago' => 'just now',
                'is_live' => true,
            ];
        }

        // 2. Check for pledges expiring in 3 days
        $expiringThreeDays = Pledge::where('status', 'active')
            ->whereBetween('due_date', [Carbon::tomorrow(), Carbon::today()->addDays(3)])
            ->count();

        if ($expiringThreeDays > 0) {
            $notifications[] = [
                'id' => 'expiring_3days',
                'type' => 'info',
                'title' => 'Upcoming Due Dates',
                'message' => "{$expiringThreeDays} pledge(s) due in 3 days",
                'category' => 'pledge',
                'action_url' => '/pledges?status=active',
                'is_read' => false,
                'time_ago' => 'just now',
                'is_live' => true,
            ];
        }

        // 3. Check for overdue pledges
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
                'time_ago' => 'just now',
                'is_live' => true,
            ];
        }

        // 4. Check if gold price was updated today
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
            ];
        }

        // 5. Check if day-end was completed
        $todayDayEnd = DayEndReport::whereDate('report_date', Carbon::today())->first();
        if ($todayDayEnd) {
            $notifications[] = [
                'id' => 'dayend_complete',
                'type' => 'success',
                'title' => 'Day End Complete',
                'message' => 'Daily reconciliation completed',
                'category' => 'reconciliation',
                'action_url' => '/day-end',
                'is_read' => false,
                'time_ago' => $todayDayEnd->created_at->diffForHumans(),
                'is_live' => true,
            ];
        } else {
            // No day-end yet - reminder after 5 PM
            if (Carbon::now()->hour >= 17) {
                $notifications[] = [
                    'id' => 'dayend_pending',
                    'type' => 'warning',
                    'title' => 'Day End Pending',
                    'message' => 'Daily reconciliation not yet completed',
                    'category' => 'reconciliation',
                    'action_url' => '/day-end',
                    'is_read' => false,
                    'time_ago' => 'just now',
                    'is_live' => true,
                ];
            }
        }

        // 6. Today's new pledges count
        $todayPledges = Pledge::whereDate('created_at', Carbon::today())->count();
        if ($todayPledges > 0) {
            $notifications[] = [
                'id' => 'today_pledges',
                'type' => 'info',
                'title' => "Today's Activity",
                'message' => "{$todayPledges} new pledge(s) created today",
                'category' => 'pledge',
                'action_url' => '/pledges',
                'is_read' => false,
                'time_ago' => 'today',
                'is_live' => true,
            ];
        }

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
