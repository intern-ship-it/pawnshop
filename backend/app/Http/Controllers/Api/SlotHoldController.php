<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Slot;
use App\Models\SlotHold;
use App\Models\Box;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Advisory slot-hold layer (concurrency safety for the pledge slot grid).
 *
 * A "hold" temporarily claims a slot while a user fills out the New Pledge
 * form, so a second user cannot pick the same slot/subslot at the same time.
 * Holds live for 60 seconds and are renewed every ~30s while the form is
 * open. They expire lazily — a hold whose expires_at is past is ignored and
 * cleaned up opportunistically, so no scheduled job is needed.
 *
 * This controller NEVER assigns slots. The real, permanent assignment stays
 * in PledgeController@store, untouched. Holds are released once a pledge is
 * created (or when the user leaves / changes slot).
 */
class SlotHoldController extends Controller
{
    /** Hold lifetime in seconds. */
    private const TTL_SECONDS = 60;

    /**
     * Claim (or renew, if already mine) a hold on a slot.
     *
     * Atomic: the unique index on slot_holds.slot_id guarantees that two
     * simultaneous claims resolve to exactly one winner — the loser hits a
     * duplicate-key error and gets a 409.
     */
    public function claim(Request $request, Slot $slot): JsonResponse
    {
        $userId = $request->user()->id;
        $expiresAt = now()->addSeconds(self::TTL_SECONDS);

        try {
            return DB::transaction(function () use ($slot, $userId, $expiresAt) {
                // Drop a stale (expired) hold so the slot can be reclaimed.
                SlotHold::where('slot_id', $slot->id)
                    ->where('expires_at', '<=', now())
                    ->delete();

                $existing = SlotHold::where('slot_id', $slot->id)->lockForUpdate()->first();

                if ($existing) {
                    // Live hold by someone else → reject.
                    if ($existing->held_by !== $userId) {
                        return response()->json([
                            'message' => 'This slot was just taken by another user. Please choose a different one.',
                        ], 409);
                    }

                    // Already mine → renew.
                    $existing->update(['expires_at' => $expiresAt]);

                    return response()->json([
                        'data' => ['slot_id' => $slot->id, 'mine' => true, 'expires_at' => $expiresAt],
                    ]);
                }

                SlotHold::create([
                    'slot_id' => $slot->id,
                    'held_by' => $userId,
                    'expires_at' => $expiresAt,
                ]);

                return response()->json([
                    'data' => ['slot_id' => $slot->id, 'mine' => true, 'expires_at' => $expiresAt],
                ]);
            });
        } catch (\Illuminate\Database\QueryException $e) {
            // Unique-constraint violation = a concurrent claim beat us.
            return response()->json([
                'message' => 'This slot was just taken by another user. Please choose a different one.',
            ], 409);
        }
    }

    /**
     * Renew my hold on a slot (called every ~30s while the form is open).
     */
    public function renew(Request $request, Slot $slot): JsonResponse
    {
        $userId = $request->user()->id;

        $hold = SlotHold::live()
            ->where('slot_id', $slot->id)
            ->where('held_by', $userId)
            ->first();

        if (!$hold) {
            return response()->json([
                'message' => 'Your hold on this slot has expired or was taken. Please reselect.',
            ], 409);
        }

        $expiresAt = now()->addSeconds(self::TTL_SECONDS);
        $hold->update(['expires_at' => $expiresAt]);

        return response()->json([
            'data' => ['slot_id' => $slot->id, 'mine' => true, 'expires_at' => $expiresAt],
        ]);
    }

    /**
     * Release my hold on a slot (on slot change / cancel / leaving the page).
     */
    public function release(Request $request, Slot $slot): JsonResponse
    {
        SlotHold::where('slot_id', $slot->id)
            ->where('held_by', $request->user()->id)
            ->delete();

        return response()->json(['data' => ['slot_id' => $slot->id, 'released' => true]]);
    }

    /**
     * List live holds for every slot in a box (for grid render + polling).
     * Returns which slots are held and whether each is held by the caller.
     */
    public function index(Request $request, Box $box): JsonResponse
    {
        $userId = $request->user()->id;

        $slotIds = Slot::where('box_id', $box->id)->pluck('id');

        $holds = SlotHold::live()
            ->whereIn('slot_id', $slotIds)
            ->get()
            ->map(fn ($hold) => [
                'slot_id' => $hold->slot_id,
                'mine' => $hold->held_by === $userId,
                'expires_at' => $hold->expires_at,
            ]);

        return response()->json(['data' => $holds]);
    }
}
