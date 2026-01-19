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
     * Get company settings
     */
    private function getCompanySettings($branch): array
    {
        $companySettings = \App\Models\Setting::where('category', 'company')->get();
        $settingsMap = [];
        foreach ($companySettings as $setting) {
            $settingsMap[$setting->key_name] = $setting->value;
        }

        return [
            'company_name' => $settingsMap['name'] ?? $branch->name ?? 'PAJAK GADAI SDN BHD',
            'license_no' => $settingsMap['license_no'] ?? $branch->license_no ?? '',
            'address' => $settingsMap['address'] ?? $branch->address ?? '',
            'phone' => $settingsMap['phone'] ?? $branch->phone ?? '',
        ];
    }

    /**
     * Generate pledge receipt text
     */
    private function generatePledgeReceipt(Pledge $pledge, array $settings, string $copyType): string
    {
        $lines = [];
        $w = self::COL_WIDTH;

        // Header
        $lines[] = str_repeat('=', $w);
        $lines[] = $this->center('PAJAK GADAI BERLESEN', $w);
        $lines[] = $this->center($settings['company_name'], $w);
        $lines[] = $this->center('No. Lesen: ' . $settings['license_no'], $w);
        $lines[] = str_repeat('-', $w);
        $lines[] = $this->wordWrap($settings['address'], $w);
        $lines[] = $this->center('Tel: ' . $settings['phone'], $w);
        $lines[] = str_repeat('=', $w);
        $lines[] = '';

        // Receipt Type
        $copyLabel = $copyType === 'office' ? '** SALINAN PEJABAT **' : '** SALINAN PELANGGAN **';
        $lines[] = $this->center($copyLabel, $w);
        $lines[] = $this->center('RESIT PAJAK GADAI', $w);
        $lines[] = '';

        // Pledge Info
        $lines[] = str_repeat('-', $w);
        $lines[] = $this->labelValue('No. Pajak', $pledge->pledge_no, $w);
        $lines[] = $this->labelValue('Tarikh', $pledge->created_at->format('d/m/Y H:i'), $w);
        $lines[] = $this->labelValue('Tarikh Tamat', $pledge->due_date->format('d/m/Y'), $w);
        $lines[] = str_repeat('-', $w);
        $lines[] = '';

        // Customer Info
        $lines[] = 'MAKLUMAT PENGGADAI:';
        $lines[] = $this->labelValue('Nama', $pledge->customer->name, $w);
        $lines[] = $this->labelValue('No. K/P', $this->formatIC($pledge->customer->ic_number), $w);
        $lines[] = $this->labelValue('No. Tel', $pledge->customer->phone ?? '-', $w);
        $lines[] = '';

        // Items
        $lines[] = str_repeat('-', $w);
        $lines[] = 'BUTIRAN BARANG GADAIAN:';
        $lines[] = str_repeat('-', $w);

        $itemNo = 1;
        foreach ($pledge->items as $item) {
            $lines[] = sprintf('%d. %s', $itemNo++, $item->category->name_ms ?? $item->category->name_en);
            $lines[] = $this->labelValue('   Ketulenan', $item->purity->name ?? $item->purity->code, $w);
            $lines[] = $this->labelValue('   Berat', number_format($item->net_weight, 3) . ' gram', $w);
            if ($item->vault || $item->box) {
                $location = ($item->vault->name ?? '') . ' / ' . ($item->box->name ?? $item->box->box_number ?? '');
                $lines[] = $this->labelValue('   Simpanan', trim($location, ' /'), $w);
            }
            $lines[] = '';
        }

        // Financial Summary
        $lines[] = str_repeat('=', $w);
        $lines[] = 'MAKLUMAT KEWANGAN:';
        $lines[] = str_repeat('-', $w);
        $lines[] = $this->labelValue('Nilai Marhun', 'RM ' . number_format($pledge->principal_amount, 2), $w);
        $lines[] = $this->labelValue('Kadar Faedah', $pledge->interest_rate . '% sebulan', $w);
        $lines[] = str_repeat('-', $w);
        $lines[] = '';

        // Amount in words
        $lines[] = 'JUMLAH PINJAMAN:';
        $lines[] = $this->center('RM ' . number_format($pledge->principal_amount, 2), $w);
        $lines[] = $this->center('(' . $this->numberToMalayWords($pledge->principal_amount) . ')', $w);
        $lines[] = '';

        // Terms
        $lines[] = str_repeat('-', $w);
        $lines[] = 'SYARAT-SYARAT:';
        $lines[] = $this->wordWrap('1. Tempoh gadaian adalah 6 bulan dari tarikh pajak.', $w);
        $lines[] = $this->wordWrap('2. Barang yang tidak ditebus dalam tempoh yang ditetapkan akan dilelong.', $w);
        $lines[] = $this->wordWrap('3. Resit ini mestilah dibawa semasa menebus barang.', $w);
        $lines[] = '';

        // Footer
        $lines[] = str_repeat('=', $w);
        $lines[] = $this->center('Terima kasih atas sokongan anda', $w);
        $lines[] = $this->center('Sila simpan resit ini dengan baik', $w);
        $lines[] = str_repeat('=', $w);
        $lines[] = '';
        $lines[] = $this->center('Dicetak: ' . now()->format('d/m/Y H:i:s'), $w);

        return implode("\n", $lines);
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