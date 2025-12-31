<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pledge;
use App\Models\Renewal;
use App\Models\Redemption;
use App\Models\DayEndReport;
use App\Models\PledgeItem;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Barryvdh\DomPDF\Facade\Pdf;
use Picqer\Barcode\BarcodeGeneratorPNG;

class PrintController extends Controller
{
    /**
     * Print pledge receipt
     */
    public function pledgeReceipt(Request $request, Pledge $pledge)
    {
        if ($pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'copy_type' => 'required|in:office,customer',
        ]);

        $pledge->load([
            'customer',
            'items.category',
            'items.purity',
            'payments.bank',
            'branch',
            'createdBy:id,name',
        ]);

        // Get terms and conditions
        $terms = \App\Models\TermsCondition::getForActivity('pledge', $pledge->branch_id);

        $data = [
            'pledge' => $pledge,
            'copy_type' => $validated['copy_type'],
            'terms' => $terms,
            'printed_at' => now(),
            'printed_by' => $request->user()->name,
        ];

        $pdf = Pdf::loadView('pdf.pledge-receipt', $data);
        $pdf->setPaper('a5', 'portrait');

        // Record print
        \App\Models\PledgeReceipt::create([
            'pledge_id' => $pledge->id,
            'print_type' => $pledge->receipt_printed ? 'reprint' : 'original',
            'copy_type' => $validated['copy_type'],
            'is_chargeable' => $pledge->receipt_printed,
            'charge_amount' => $pledge->receipt_printed ? config('pawnsys.receipt.reprint_charge', 2.00) : 0,
            'printed_by' => $request->user()->id,
            'printed_at' => now(),
        ]);

        $pledge->update([
            'receipt_printed' => true,
            'receipt_print_count' => $pledge->receipt_print_count + 1,
        ]);

        $filename = "pledge-receipt-{$pledge->receipt_no}.pdf";

        return $pdf->download($filename);
    }

    /**
     * Print item barcode
     */
    public function barcode(Request $request, PledgeItem $pledgeItem): JsonResponse
    {
        if ($pledgeItem->pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $generator = new BarcodeGeneratorPNG();
        $barcode = base64_encode($generator->getBarcode($pledgeItem->barcode, $generator::TYPE_CODE_128));

        return $this->success([
            'barcode' => $pledgeItem->barcode,
            'image' => 'data:image/png;base64,' . $barcode,
            'item' => [
                'pledge_no' => $pledgeItem->pledge->pledge_no,
                'category' => $pledgeItem->category->name_en,
                'weight' => $pledgeItem->net_weight . 'g',
                'purity' => $pledgeItem->purity->code,
            ],
        ]);
    }

    /**
     * Print renewal receipt
     */
    public function renewalReceipt(Request $request, Renewal $renewal)
    {
        if ($renewal->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $renewal->load([
            'pledge.customer',
            'pledge.items.category',
            'pledge.branch',
            'interestBreakdown',
            'bank',
            'createdBy:id,name',
        ]);

        $terms = \App\Models\TermsCondition::getForActivity('renewal', $renewal->branch_id);

        $data = [
            'renewal' => $renewal,
            'terms' => $terms,
            'printed_at' => now(),
            'printed_by' => $request->user()->name,
        ];

        $pdf = Pdf::loadView('pdf.renewal-receipt', $data);
        $pdf->setPaper('a5', 'portrait');

        $filename = "renewal-receipt-{$renewal->renewal_no}.pdf";

        return $pdf->download($filename);
    }

    /**
     * Print redemption receipt
     */
    public function redemptionReceipt(Request $request, Redemption $redemption)
    {
        if ($redemption->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $redemption->load([
            'pledge.customer',
            'pledge.items.category',
            'pledge.branch',
            'bank',
            'createdBy:id,name',
        ]);

        $terms = \App\Models\TermsCondition::getForActivity('redemption', $redemption->branch_id);

        $data = [
            'redemption' => $redemption,
            'terms' => $terms,
            'printed_at' => now(),
            'printed_by' => $request->user()->name,
        ];

        $pdf = Pdf::loadView('pdf.redemption-receipt', $data);
        $pdf->setPaper('a5', 'portrait');

        $filename = "redemption-receipt-{$redemption->redemption_no}.pdf";

        return $pdf->download($filename);
    }

    /**
     * Print day-end report
     */
    public function dayEndReport(Request $request, DayEndReport $dayEndReport)
    {
        if ($dayEndReport->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $dayEndReport->load([
            'branch',
            'verifications',
            'closedBy:id,name',
        ]);

        $data = [
            'report' => $dayEndReport,
            'printed_at' => now(),
            'printed_by' => $request->user()->name,
        ];

        $pdf = Pdf::loadView('pdf.day-end-report', $data);
        $pdf->setPaper('a4', 'portrait');

        $dayEndReport->update(['report_printed' => true]);

        $filename = "day-end-report-{$dayEndReport->report_date->format('Y-m-d')}.pdf";

        return $pdf->download($filename);
    }

    /**
     * Print multiple barcodes (batch)
     */
    public function batchBarcodes(Request $request)
    {
        $validated = $request->validate([
            'item_ids' => 'required|array|min:1',
            'item_ids.*' => 'exists:pledge_items,id',
        ]);

        $branchId = $request->user()->branch_id;
        $generator = new BarcodeGeneratorPNG();
        $barcodes = [];

        foreach ($validated['item_ids'] as $itemId) {
            $item = PledgeItem::with(['pledge', 'category', 'purity'])->find($itemId);

            if ($item->pledge->branch_id !== $branchId) {
                continue;
            }

            $barcodes[] = [
                'barcode' => $item->barcode,
                'image' => 'data:image/png;base64,' . base64_encode(
                    $generator->getBarcode($item->barcode, $generator::TYPE_CODE_128)
                ),
                'pledge_no' => $item->pledge->pledge_no,
                'category' => $item->category->name_en,
                'weight' => $item->net_weight . 'g',
                'purity' => $item->purity->code,
            ];
        }

        return $this->success($barcodes);
    }

    /**
     * Preview receipt (returns HTML)
     */
    public function previewPledgeReceipt(Request $request, Pledge $pledge): JsonResponse
    {
        if ($pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $pledge->load([
            'customer',
            'items.category',
            'items.purity',
            'payments.bank',
            'branch',
        ]);

        $terms = \App\Models\TermsCondition::getForActivity('pledge', $pledge->branch_id);

        // Return data for frontend to render preview
        return $this->success([
            'pledge' => $pledge,
            'terms' => $terms,
            'branch' => $pledge->branch,
        ]);
    }
}
