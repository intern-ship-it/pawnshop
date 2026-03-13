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
use Picqer\Barcode\BarcodeGeneratorSVG;
use App\Http\Controllers\Api\DotMatrixPrintController;

class PrintController extends Controller
{
    public function __construct()
    {
        // Increase execution time & memory for slow PDF rendering on battery
        set_time_limit(120);
        ini_set('memory_limit', '512M');
    }

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
            }
            catch (\Exception $e) {
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
            }
            catch (\Exception $e) {
            // Table may not exist, skip
            }

            $pledge->update([
                'receipt_printed' => true,
                'receipt_print_count' => ($pledge->receipt_print_count ?? 0) + 1,
            ]);

            return $pdf->download("pledge-receipt-{$pledge->receipt_no}.pdf");

        }
        catch (\Exception $e) {
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

        $generator = new BarcodeGeneratorSVG();
        $barcode = base64_encode($generator->getBarcode($pledgeItem->barcode, $generator::TYPE_CODE_128, 3, 80));

        $storageLocation = '';
        if ($pledgeItem->vault && $pledgeItem->box && $pledgeItem->slot) {
            $safeLetter = substr(trim($pledgeItem->vault->name), -1);
            $drawerLetter = $pledgeItem->box->box_number;
            $slotNumber = $pledgeItem->slot->slot_number;
            $storageLocation = "{$safeLetter}-{$drawerLetter}{$slotNumber}";
        }

        return $this->success([
            'barcode' => $pledgeItem->barcode,
            'image' => 'data:image/svg+xml;base64,' . $barcode,
            'storage_location' => $storageLocation,
            'item' => [
                'pledge_no' => $pledgeItem->pledge->pledge_no,
                'category' => $pledgeItem->category->name_en,
                'weight' => $pledgeItem->net_weight . 'g',
                'purity' => $pledgeItem->purity->code,
            ],
        ]);
    }

    /**
     * Get barcode for a pledge (one barcode per pledge, not per item)
     */
    public function pledgeBarcodes(Request $request, Pledge $pledge): JsonResponse
    {
        if ($pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $pledge->load(['items.category', 'items.purity', 'items.vault', 'items.box', 'items.slot']);

        $generator = new BarcodeGeneratorSVG();

        // One barcode per pledge
        $barcodeValue = $pledge->pledge_no;
        $barcodeImage = 'data:image/svg+xml;base64,' . base64_encode(
            $generator->getBarcode($barcodeValue, $generator::TYPE_CODE_128, 3, 80)
        );

        // Summarize items for the label
        $itemSummary = $pledge->items->map(function ($item) {
            return ($item->category->name_en ?? 'Item') . ' ' . ($item->purity->code ?? '') . ' ' . $item->net_weight . 'g';
        })->implode(', ');

        // Build storage location string from first item (all items in a pledge share the same vault)
        $storageLocation = '';
        $firstItem = $pledge->items->first();
        if ($firstItem && $firstItem->vault && $firstItem->box && $firstItem->slot) {
            $safeLetter = substr(trim($firstItem->vault->name), -1);
            $drawerLetter = $firstItem->box->box_number;
            $slotNumber = $firstItem->slot->slot_number;
            $storageLocation = "{$safeLetter}-{$drawerLetter}{$slotNumber}";
        }

        $items = [[
                'barcode' => $barcodeValue,
                'item_code' => $barcodeValue,
                'image' => $barcodeImage,
                'pledge_no' => $pledge->pledge_no,
                'category' => $firstItem && $firstItem->category ? ($firstItem->category->name_en ?? '') : ($pledge->items->count() . ' item(s)'),
                'purity' => $firstItem && $firstItem->purity ? ($firstItem->purity->code ?? '') : '',
                'net_weight' => $pledge->items->sum('net_weight'),
                'item_summary' => $itemSummary,
                'storage_location' => $storageLocation,
            ]];

        return $this->success([
            'items' => $items,
            'pledge_no' => $pledge->pledge_no,
            'receipt_no' => $pledge->receipt_no,
            'storage_location' => $storageLocation,
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
     * Print barcodes (batch) - one barcode per pledge, not per item
     */
    public function batchBarcodes(Request $request)
    {
        $validated = $request->validate([
            'item_ids' => 'required|array|min:1',
            'item_ids.*' => 'exists:pledge_items,id',
        ]);

        $branchId = $request->user()->branch_id;
        $generator = new BarcodeGeneratorSVG();
        $barcodes = [];
        $processedPledges = []; // Track pledges to avoid duplicate barcodes

        foreach ($validated['item_ids'] as $itemId) {
            $item = PledgeItem::with(['pledge', 'category', 'purity', 'vault', 'box', 'slot'])->find($itemId);

            if ($item->pledge->branch_id !== $branchId) {
                continue;
            }

            // One barcode per pledge - skip if already added
            $pledgeId = $item->pledge->id;
            if (in_array($pledgeId, $processedPledges)) {
                continue;
            }
            $processedPledges[] = $pledgeId;

            // Build storage location string
            $storageLocation = '';
            if ($item->vault && $item->box && $item->slot) {
                $safeLetter = substr(trim($item->vault->name), -1);
                $drawerLetter = $item->box->box_number;
                $slotNumber = $item->slot->slot_number;
                $storageLocation = "{$safeLetter}-{$drawerLetter}{$slotNumber}";
            }

            $barcodeValue = $item->pledge->pledge_no;
            $barcodes[] = [
                'barcode' => $barcodeValue,
                'image' => 'data:image/svg+xml;base64,' . base64_encode(
                $generator->getBarcode($barcodeValue, $generator::TYPE_CODE_128, 3, 80)
            ),
                'pledge_no' => $item->pledge->pledge_no,
                'category' => $item->category->name_en,
                'weight' => $item->net_weight . 'g',
                'purity' => $item->purity->code,
                'net_weight' => $item->net_weight,
                'storage_location' => $storageLocation,
            ];
        }

        return $this->success($barcodes);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PDF Receipts – Pre-Printed Form Style (A5 Landscape)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Get company settings with defaults – INCLUDING LOGO
     * (mirrors DotMatrixPrintController::getCompanySettings)
     */
    private function getCompanySettings($branch): array
    {
        $settingsMap = [];

        try {
            if (class_exists('\App\Models\Setting')) {
                $companySettings = \App\Models\Setting::where('category', 'company')->get();
                $receiptSettings = \App\Models\Setting::where('category', 'receipt')->get();

                foreach ($companySettings as $setting) {
                    $settingsMap[$setting->key_name] = $setting->value;
                }
                foreach ($receiptSettings as $setting) {
                    $settingsMap['receipt_' . $setting->key_name] = $setting->value;
                }
            }
        }
        catch (\Exception $e) {
        // Settings table may not exist – use defaults
        }

        // Get logo URL – check multiple possible keys
        $logoUrl = $settingsMap['logo'] ?? $settingsMap['logo_url'] ?? $settingsMap['company_logo'] ?? null;

        // Convert logo to base64 data URI for dompdf compatibility
        // (dompdf cannot fetch from localhost or external URLs reliably)
        if ($logoUrl && !str_starts_with($logoUrl, 'data:')) {
            $logoPath = null;
            $path = ltrim($logoUrl, '/');
            if (!str_starts_with($logoUrl, 'http')) {
                // Relative path - resolve to storage
                $logoPath = str_starts_with($path, 'storage/')
                    ? public_path($path)
                    : storage_path('app/public/' . $path);
            } else {
                // Absolute URL pointing to localhost - resolve to storage
                $parsed = parse_url($logoUrl);
                $urlPath = ltrim($parsed['path'] ?? '', '/');
                if (str_starts_with($urlPath, 'storage/')) {
                    $logoPath = public_path($urlPath);
                }
            }
            if ($logoPath && file_exists($logoPath)) {
                $mime = mime_content_type($logoPath);
                $logoUrl = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($logoPath));
            } else {
                $logoUrl = null; // Skip logo if file not found
            }
        }

        return [
            'company_name' => $settingsMap['name'] ?? $branch->name ?? 'PAJAK GADAI SDN BHD',
            'company_name_chinese' => $settingsMap['name_chinese'] ?? '新泰當',
            'company_name_tamil' => $settingsMap['name_tamil'] ?? 'அடகு கடை',
            'registration_no' => $settingsMap['registration_no'] ?? '',
            'license_no' => $settingsMap['license_no'] ?? $branch->license_no ?? '',
            'established_year' => $settingsMap['established_year'] ?? '1966',
            'address' => $settingsMap['address'] ?? $branch->address ?? '123 Jalan Utama, 55100 Kuala Lumpur',
            'phone' => $settingsMap['phone'] ?? $branch->phone ?? '03-12345678',
            'phone2' => $settingsMap['phone2'] ?? '',
            'fax' => $settingsMap['fax'] ?? '',
            'business_hours' => $settingsMap['business_hours'] ?? '8.30AM - 6.00PM',
            'business_days' => $settingsMap['business_days'] ?? 'ISNIN - AHAD',
            'closed_days' => $settingsMap['closed_days'] ?? 'CUTI AM & AHAD : PAJAK SAHAJA',
            'handling_fee' => $settingsMap['receipt_handling_fee'] ?? $settingsMap['handling_fee'] ?? '50 SEN',
            'redemption_period' => $settingsMap['receipt_redemption_period'] ?? $settingsMap['redemption_period'] ?? '6 BULAN',
            'interest_rate_normal' => $settingsMap['receipt_interest_rate_normal'] ?? $settingsMap['interest_rate_normal'] ?? '1.5',
            'interest_rate_overdue' => $settingsMap['receipt_interest_rate_overdue'] ?? $settingsMap['interest_rate_overdue'] ?? '2.0',
            'branch_code' => $branch->code ?? 'HQ',
            'insurance_policy_no' => $settingsMap['insurance_policy_no'] ?? '',
            'logo_url' => $logoUrl,
        ];
    }

    /**
     * Generate barcode as base64 data URI (local, no external requests)
     */
    private function generateBarcodeDataUri(string $value): string
    {
        $generator = new BarcodeGeneratorPNG();
        // Higher resolution for better scan reliability (width factor 4, height 100)
        $png = $generator->getBarcode($value, $generator::TYPE_CODE_128, 4, 100);
        return 'data:image/png;base64,' . base64_encode($png);
    }

    /**
     * Get multilang text (Chinese/Tamil) as a PNG image data URI.
     * Uses a pre-rendered static image because:
     * - dompdf's DejaVu Sans doesn't support CJK/Tamil
     * - PHP GD doesn't support complex Tamil script shaping (கு ligature)
     * The static image was rendered via browser (HarfBuzz) for correct shaping.
     */
    private function generateMultilangImageUri(string $chineseName, string $tamilName): ?string
    {
        if (empty($chineseName) && empty($tamilName)) {
            return null;
        }

        // Use pre-rendered static image (browser-rendered with correct Tamil shaping)
        $staticImage = storage_path('fonts/multilang_header.png');
        if (file_exists($staticImage)) {
            $mime = mime_content_type($staticImage);
            return 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($staticImage));
        }

        return null;
    }

    /**
     * Print pledge receipt as PDF (Pre-Printed Form Style)
     * Uses blade template with table-based layout compatible with dompdf
     */
    public function pledgeReceiptPdf(Request $request, Pledge $pledge)
    {
        if ($pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $pledge->load([
            'customer',
            'items.category',
            'items.purity',
            'items.vault',
            'items.box',
            'items.slot',
            'branch',
            'createdBy:id,name',
        ]);

        $settings = $this->getCompanySettings($pledge->branch);

        $data = [
            'pledge' => $pledge,
            'copy_type' => $request->input('copy_type', 'customer'),
            'settings' => $settings,
            'printed_at' => now(),
            'printed_by' => $request->user()->name,
            'barcode_data_uri' => $this->generateBarcodeDataUri($pledge->pledge_no),
            'multilang_image_uri' => $this->generateMultilangImageUri(
                $settings['company_name_chinese'] ?? '',
                $settings['company_name_tamil'] ?? ''
            ),
        ];

        $pdf = Pdf::loadView('pdf.pledge-receipt-preprinted', $data);
        $pdf->setPaper([0.0, 0.0, 710.0, 450.0]);

        $filename = "Pledge-Receipt-{$pledge->pledge_no}.pdf";
        return response($pdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * HTML Preview of pledge receipt (for browser DevTools CSS tweaking)
     */
    public function pledgeReceiptPreview(Request $request, Pledge $pledge)
    {
        $pledge->load([
            'customer',
            'items.category',
            'items.purity',
            'items.vault',
            'items.box',
            'items.slot',
            'branch',
            'createdBy:id,name',
        ]);

        $settings = $this->getCompanySettings($pledge->branch);

        $data = [
            'pledge' => $pledge,
            'copy_type' => $request->input('copy_type', 'customer'),
            'settings' => $settings,
            'printed_at' => now(),
            'printed_by' => $request->user()->name,
            'barcode_data_uri' => $this->generateBarcodeDataUri($pledge->pledge_no),
        ];

        return view('pdf.pledge-receipt-preprinted', $data);
    }

    /**
     * Renewal receipt PDF (Pre-Printed Form Style)
     */
    public function renewalReceiptPdf(Request $request, Renewal $renewal)
    {
        if ($renewal->pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $renewal->load([
            'pledge.customer',
            'pledge.items.category',
            'pledge.items.purity',
            'pledge.branch',
        ]);

        $settings = $this->getCompanySettings($renewal->pledge->branch);

        $data = [
            'renewal' => $renewal,
            'settings' => $settings,
            'printed_at' => now(),
            'printed_by' => $request->user()->name,
            'barcode_data_uri' => $this->generateBarcodeDataUri($renewal->pledge->pledge_no),
            'multilang_image_uri' => $this->generateMultilangImageUri(
                $settings['company_name_chinese'] ?? '',
                $settings['company_name_tamil'] ?? ''
            ),
            'copy_type' => $request->input('copy_type', 'customer'),
        ];

        $pdf = Pdf::loadView('pdf.renewal-receipt-preprinted', $data);
        $pdf->setPaper([0.0, 0.0, 710.0, 500.0]); // Custom size matching blade template

        $filename = "Renewal-{$renewal->renewal_no}.pdf";
        return response($pdf->output(), 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * Redemption receipt PDF (Pre-Printed Form Style)
     */
    public function redemptionReceiptPdf(Request $request, Redemption $redemption)
    {
        if ($redemption->pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $redemption->load([
            'pledge.customer',
            'pledge.items.category',
            'pledge.items.purity',
            'pledge.branch',
        ]);

        $settings = $this->getCompanySettings($redemption->pledge->branch);

        $data = [
            'redemption' => $redemption,
            'settings' => $settings,
            'printed_at' => now(),
            'printed_by' => $request->user()->name,
            'barcode_data_uri' => $this->generateBarcodeDataUri($redemption->pledge->pledge_no),
            'multilang_image_uri' => $this->generateMultilangImageUri(
                $settings['company_name_chinese'] ?? '',
                $settings['company_name_tamil'] ?? ''
            ),
        ];

        $pdf = Pdf::loadView('pdf.redemption-receipt-preprinted', $data);
        $pdf->setPaper([0.0, 0.0, 710.0, 550.0]); // Match blade layout

        $filename = "Redemption-{$redemption->redemption_no}.pdf";
        return response($pdf->output(), 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
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
