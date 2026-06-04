<?php

namespace App\Services\WhatsApp;

use App\Models\Pledge;
use App\Models\Redemption;
use App\Models\Renewal;
use Illuminate\Support\Facades\Log;

/**
 * Builds receipt PDFs (pledge / renewal / redemption) and returns the base64
 * encoded PDF string. This class ONLY builds; it never sends anywhere.
 *
 * The $data arrays, blade view names and paper sizes are copied verbatim from
 * the original controller sendPdfReceipt() methods. They are intentionally NOT
 * unified beyond the shared company-settings bundle, because the per-type data
 * keys differ.
 */
class ReceiptPdfBuilder
{
    public function pledge(Pledge $pledge): string
    {
        set_time_limit(90);

        $settings = $this->buildSettings($pledge->branch);

        // Get terms
        $terms = [];
        try {
            $terms = \App\Models\TermsCondition::getForActivity('pledge', $pledge->branch_id) ?? [];
        }
        catch (\Exception $e) {
            $terms = [];
        }

        // Generate barcode data URI
        $generator = new \Picqer\Barcode\BarcodeGeneratorPNG();
        $barcodeDataUri = 'data:image/png;base64,' . base64_encode(
            $generator->getBarcode($pledge->pledge_no, $generator::TYPE_CODE_128, 4, 100)
        );

        // Generate multilang image URI (Chinese/Tamil company name)
        // Always load static image if it exists — settings may default to empty strings
        $multilangUri = $this->staticMultilangUri();

        $data = [
            'pledge' => $pledge,
            'copy_type' => 'customer',
            'settings' => $settings,
            'terms' => $terms,
            'printed_at' => now(),
            'printed_by' => 'WhatsApp',
            'barcode_data_uri' => $barcodeDataUri,
            'multilang_image_uri' => $multilangUri,
        ];

        Log::info('Generating PDF for pledge ' . $pledge->pledge_no . ' using view pdf.pledge-receipt-preprinted');
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.pledge-receipt-preprinted', $data);
        $pdf->setPaper([0, 0, 710, 450]); // Custom size matching blade template
        $pdfContent = $pdf->output();
        $pdfBase64 = base64_encode($pdfContent);
        Log::info('PDF generated successfully. Size: ' . strlen($pdfContent) . ' bytes, Base64 size: ' . strlen($pdfBase64));

        return $pdfBase64;
    }

    public function renewal(Renewal $renewal): string
    {
        set_time_limit(90);

        $settings = $this->buildSettings($renewal->pledge->branch);

        $terms = [];
        try {
            $terms = \App\Models\TermsCondition::getForActivity('pledge', $renewal->branch_id) ?? [];
        }
        catch (\Exception $e) {
            $terms = [];
        }

        // Load relationships for receipt
        $renewal->load([
            'pledge.customer',
            'pledge.items.category',
            'pledge.branch',
            'interestBreakdown',
            'bank',
            'createdBy:id,name'
        ]);

        // Generate barcode data URI
        $generator = new \Picqer\Barcode\BarcodeGeneratorPNG();
        $barcodeDataUri = 'data:image/png;base64,' . base64_encode(
            $generator->getBarcode($renewal->pledge->pledge_no, $generator::TYPE_CODE_128, 4, 100)
        );

        // Generate multilang image URI (Chinese/Tamil company name)
        // Always load static image if it exists — settings may default to empty strings
        $multilangUri = $this->staticMultilangUri();

        $data = [
            'renewal' => $renewal,
            'pledge' => $renewal->pledge,
            'copy_type' => 'customer',
            'settings' => $settings,
            'terms' => $terms,
            'printed_at' => now(),
            'printed_by' => 'WhatsApp',
            'barcode_data_uri' => $barcodeDataUri,
            'multilang_image_uri' => $multilangUri,
        ];

        Log::info('Generating PDF for renewal ' . $renewal->renewal_no . ' using view pdf.renewal-receipt-preprinted');
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.renewal-receipt-preprinted', $data);
        $pdf->setPaper([0.0, 0.0, 710.0, 450.0]);
        $pdfContent = $pdf->output();
        $pdfBase64 = base64_encode($pdfContent);

        Log::info('PDF generated successfully for renewal. Size: ' . strlen($pdfContent) . ' bytes');

        return $pdfBase64;
    }

    public function redemption(Redemption $redemption): string
    {
        set_time_limit(90);

        $redemption->load([
            'pledge.customer',
            'pledge.items.category',
            'pledge.items.purity',
            'pledge.branch',
        ]);

        $settings = $this->buildSettings($redemption->pledge->branch);

        $printController = app(\App\Http\Controllers\Api\PrintController::class);
        $generator = new \Picqer\Barcode\BarcodeGeneratorPNG();
        $barcodeDataUri = 'data:image/png;base64,' . base64_encode($generator->getBarcode($redemption->pledge->pledge_no, $generator::TYPE_CODE_128, 4, 100));

        $multilangUri = (new \ReflectionMethod($printController, 'generateMultilangImageUri'))->invoke(
            $printController,
            $settings['company_name_chinese'] ?? '',
            $settings['company_name_tamil'] ?? ''
        );

        $data = [
            'redemption' => $redemption,
            'settings' => $settings,
            'printed_at' => now(),
            'printed_by' => 'WhatsApp',
            'barcode_data_uri' => $barcodeDataUri,
            'multilang_image_uri' => $multilangUri,
        ];

        // Generate PDF using pre-printed redemption template
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.redemption-receipt-preprinted', $data);
        $pdf->setPaper([0, 0, 710, 550]); // Match blade layout
        $pdfContent = $pdf->output();
        $pdfBase64 = base64_encode($pdfContent);

        return $pdfBase64;
    }

    /**
     * Build the shared company-settings bundle (with logo resolved to a base64
     * data URI). Branch falls back are sourced from the supplied $branch.
     */
    private function buildSettings($branch): array
    {
        $settingsMap = [];
        try {
            $companySettings = \App\Models\Setting::where('category', 'company')->get();
            $receiptSettings = \App\Models\Setting::where('category', 'receipt')->get();
            foreach ($companySettings as $setting) {
                $settingsMap[$setting->key_name] = $setting->value;
            }
            foreach ($receiptSettings as $setting) {
                $settingsMap['receipt_' . $setting->key_name] = $setting->value;
            }
        }
        catch (\Exception $e) {
            // Settings table may not exist
        }

        // Resolve logo as base64 data URI (avoid HTTP roundtrip which causes DomPDF timeout)
        $logoUrl = $settingsMap['logo'] ?? $settingsMap['logo_url'] ?? $settingsMap['company_logo'] ?? null;
        if ($logoUrl && !str_starts_with($logoUrl, 'data:')) {
            // Convert to local file path and read as base64
            $logoPath = $logoUrl;
            if (str_starts_with($logoPath, 'http')) {
                // Extract path from URL
                $parsed = parse_url($logoPath);
                $logoPath = ltrim($parsed['path'] ?? '', '/');
            }
            $logoPath = ltrim($logoPath, '/');
            // Try to resolve local file path
            $localPath = str_starts_with($logoPath, 'storage/')
                ? storage_path('app/public/' . substr($logoPath, 8))
                : public_path($logoPath);
            if (file_exists($localPath)) {
                $mime = mime_content_type($localPath);
                $logoUrl = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($localPath));
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
            'address' => $settingsMap['address'] ?? $branch->address ?? '',
            'phone' => $settingsMap['phone'] ?? $branch->phone ?? '',
            'phone2' => $settingsMap['phone2'] ?? '',
            'fax' => $settingsMap['fax'] ?? '',
            'business_hours' => $settingsMap['business_hours'] ?? '8.30AM - 6.00PM',
            'business_days' => $settingsMap['business_days'] ?? 'ISNIN - AHAD',
            'closed_days' => $settingsMap['closed_days'] ?? '',
            'redemption_period' => $settingsMap['receipt_redemption_period'] ?? $settingsMap['redemption_period'] ?? '6 BULAN',
            'interest_rate_normal' => $settingsMap['receipt_interest_rate_normal'] ?? $settingsMap['interest_rate_normal'] ?? '1.5',
            'interest_rate_overdue' => $settingsMap['receipt_interest_rate_overdue'] ?? $settingsMap['interest_rate_overdue'] ?? '2.0',
            'insurance_policy_no' => $settingsMap['insurance_policy_no'] ?? '',
            'logo_url' => $logoUrl,
        ];
    }

    /**
     * Resolve the static Chinese/Tamil multilang header image as a base64 data URI.
     */
    private function staticMultilangUri(): ?string
    {
        $staticImage = storage_path('fonts/multilang_header.png');
        if (file_exists($staticImage)) {
            $mime = mime_content_type($staticImage);
            return 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($staticImage));
        }
        return null;
    }
}
