-- ════════════════════════════════════════════════════════════════
-- 🗑️ DELETE PLEDGES - REUSABLE TEMPLATE
-- ════════════════════════════════════════════════════════════════
--
-- HOW TO USE:
-- 1. Take full DB backup first!
-- 2. Find the pledge IDs by running:
--      SELECT id, pledge_no, receipt_no, status FROM pledges 
--      WHERE receipt_no IN ('RCP-HQ-2026-XXXX');
-- 3. Replace (XX, XX, XX) below with actual pledge IDs
-- 4. Run each query one by one in phpMyAdmin
-- ════════════════════════════════════════════════════════════════

-- ⚠️ STEP 0: CHANGE THESE IDs TO YOUR PLEDGE IDs
-- Example: (20, 21, 22)
-- ════════════════════════════════════════════════════════════════

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Release vault slots
UPDATE slots SET is_occupied = 0, current_item_id = NULL, occupied_at = NULL 
WHERE id IN (SELECT slot_id FROM pledge_items WHERE pledge_id IN (XX, XX, XX) AND slot_id IS NOT NULL);

-- 2. Delete renewal interest breakdowns
DELETE FROM renewal_interest_breakdown 
WHERE renewal_id IN (SELECT id FROM renewals WHERE pledge_id IN (XX, XX, XX));

-- 3. Delete renewals
DELETE FROM renewals WHERE pledge_id IN (XX, XX, XX);

-- 4. Delete redemptions
DELETE FROM redemptions WHERE pledge_id IN (XX, XX, XX);

-- 5. Delete pledge items
DELETE FROM pledge_items WHERE pledge_id IN (XX, XX, XX);

-- 6. Delete pledge payments
DELETE FROM pledge_payments WHERE pledge_id IN (XX, XX, XX);

-- 7. Delete pledge receipts
DELETE FROM pledge_receipts WHERE pledge_id IN (XX, XX, XX);

-- 8. Delete audit logs
DELETE FROM audit_logs WHERE record_type = 'Pledge' AND record_id IN (XX, XX, XX);

-- 9. Delete notifications
DELETE FROM notifications WHERE action_url IN ('/pledges/XX', '/pledges/XX', '/pledges/XX');

-- 10. Delete whatsapp logs
DELETE FROM whatsapp_logs WHERE related_type = 'pledge' AND related_id IN (XX, XX, XX);

-- 11. Finally delete the pledges
DELETE FROM pledges WHERE id IN (XX, XX, XX);

SET FOREIGN_KEY_CHECKS = 1;

-- VERIFY (should return 0)
SELECT COUNT(*) AS remaining FROM pledges WHERE id IN (XX, XX, XX);
