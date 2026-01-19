<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pledge;
use App\Models\Renewal;
use App\Models\Redemption;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class DotMatrixPrintController extends Controller
{
    // Column width for A5 paper (42 characters at 10 CPI)
    private const COL_WIDTH = 42;

    /**
     * Generate dot matrix pledge receipt (plain text)
     */
    public function pledgeReceipt(Request $request, Pledge $pledge): JsonResponse
    {
        if ($pledge->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $validated = $request->validate([
            'copy_type' => 'required|in:office,customer,both',
        ]);

        $pledge->load([
            'customer',
            'items.category',
            'items.purity',
            'items.vault',
            'items.box',
            'branch',
        ]);

        // Get company settings
        $settings = $this->getCompanySettings($pledge->branch);

        $receipt = $this->generatePledgeReceipt($pledge, $settings, $validated['copy_type']);

        // Record print
        try {
            \App\Models\PledgeReceipt::create([
                'pledge_id' => $pledge->id,
                'print_type' => $pledge->receipt_printed ? 'reprint' : 'original',
                'copy_type' => $validated['copy_type'],
                'printer_type' => 'dot_matrix',
                'is_chargeable' => $pledge->receipt_printed ?? false,
                'charge_amount' => ($pledge->receipt_printed ?? false) ? 2.00 : 0,
                'printed_by' => $request->user()->id,
                'printed_at' => now(),
            ]);
        } catch (\Exception $e) {
            // Table may not exist
        }

        $pledge->update([
            'receipt_printed' => true,
            'receipt_print_count' => ($pledge->receipt_print_count ?? 0) + 1,
        ]);

        return $this->success([
            'receipt_text' => $receipt,
            'pledge_no' => $pledge->pledge_no,
            'copy_type' => $validated['copy_type'],
        ]);
    }

    /**
     * Generate dot matrix renewal receipt
     */
    public function renewalReceipt(Request $request, Renewal $renewal): JsonResponse
    {
        if ($renewal->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $renewal->load([
            'pledge.customer',
            'pledge.items.category',
            'pledge.items.purity',
            'pledge.branch',
        ]);

        $settings = $this->getCompanySettings($renewal->pledge->branch);
        $receipt = $this->generateRenewalReceipt($renewal, $settings);

        return $this->success([
            'receipt_text' => $receipt,
            'renewal_no' => $renewal->renewal_no,
        ]);
    }

    /**
     * Generate dot matrix redemption receipt
     */
    public function redemptionReceipt(Request $request, Redemption $redemption): JsonResponse
    {
        if ($redemption->branch_id !== $request->user()->branch_id) {
            return $this->error('Unauthorized', 403);
        }

        $redemption->load([
            'pledge.customer',
            'pledge.items.category',
            'pledge.items.purity',
            'pledge.branch',
        ]);

        $settings = $this->getCompanySettings($redemption->pledge->branch);
        $receipt = $this->generateRedemptionReceipt($redemption, $settings);

        return $this->success([
            'receipt_text' => $receipt,
            'redemption_no' => $redemption->redemption_no,
        ]);
    }

    /**
     * Get company settings with defaults
     */
    private function getCompanySettings($branch): array
    {
        $companySettings = \App\Models\Setting::where('category', 'company')->get();
        $receiptSettings = \App\Models\Setting::where('category', 'receipt')->get();

        $settingsMap = [];
        foreach ($companySettings as $setting) {
            $settingsMap[$setting->key_name] = $setting->value;
        }
        foreach ($receiptSettings as $setting) {
            $settingsMap['receipt_' . $setting->key_name] = $setting->value;
        }

        return [
            'company_name' => $settingsMap['name'] ?? $branch->name ?? 'PAJAK GADAI SDN BHD',
            'license_no' => $settingsMap['license_no'] ?? $branch->license_no ?? 'PG/XXX/2024',
            'address' => $settingsMap['address'] ?? $branch->address ?? '',
            'phone' => $settingsMap['phone'] ?? $branch->phone ?? '',
            'fax' => $settingsMap['fax'] ?? '',
            'business_hours' => $settingsMap['business_hours'] ?? '9.00 pagi - 5.30 petang',
            'business_days' => $settingsMap['business_days'] ?? '(Sabtu - Khamis)',
            'closed_days' => $settingsMap['closed_days'] ?? 'Hari Jumaat & Hari Kelepasan Am Tutup',
            'initial_rate' => $settingsMap['receipt_initial_rate'] ?? '0.50',
            'branch_code' => $branch->code ?? 'HQ',
        ];
    }

    /**
     * Generate pledge receipt text - Malaysian Pawnshop Format
     */
    private function generatePledgeReceipt(Pledge $pledge, array $settings, string $copyType): string
    {
        $lines = [];
        $w = self::COL_WIDTH;
        $customer = $pledge->customer;

        // ============ HEADER ============
        $lines[] = str_repeat('=', $w);
        $lines[] = $this->center('PAJAK GADAI BERLESEN', $w);
        $lines[] = $this->center(strtoupper($settings['company_name']), $w);
        $lines[] = str_repeat('-', $w);

        // Address
        $lines[] = $this->wordWrap($settings['address'], $w);
        if ($settings['phone'] || $settings['fax']) {
            $contact = 'Tel: ' . $settings['phone'];
            if ($settings['fax']) {
                $contact .= ' Fax: ' . $settings['fax'];
            }
            $lines[] = $contact;
        }

        // Business hours
        $lines[] = '';
        $lines[] = 'Waktu Perniagaan:';
        $lines[] = $settings['business_hours'] . ' ' . $settings['business_days'];
        $lines[] = $settings['closed_days'];
        $lines[] = str_repeat('=', $w);
        $lines[] = '';

        // ============ COPY TYPE & PLEDGE NUMBER ============
        $copyLabel = $copyType === 'office' ? 'SALINAN PEJABAT' : 'SALINAN PELANGGAN';
        $lines[] = $this->leftRight($copyLabel, 'NOMBOR SIRI', $w);
        $lines[] = $this->leftRight('', $pledge->pledge_no, $w);
        $lines[] = '';

        // ============ CUSTOMER DETAILS ============
        $lines[] = str_repeat('-', $w);
        $lines[] = 'NAMA:';
        $lines[] = strtoupper($customer->name);
        $lines[] = '';

        // Address
        $lines[] = 'ALAMAT:';
        $address = $this->formatCustomerAddress($customer);
        $lines[] = $this->wordWrap($address, $w);
        $lines[] = '';

        // IC Details Row
        $lines[] = str_repeat('-', $w);
        $icNumber = $this->formatIC($customer->ic_number);
        $birthYear = $this->extractBirthYear($customer);
        $race = $this->getRace($customer);
        $gender = $this->getGender($customer);

        $lines[] = $this->labelValue('NO. KAD PENGENALAN', $icNumber, $w);
        $row2 = sprintf('TAHUN LAHIR: %s   BANGSA: %s', $birthYear, $race);
        $lines[] = $row2;
        $lines[] = sprintf('JANTINA: %s', $gender);
        $lines[] = str_repeat('-', $w);
        $lines[] = '';

        // ============ ITEM DETAILS ============
        $lines[] = 'PERIHAL BARANG YANG DIGADAI:';
        $totalWeight = 0;
        $itemNo = 1;
        foreach ($pledge->items as $item) {
            $itemName = $item->category->name_ms ?? $item->category->name_en ?? 'Barang Kemas';
            $purity = $item->purity->name ?? $item->purity->code ?? '';
            $weight = $item->net_weight ?? 0;
            $totalWeight += $weight;

            $lines[] = sprintf('%d. %s (%s)', $itemNo++, strtoupper($itemName), $purity);
        }
        $lines[] = '';

        // ============ INTEREST & REDEMPTION INFO ============
        $lines[] = str_repeat('-', $w);
        $interestRate = $pledge->interest_rate ?? 2;
        $monthlyInterest = ($pledge->loan_amount ?? 0) * ($interestRate / 100);
        $initialRate = $settings['initial_rate'];

        $lines[] = $this->leftRight('KADAR PENGENALAN:', $initialRate . ' SEN', $w);
        $lines[] = $this->leftRight('KEUNTUNGAN:', 'BULANAN ' . number_format($interestRate, 0) . '%', $w);
        $lines[] = $this->leftRight('MASA PENEBUSAN:', '6 BULAN', $w);
        $lines[] = str_repeat('-', $w);
        $lines[] = '';

        // ============ FINANCIAL DETAILS ============
        $loanAmount = $pledge->loan_amount ?? 0;
        $pledgeDate = $pledge->pledge_date ?? $pledge->created_at;
        $dueDate = $pledge->due_date;

        $lines[] = 'RINGGIT:';
        $lines[] = strtoupper($this->numberToMalayWords($loanAmount)) . ' SAHAJA';
        $lines[] = '';

        // Date row
        $lines[] = str_repeat('-', $w);
        $lines[] = $this->leftRight('TARIKH', 'HARI LAMA', $w);
        $lines[] = $this->leftRight(
            $pledgeDate->format('d/m/Y'),
            $dueDate->format('d/m/Y'),
            $w
        );
        $lines[] = '';

        // Weight and interest
        $lines[] = $this->leftRight(
            'BERAT (LEBIH KURANG):',
            number_format($totalWeight, 2) . 'g',
            $w
        );
        $lines[] = $this->leftRight(
            'FAEDAH BULANAN:',
            number_format($monthlyInterest, 2),
            $w
        );
        $lines[] = str_repeat('-', $w);

        // Loan amount
        $lines[] = '';
        $lines[] = $this->leftRight('PINJAMAN (RM):', number_format($loanAmount, 2), $w);
        $lines[] = str_repeat('=', $w);
        $lines[] = '';

        // ============ TERMS ============
        $lines[] = 'SYARAT-SYARAT:';
        $lines[] = $this->wordWrap('1. Tempoh gadaian adalah 6 bulan.', $w);
        $lines[] = $this->wordWrap('2. Barang tidak ditebus akan dilelong.', $w);
        $lines[] = $this->wordWrap('3. Bawa resit ini semasa menebus.', $w);
        $lines[] = '';

        // ============ FOOTER ============
        $lines[] = str_repeat('=', $w);
        $lines[] = $this->center('Terima kasih', $w);
        $lines[] = $this->center('Sila simpan resit ini', $w);
        $lines[] = str_repeat('=', $w);
        $lines[] = '';
        $lines[] = $this->center('Dicetak: ' . now()->format('d/m/Y H:i:s'), $w);

        return implode("\n", $lines);
    }

    /**
     * Format customer full address
     */
    private function formatCustomerAddress($customer): string
    {
        $parts = array_filter([
            $customer->address_line1,
            $customer->address_line2,
            $customer->postcode . ' ' . $customer->city,
            strtoupper($customer->state ?? ''),
        ]);
        return implode(', ', $parts);
    }

    /**
     * Extract birth year from customer
     */
    private function extractBirthYear($customer): string
    {
        if ($customer->date_of_birth) {
            return $customer->date_of_birth->format('Y');
        }

        // Try to extract from IC number (format: YYMMDD-XX-XXXX)
        $ic = preg_replace('/[^0-9]/', '', $customer->ic_number ?? '');
        if (strlen($ic) >= 6) {
            $yy = substr($ic, 0, 2);
            $year = ((int) $yy > 50) ? '19' . $yy : '20' . $yy;
            return $year;
        }

        return '-';
    }

    /**
     * Get race/ethnicity from customer
     */
    private function getRace($customer): string
    {
        // Check nationality field
        $nationality = strtolower($customer->nationality ?? '');

        if (str_contains($nationality, 'malay'))
            return 'MELAYU';
        if (str_contains($nationality, 'chinese') || str_contains($nationality, 'cina'))
            return 'CINA';
        if (str_contains($nationality, 'indian') || str_contains($nationality, 'india'))
            return 'INDIA';

        // Try to derive from IC number (position 7-8 is state code)
        // This is an approximation - not reliable
        return 'WARGANEGARA';
    }

    /**
     * Get gender in Malay
     */
    private function getGender($customer): string
    {
        $gender = strtolower($customer->gender ?? '');

        if ($gender === 'male' || $gender === 'm' || $gender === 'lelaki') {
            return 'LELAKI';
        }
        if ($gender === 'female' || $gender === 'f' || $gender === 'perempuan') {
            return 'PEREMPUAN';
        }

        return '-';
    }

    /**
     * Left-right aligned text (for labels and values)
     */
    private function leftRight(string $left, string $right, int $width): string
    {
        $left = mb_substr($left, 0, $width - mb_strlen($right) - 1);
        $spaces = $width - mb_strlen($left) - mb_strlen($right);
        return $left . str_repeat(' ', max(1, $spaces)) . $right;
    }

    /**
     * Generate renewal receipt text
     */
    private function generateRenewalReceipt(Renewal $renewal, array $settings): string
    {
        $lines = [];
        $w = self::COL_WIDTH;
        $pledge = $renewal->pledge;

        // Header
        $lines[] = str_repeat('=', $w);
        $lines[] = $this->center('PAJAK GADAI BERLESEN', $w);
        $lines[] = $this->center($settings['company_name'], $w);
        $lines[] = str_repeat('=', $w);
        $lines[] = '';
        $lines[] = $this->center('RESIT PEMBAHARUAN', $w);
        $lines[] = '';

        // Info
        $lines[] = str_repeat('-', $w);
        $lines[] = $this->labelValue('No. Pembaharuan', $renewal->renewal_no, $w);
        $lines[] = $this->labelValue('No. Pajak Asal', $pledge->pledge_no, $w);
        $lines[] = $this->labelValue('Tarikh', $renewal->created_at->format('d/m/Y H:i'), $w);
        $lines[] = $this->labelValue('Tarikh Tamat Baru', $renewal->new_due_date->format('d/m/Y'), $w);
        $lines[] = str_repeat('-', $w);
        $lines[] = '';

        // Customer
        $lines[] = $this->labelValue('Nama', $pledge->customer->name, $w);
        $lines[] = $this->labelValue('No. K/P', $this->formatIC($pledge->customer->ic_number), $w);
        $lines[] = '';

        // Financial
        $lines[] = str_repeat('=', $w);
        $lines[] = $this->labelValue('Nilai Pokok', 'RM ' . number_format($renewal->principal_amount, 2), $w);
        $lines[] = $this->labelValue('Faedah Dibayar', 'RM ' . number_format($renewal->interest_paid, 2), $w);
        $lines[] = str_repeat('-', $w);
        $lines[] = $this->labelValue('JUMLAH BAYAR', 'RM ' . number_format($renewal->total_paid, 2), $w);
        $lines[] = str_repeat('=', $w);
        $lines[] = '';

        // Footer
        $lines[] = $this->center('Terima kasih', $w);
        $lines[] = $this->center('Dicetak: ' . now()->format('d/m/Y H:i:s'), $w);

        return implode("\n", $lines);
    }

    /**
     * Generate redemption receipt text
     */
    private function generateRedemptionReceipt(Redemption $redemption, array $settings): string
    {
        $lines = [];
        $w = self::COL_WIDTH;
        $pledge = $redemption->pledge;

        // Header
        $lines[] = str_repeat('=', $w);
        $lines[] = $this->center('PAJAK GADAI BERLESEN', $w);
        $lines[] = $this->center($settings['company_name'], $w);
        $lines[] = str_repeat('=', $w);
        $lines[] = '';
        $lines[] = $this->center('RESIT TEBUSAN', $w);
        $lines[] = '';

        // Info
        $lines[] = str_repeat('-', $w);
        $lines[] = $this->labelValue('No. Tebusan', $redemption->redemption_no, $w);
        $lines[] = $this->labelValue('No. Pajak', $pledge->pledge_no, $w);
        $lines[] = $this->labelValue('Tarikh', $redemption->created_at->format('d/m/Y H:i'), $w);
        $lines[] = str_repeat('-', $w);
        $lines[] = '';

        // Customer
        $lines[] = $this->labelValue('Nama', $pledge->customer->name, $w);
        $lines[] = $this->labelValue('No. K/P', $this->formatIC($pledge->customer->ic_number), $w);
        $lines[] = '';

        // Items redeemed
        $lines[] = 'BARANG DITEBUS:';
        $itemNo = 1;
        foreach ($pledge->items as $item) {
            $lines[] = sprintf(
                '%d. %s - %s',
                $itemNo++,
                $item->category->name_ms ?? $item->category->name_en,
                number_format($item->net_weight, 3) . 'g'
            );
        }
        $lines[] = '';

        // Financial
        $lines[] = str_repeat('=', $w);
        $lines[] = $this->labelValue('Nilai Pokok', 'RM ' . number_format($redemption->principal_amount, 2), $w);
        $lines[] = $this->labelValue('Faedah', 'RM ' . number_format($redemption->interest_amount, 2), $w);
        $lines[] = str_repeat('-', $w);
        $lines[] = $this->labelValue('JUMLAH BAYAR', 'RM ' . number_format($redemption->total_amount, 2), $w);
        $lines[] = str_repeat('=', $w);
        $lines[] = '';

        // Acknowledgment
        $lines[] = $this->center('PENGESAHAN PENERIMAAN', $w);
        $lines[] = '';
        $lines[] = 'Saya mengesahkan telah menerima';
        $lines[] = 'barang-barang tersebut di atas.';
        $lines[] = '';
        $lines[] = '';
        $lines[] = str_repeat('.', 30);
        $lines[] = 'Tandatangan Pelanggan';
        $lines[] = '';

        // Footer
        $lines[] = str_repeat('=', $w);
        $lines[] = $this->center('Terima kasih', $w);
        $lines[] = $this->center('Dicetak: ' . now()->format('d/m/Y H:i:s'), $w);

        return implode("\n", $lines);
    }

    // ==================== HELPER METHODS ====================

    /**
     * Center text
     */
    private function center(string $text, int $width): string
    {
        $text = mb_substr($text, 0, $width);
        $padding = max(0, $width - mb_strlen($text));
        $leftPad = intval($padding / 2);
        return str_repeat(' ', $leftPad) . $text;
    }

    /**
     * Label-value pair
     */
    private function labelValue(string $label, string $value, int $width): string
    {
        $separator = ': ';
        $labelWidth = mb_strlen($label . $separator);
        $valueWidth = $width - $labelWidth;
        $value = mb_substr($value, 0, $valueWidth);
        return $label . $separator . $value;
    }

    /**
     * Word wrap for long text
     */
    private function wordWrap(string $text, int $width): string
    {
        return wordwrap($text, $width, "\n", true);
    }

    /**
     * Format IC number
     */
    private function formatIC(?string $ic): string
    {
        if (!$ic)
            return '-';
        $ic = preg_replace('/[^0-9]/', '', $ic);
        if (strlen($ic) === 12) {
            return substr($ic, 0, 6) . '-' . substr($ic, 6, 2) . '-' . substr($ic, 8, 4);
        }
        return $ic;
    }

    /**
     * Convert number to Malay words
     */
    private function numberToMalayWords(float $number): string
    {
        $ones = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'lapan', 'sembilan'];
        $tens = ['', 'sepuluh', 'dua puluh', 'tiga puluh', 'empat puluh', 'lima puluh', 'enam puluh', 'tujuh puluh', 'lapan puluh', 'sembilan puluh'];
        $teens = ['sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas', 'tujuh belas', 'lapan belas', 'sembilan belas'];

        $ringgit = intval($number);
        $sen = round(($number - $ringgit) * 100);

        $words = '';

        if ($ringgit >= 1000) {
            $thousands = intval($ringgit / 1000);
            $words .= ($thousands == 1 ? 'seribu' : $this->numberToMalayWords($thousands) . ' ribu');
            $ringgit %= 1000;
            if ($ringgit > 0)
                $words .= ' ';
        }

        if ($ringgit >= 100) {
            $hundreds = intval($ringgit / 100);
            $words .= ($hundreds == 1 ? 'seratus' : $ones[$hundreds] . ' ratus');
            $ringgit %= 100;
            if ($ringgit > 0)
                $words .= ' ';
        }

        if ($ringgit >= 20) {
            $words .= $tens[intval($ringgit / 10)];
            $ringgit %= 10;
            if ($ringgit > 0)
                $words .= ' ' . $ones[$ringgit];
        } elseif ($ringgit >= 10) {
            $words .= $teens[$ringgit - 10];
        } elseif ($ringgit > 0) {
            $words .= $ones[$ringgit];
        }

        $words .= ' ringgit';

        if ($sen > 0) {
            $words .= ' dan ';
            if ($sen >= 20) {
                $words .= $tens[intval($sen / 10)];
                $sen %= 10;
                if ($sen > 0)
                    $words .= ' ' . $ones[$sen];
            } elseif ($sen >= 10) {
                $words .= $teens[$sen - 10];
            } else {
                $words .= $ones[$sen];
            }
            $words .= ' sen';
        }

        return ucfirst(trim($words));
    }
}