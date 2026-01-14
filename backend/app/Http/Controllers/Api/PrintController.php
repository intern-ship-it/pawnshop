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
        try {
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
                'items.vault',
                'items.box',
                'items.slot',
                'payments.bank',
                'branch',
                'createdBy:id,name',
            ]);

            // Get company settings from Setting model (key-value structure)
            $settings = [];

            // Query company settings
            $companySettings = \App\Models\Setting::where('category', 'company')->get();

            // Convert to associative array
            $settingsMap = [];
            foreach ($companySettings as $setting) {
                $settingsMap[$setting->key_name] = $setting->value;
            }

            // Build settings array with fallbacks
            $settings = [
                'company_name' => $settingsMap['name'] ?? $pledge->branch->name ?? 'PAJAK GADAI SDN BHD',
                'registration_no' => $settingsMap['registration_no'] ?? '',
                'license_no' => $settingsMap['license_no'] ?? $pledge->branch->license_no ?? '',
                'address' => $settingsMap['address'] ?? $pledge->branch->address ?? '',
                'phone' => $settingsMap['phone'] ?? $pledge->branch->phone ?? '',
                'fax' => $settingsMap['fax'] ?? '',
                'email' => $settingsMap['email'] ?? $pledge->branch->email ?? '',
                'receipt_header_text' => $settingsMap['receipt_header'] ?? 'PAJAK GADAI BERLESEN',
                'receipt_footer_text' => $settingsMap['receipt_footer'] ?? 'Terima kasih atas sokongan anda',
            ];

            // Get terms and conditions (with fallback)
            $terms = [];
            try {
                $terms = \App\Models\TermsCondition::getForActivity('pledge', $pledge->branch_id) ?? [];
            } catch (\Exception $e) {
                $terms = [];
            }

            $data = [
                'pledge' => $pledge,
                'copy_type' => $validated['copy_type'],
                'settings' => $settings,
                'terms' => $terms,
                'printed_at' => now(),
                'printed_by' => $request->user()->name,
            ];

            $pdf = Pdf::loadView('pdf.pledge-receipt', $data);
            $pdf->setPaper('a5', 'portrait');

            // Record print (skip if table doesn't exist)
            try {
                \App\Models\PledgeReceipt::create([
                    'pledge_id' => $pledge->id,
                    'print_type' => $pledge->receipt_printed ? 'reprint' : 'original',
                    'copy_type' => $validated['copy_type'],
                    'is_chargeable' => $pledge->receipt_printed ?? false,
                    'charge_amount' => ($pledge->receipt_printed ?? false) ? 2.00 : 0,
                    'printed_by' => $request->user()->id,
                    'printed_at' => now(),
                ]);
            } catch (\Exception $e) {
                // Table may not exist, skip
            }

            $pledge->update([
                'receipt_printed' => true,
                'receipt_print_count' => ($pledge->receipt_print_count ?? 0) + 1,
            ]);

            return $pdf->download("pledge-receipt-{$pledge->receipt_no}.pdf");

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
                'file' => basename($e->getFile()),
                'line' => $e->getLine(),
            ], 500);
        }
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
            'pledge.items.vault',
            'pledge.items.box',
            'pledge.items.slot',
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
            'pledge.items.purity',
            'pledge.items.vault',
            'pledge.items.box',
            'pledge.items.slot',
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
