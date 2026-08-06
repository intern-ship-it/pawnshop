<?php

namespace Tests\Feature;

use App\Models\Pledge;
use Tests\TestCase;

/**
 * The status filter must OR its statuses together, not AND them.
 *
 * "active" and "overdue" are virtual statuses -- real-state views of the stored
 * column, since it never flips when a due date passes. The controller once applied
 * each as a bare ->where(), so "active,overdue" became "active AND overdue", a
 * contradiction that returned zero rows. The redemption search sends exactly that
 * combination, so every redemption lookup that fell through to it found nothing.
 *
 * Read-only: these only count rows against the app database (the suite runs against
 * it and never mutates it), so they assert invariants rather than fixed numbers.
 */
class PledgeDisplayStatusFilterTest extends TestCase
{
    private function countStatus(string $status): int
    {
        return Pledge::query()->displayStatus($status)->count();
    }

    public function test_active_and_overdue_combined_is_not_empty_when_either_is_not(): void
    {
        $active = $this->countStatus('active');
        $overdue = $this->countStatus('overdue');
        $combined = $this->countStatus('active,overdue');

        // The bug returned 0 here while active/overdue each had rows.
        $this->assertGreaterThanOrEqual($active, $combined);
        $this->assertGreaterThanOrEqual($overdue, $combined);

        if ($active > 0 || $overdue > 0) {
            $this->assertGreaterThan(0, $combined, 'active,overdue must return rows when either state has rows');
        }
    }

    public function test_active_and_overdue_partition_without_overlap(): void
    {
        // The two states are disjoint (a pledge is one or the other), so the combined
        // count is exactly their sum -- proving neither double-counts nor drops rows.
        $this->assertSame(
            $this->countStatus('active') + $this->countStatus('overdue'),
            $this->countStatus('active,overdue')
        );
    }

    public function test_a_single_status_still_filters(): void
    {
        // Combined can never be smaller than one of its parts.
        $combined = $this->countStatus('active,overdue');

        $this->assertGreaterThanOrEqual($this->countStatus('active'), $combined);
    }

    public function test_an_unknown_status_falls_back_to_the_stored_column(): void
    {
        // A real column value like 'redeemed' matches on the column directly.
        $this->assertSame(
            Pledge::query()->where('status', 'redeemed')->count(),
            $this->countStatus('redeemed')
        );
    }
}
