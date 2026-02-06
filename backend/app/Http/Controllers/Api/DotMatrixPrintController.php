<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pledge;
use App\Models\Renewal;
use App\Models\Redemption;
use App\Models\TermsCondition;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;

class DotMatrixPrintController extends Controller
{
    /**
     * Generate pledge receipt - Malaysian Pawnshop Format
     * Returns HTML that matches the original blue form design
     * A5 Landscape: 210mm x 148mm - Exactly 2 pages (Receipt + Terms)
     */
    public function pledgeReceipt(Request $request, Pledge $pledge): JsonResponse
    {
        try {
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

            // Get company settings including logo
            $settings = $this->getCompanySettings($pledge->branch);

            $receiptHtml = $this->generatePledgeReceiptHtml($pledge, $settings, $validated['copy_type']);
            $termsHtml = $this->generateTermsPageHtml($pledge, $settings);

            // Record print (optional - wrapped in try-catch)
            try {
                if (class_exists('\App\Models\PledgeReceipt')) {
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
                }
            } catch (\Exception $e) {
                // Table may not exist - continue silently
            }

            $pledge->update([
                'receipt_printed' => true,
                'receipt_print_count' => ($pledge->receipt_print_count ?? 0) + 1,
            ]);

            return $this->success([
                'receipt_text' => $receiptHtml,
                'terms_text' => $termsHtml,
                'pledge_no' => $pledge->pledge_no,
                'copy_type' => $validated['copy_type'],
                'orientation' => 'landscape',
                'format' => 'html',
            ]);

        } catch (\Exception $e) {
            \Log::error('DotMatrix Print Error: ' . $e->getMessage());
            return $this->error('Print error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Bulk print Terms & Conditions pages only
     * For pre-printing the back side of receipts
     * @param Request $request - count: number of pages to print (default 10)
     */
    public function bulkTermsPages(Request $request): JsonResponse
    {
        try {
            $count = min($request->input('count', 10), 50); // Max 50 pages at once
            $branch = $request->user()->branch;
            $settings = $this->getCompanySettings($branch);

            // Create a dummy pledge object for the terms page
            $dummyPledge = new \stdClass();
            $dummyPledge->loan_amount = 1000; // Dummy amount for interest calculation

            // Generate one terms page HTML
            $termsHtml = $this->generateTermsPageHtml(new Pledge(), $settings);

            // Add page-break-after style to terms-page for bulk printing
            $termsHtml = str_replace('.terms-page{', '.terms-page{page-break-after:always;', $termsHtml);

            // Build bulk HTML with multiple copies - just concatenate, no wrapper divs
            $bulkHtml = '';
            for ($i = 0; $i < $count; $i++) {
                $bulkHtml .= $termsHtml;
            }

            return $this->success([
                'terms_html' => $bulkHtml,
                'count' => $count,
                'format' => 'html',
                'paper_size' => 'A5',
                'orientation' => 'landscape',
            ]);

        } catch (\Exception $e) {
            \Log::error('Bulk Terms Print Error: ' . $e->getMessage());
            return $this->error('Print error: ' . $e->getMessage(), 500);
        }
    }


    /**
     * Generate renewal receipt - Malaysian Pawnshop Format
     * Returns HTML that matches the original blue form design
     * A5 Landscape: 210mm x 148mm - Exactly 2 pages (Receipt + Terms)
     */
    public function renewalReceipt(Request $request, Renewal $renewal): JsonResponse
    {
        try {
            // Load the renewal with its relationships
            $renewal->load([
                'pledge.customer',
                'pledge.items.category',
                'pledge.items.purity',
                'pledge.branch',
                'createdBy',
            ]);

            $pledge = $renewal->pledge;

            if (!$pledge) {
                return $this->error('Pledge not found for this renewal', 404);
            }

            if ($pledge->branch_id !== $request->user()->branch_id) {
                return $this->error('Unauthorized', 403);
            }

            $validated = $request->validate([
                'copy_type' => 'sometimes|in:office,customer,both',
            ]);

            $copyType = $validated['copy_type'] ?? 'customer';

            // Get company settings including logo
            $settings = $this->getCompanySettings($pledge->branch);

            $receiptHtml = $this->generateRenewalReceiptHtml($renewal, $pledge, $settings, $copyType);
            $termsHtml = $this->generateTermsPageHtml($pledge, $settings);

            return $this->success([
                'receipt_text' => $receiptHtml,
                'terms_text' => $termsHtml,
                'renewal_no' => $renewal->renewal_no,
                'copy_type' => $copyType,
                'orientation' => 'landscape',
                'format' => 'html',
            ]);

        } catch (\Exception $e) {
            \Log::error('DotMatrix Renewal Print Error: ' . $e->getMessage());
            return $this->error('Print error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Generate styled HTML renewal receipt - Page 1 of 2
     */
    private function generateRenewalReceiptHtml(Renewal $renewal, Pledge $pledge, array $settings, string $copyType): string
    {
        $customer = $pledge->customer;

        // Renewal amounts
        $interestAmount = $renewal->interest_amount ?? 0;
        $handlingFee = $renewal->handling_fee ?? 0;
        $totalPaid = $renewal->total_amount ?? ($interestAmount + $handlingFee);
        $loanAmount = $pledge->loan_amount ?? 0;
        $renewalMonths = $renewal->renewal_months ?? 1;

        // Dates
        $renewalDate = $renewal->created_at ?? now();
        if (is_string($renewalDate))
            $renewalDate = Carbon::parse($renewalDate);

        $previousDueDate = $renewal->previous_due_date ?? $pledge->due_date;
        if (is_string($previousDueDate))
            $previousDueDate = Carbon::parse($previousDueDate);

        $newDueDate = $renewal->new_due_date ?? $pledge->due_date;
        if (is_string($newDueDate))
            $newDueDate = Carbon::parse($newDueDate);

        $icNumber = $this->formatIC($customer->ic_number ?? '');
        $address = $this->formatCustomerAddress($customer);
        $copyLabel = $copyType === 'office' ? 'SALINAN PEJABAT' : 'SALINAN PELANGGAN';

        // Logo HTML
        $logoHtml = '';
        if (!empty($settings['logo_url'])) {
            $logoHtml = '<img src="' . htmlspecialchars($settings['logo_url']) . '" class="logo" alt="Logo" onerror="this.style.display=\'none\'">';
        }

        // Interest breakdown
        $interestBreakdownHtml = '';
        $interestBreakdown = $renewal->interest_breakdown ?? [];
        if (is_string($interestBreakdown)) {
            $interestBreakdown = json_decode($interestBreakdown, true) ?? [];
        }

        if (!empty($interestBreakdown)) {
            foreach ($interestBreakdown as $idx => $month) {
                $monthNum = $idx + 1;
                $rate = $month['rate'] ?? 0.5;
                $amount = $month['amount'] ?? 0;
                $interestBreakdownHtml .= "<div class='breakdown-row'><span>Bulan {$monthNum} ({$rate}%)</span><span>RM " . $this->formatNumber($amount) . "</span></div>";
            }
        }

        // Payment method
        $paymentMethod = ucfirst($renewal->payment_method ?? 'Cash');

        // Get pledge items
        $items = $pledge->items ?? collect();
        $itemCount = $items->count();
        $totalWeight = $items->sum('net_weight') ?: $items->sum('weight');

        // Build items HTML
        $itemsHtml = '';
        foreach ($items as $item) {
            $category = $item->category->name ?? $item->category_name ?? 'Item';
            $purity = $item->purity->code ?? $item->purity_code ?? $item->purity ?? '';
            $weight = $this->formatNumber($item->net_weight ?? $item->weight ?? 0, 2);
            $itemsHtml .= "<div class='item-line'>{$category} {$purity} - {$weight}g</div>";
        }
        if (empty($itemsHtml)) {
            $itemsHtml = '<div class="item-line">-</div>';
        }

        return <<<HTML
<div class="receipt">
    <div class="header">
        <div class="header-left">
            {$logoHtml}
            <div class="company-info">
                <div class="company-name">{$settings['company_name']}</div>
                <div class="company-address">{$settings['address']}</div>
                <div class="company-phone">📞 {$settings['phone']}</div>
            </div>
        </div>
        <div class="header-right">
            <div class="receipt-type">RESIT PEMBAHARUAN<br>RENEWAL RECEIPT</div>
            <div class="receipt-no">{$renewal->renewal_no}</div>
        </div>
    </div>

    <div class="main-content">
        <div class="left-section">
            <div class="section-title">Butiran Gadaian / Pledge Details</div>
            <div class="info-grid">
                <div class="info-row"><span class="label">No. Tiket:</span><span class="value">{$pledge->pledge_no}</span></div>
                <div class="info-row"><span class="label">Nama:</span><span class="value">{$customer->name}</span></div>
                <div class="info-row"><span class="label">No. K/P:</span><span class="value">{$icNumber}</span></div>
                <div class="info-row"><span class="label">Alamat:</span><span class="value">{$address}</span></div>
            </div>
            
            <div class="section-title">Butiran Pinjaman / Loan Details</div>
            <div class="info-grid">
                <div class="info-row"><span class="label">Jumlah Pinjaman:</span><span class="value amount">RM {$this->formatNumber($loanAmount)}</span></div>
                <div class="info-row"><span class="label">Tempoh Pembaharuan:</span><span class="value">{$renewalMonths} Bulan</span></div>
            </div>
            
            <div class="section-title">Barang Diperbaharui / Items Renewed ({$itemCount})</div>
            <div class="items-box">{$itemsHtml}</div>
        </div>
        
        <div class="right-section">
            <div class="section-title">Bayaran / Payment</div>
            <div class="breakdown-box">
                {$interestBreakdownHtml}
                <div class="breakdown-row total"><span>Jumlah Faedah / Interest:</span><span>RM {$this->formatNumber($interestAmount)}</span></div>
            </div>
            
            <div class="dates-box">
                <div class="date-item">
                    <div class="date-label">Tarikh Pembaharuan</div>
                    <div class="date-value">{$renewalDate->format('d/m/Y')}</div>
                </div>
                <div class="date-item highlight">
                    <div class="date-label">Tarikh Tamat Baru</div>
                    <div class="date-value">{$newDueDate->format('d/m/Y')}</div>
                </div>
            </div>
            
            <div class="total-box">
                <div class="total-label">JUMLAH DIBAYAR / TOTAL PAID</div>
                <div class="total-amount">RM {$this->formatNumber($totalPaid)}</div>
                <div class="payment-method">Kaedah: {$paymentMethod}</div>
            </div>
        </div>
    </div>

    <div class="footer">
        <div class="footer-notice">
            <p>Sila simpan resit ini sebagai bukti pembayaran.</p>
            <p>Please keep this receipt as proof of payment.</p>
        </div>
        <div class="copy-label">{$copyLabel}</div>
    </div>
</div>
<style>
@page{size:A5 landscape;margin:3mm}*{margin:0;padding:0;box-sizing:border-box}
.receipt{width:202mm;height:140mm;padding:4mm;font-family:Arial,sans-serif;font-size:10px;color:#1a4a7a;line-height:1.3;background:#fff;border:2px solid #1a4a7a}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a4a7a;padding-bottom:3mm;margin-bottom:3mm}
.header-left{display:flex;gap:3mm;align-items:flex-start}
.logo{height:14mm;width:auto;max-width:18mm;object-fit:contain}
.company-info{flex:1}
.company-name{font-size:14px;font-weight:bold;color:#c41e3a}
.company-address{font-size:9px;margin:1mm 0}
.company-phone{font-size:10px;font-weight:bold}
.header-right{text-align:right}
.receipt-type{font-size:13px;font-weight:bold;color:#c41e3a;margin-bottom:2mm}
.receipt-no{font-size:16px;font-weight:bold;font-family:'Courier New',monospace;padding:2mm 4mm;border:2px solid #c41e3a;background:#fff8f8}
.main-content{display:flex;gap:4mm}
.left-section{flex:1}
.right-section{width:75mm;min-width:75mm}
.section-title{background:#1a4a7a;color:white;padding:2mm;font-weight:bold;font-size:10px;margin-bottom:2mm}
.info-grid{padding:2mm;border:1px solid #ddd;margin-bottom:3mm}
.info-row{display:flex;margin-bottom:1.5mm}
.label{font-weight:bold;width:35mm;flex-shrink:0}
.value{flex:1}
.value.amount{font-weight:bold;font-size:12px;color:#c41e3a}
.items-box{border:1px solid #1a4a7a;padding:2mm;min-height:15mm;max-height:25mm;overflow:hidden;margin-bottom:3mm}
.item-line{font-size:9px;margin-bottom:1mm;line-height:1.3}
.breakdown-box{border:1px solid #1a4a7a;padding:2mm;margin-bottom:3mm}
.breakdown-row{display:flex;justify-content:space-between;padding:1mm 0;font-size:9px}
.breakdown-row.total{border-top:1px solid #1a4a7a;margin-top:1mm;padding-top:2mm;font-weight:bold}
.dates-box{display:flex;gap:3mm;margin-bottom:3mm}
.date-item{flex:1;border:1px solid #1a4a7a;padding:2mm;text-align:center}
.date-item.highlight{background:#e8f5e9;border-color:#4caf50}
.date-label{font-size:8px;color:#666}
.date-value{font-size:12px;font-weight:bold}
.date-item.highlight .date-value{color:#2e7d32}
.total-box{background:#fffde8;border:2px solid #d4a800;padding:3mm;text-align:center}
.total-label{font-size:10px;font-weight:bold;margin-bottom:1mm}
.total-amount{font-size:18px;font-weight:bold;color:#c41e3a}
.payment-method{font-size:9px;color:#666;margin-top:1mm}
.footer{margin-top:3mm;padding-top:2mm;border-top:1px solid #1a4a7a;display:flex;justify-content:space-between;align-items:flex-end}
.footer-notice{font-size:8px;color:#666}
.copy-label{font-size:11px;font-weight:bold;color:#c41e3a}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
HTML;
    }

    /**
     * Generate redemption receipt - Malaysian Pawnshop Format
     * Returns HTML that matches the original blue form design
     * A5 Landscape: 210mm x 148mm - Exactly 2 pages (Receipt + Terms)
     */
    public function redemptionReceipt(Request $request, $redemption): JsonResponse
    {
        try {
            // Find redemption by ID or redemption_no
            if (is_numeric($redemption)) {
                $redemption = Redemption::find($redemption);
            } else {
                $redemption = Redemption::where('redemption_no', $redemption)->first();
            }

            if (!$redemption) {
                return $this->error('Redemption not found', 404);
            }

            // Load the redemption with its relationships
            $redemption->load([
                'pledge.customer',
                'pledge.items.category',
                'pledge.items.purity',
                'pledge.branch',
                'createdBy',
            ]);

            $pledge = $redemption->pledge;

            if (!$pledge) {
                return $this->error('Pledge not found for this redemption', 404);
            }

            if ($pledge->branch_id !== $request->user()->branch_id) {
                return $this->error('Unauthorized', 403);
            }

            $validated = $request->validate([
                'copy_type' => 'sometimes|in:office,customer,both',
            ]);

            $copyType = $validated['copy_type'] ?? 'customer';

            // Get company settings including logo
            $settings = $this->getCompanySettings($pledge->branch);

            $receiptHtml = $this->generateRedemptionReceiptHtml($redemption, $pledge, $settings, $copyType);
            $termsHtml = $this->generateTermsPageHtml($pledge, $settings);

            return $this->success([
                'receipt_text' => $receiptHtml,
                'terms_text' => $termsHtml,
                'redemption_no' => $redemption->redemption_no,
                'copy_type' => $copyType,
                'orientation' => 'landscape',
                'format' => 'html',
            ]);

        } catch (\Exception $e) {
            \Log::error('DotMatrix Redemption Print Error: ' . $e->getMessage());
            return $this->error('Print error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Generate styled HTML redemption receipt - Page 1 of 2
     */
    private function generateRedemptionReceiptHtml(Redemption $redemption, Pledge $pledge, array $settings, string $copyType): string
    {
        $customer = $pledge->customer;

        // Redemption amounts
        $principal = $redemption->principal_amount ?? $pledge->loan_amount ?? 0;
        $interestAmount = $redemption->interest_amount ?? 0;
        $handlingFee = $redemption->handling_fee ?? 0;
        $totalPaid = $redemption->total_payable ?? ($principal + $interestAmount + $handlingFee);
        $interestMonths = $redemption->interest_months ?? 1;

        // Dates
        $pledgeDate = $pledge->pledge_date ?? $pledge->created_at;
        if (is_string($pledgeDate))
            $pledgeDate = Carbon::parse($pledgeDate);

        $redemptionDate = $redemption->created_at ?? now();
        if (is_string($redemptionDate))
            $redemptionDate = Carbon::parse($redemptionDate);

        $icNumber = $this->formatIC($customer->ic_number ?? '');
        $address = $this->formatCustomerAddress($customer);
        $copyLabel = $copyType === 'office' ? 'SALINAN PEJABAT' : 'SALINAN PELANGGAN';

        // Logo HTML
        $logoHtml = '';
        if (!empty($settings['logo_url'])) {
            $logoHtml = '<img src="' . htmlspecialchars($settings['logo_url']) . '" class="logo" alt="Logo" onerror="this.style.display=\'none\'">';
        }

        // Build items list
        $itemsHtml = $this->buildItemsHtml($pledge->items);
        $itemCount = count($pledge->items);

        // Total weight
        $totalWeight = 0;
        foreach ($pledge->items as $item) {
            $totalWeight += $item->net_weight ?? $item->gross_weight ?? 0;
        }

        // Payment method
        $paymentMethod = ucfirst($redemption->payment_method ?? 'Cash');

        return <<<HTML
<div class="receipt">
    <div class="header">
        <div class="header-left">
            {$logoHtml}
            <div class="company-info">
                <div class="company-name">{$settings['company_name']}</div>
                <div class="company-address">{$settings['address']}</div>
                <div class="company-phone">📞 {$settings['phone']}</div>
            </div>
        </div>
        <div class="header-right">
            <div class="receipt-type">RESIT PENEBUSAN<br>REDEMPTION RECEIPT</div>
            <div class="receipt-no">{$redemption->redemption_no}</div>
        </div>
    </div>

    <div class="main-content">
        <div class="left-section">
            <div class="section-title">Butiran Gadaian / Pledge Details</div>
            <div class="info-grid">
                <div class="info-row"><span class="label">No. Tiket:</span><span class="value">{$pledge->pledge_no}</span></div>
                <div class="info-row"><span class="label">Nama:</span><span class="value">{$customer->name}</span></div>
                <div class="info-row"><span class="label">No. K/P:</span><span class="value">{$icNumber}</span></div>
                <div class="info-row"><span class="label">Alamat:</span><span class="value">{$address}</span></div>
            </div>
            
            <div class="section-title">Barang Ditebus / Items Redeemed ({$itemCount})</div>
            <div class="items-box">{$itemsHtml}</div>
        </div>
        
        <div class="right-section">
            <div class="section-title">Butiran Bayaran / Payment Details</div>
            <div class="breakdown-box">
                <div class="breakdown-row"><span>Pinjaman Pokok / Principal:</span><span>RM {$this->formatNumber($principal)}</span></div>
                <div class="breakdown-row"><span>Faedah ({$interestMonths} bulan) / Interest:</span><span>RM {$this->formatNumber($interestAmount)}</span></div>
                <div class="breakdown-row total"><span>Jumlah Dibayar / Total Paid:</span><span>RM {$this->formatNumber($totalPaid)}</span></div>
            </div>
            
            <div class="dates-box">
                <div class="date-item">
                    <div class="date-label">Tarikh Pajak</div>
                    <div class="date-value">{$pledgeDate->format('d/m/Y')}</div>
                </div>
                <div class="date-item highlight">
                    <div class="date-label">Tarikh Tebus</div>
                    <div class="date-value">{$redemptionDate->format('d/m/Y')}</div>
                </div>
            </div>
            
            <div class="released-box">
                <div class="released-icon">✓</div>
                <div class="released-text">{$itemCount} BARANG DITEBUS<br><span>{$itemCount} ITEM(S) RELEASED</span></div>
            </div>
            
            <div class="weight-box">
                <span>Jumlah Berat / Total Weight:</span>
                <span class="weight-value">{$this->formatNumber($totalWeight, 2)}g</span>
            </div>
        </div>
    </div>

    <div class="footer">
        <div class="footer-notice">
            <p>Sila periksa barang anda sebelum meninggalkan kedai.</p>
            <p>Please check your items before leaving the shop.</p>
        </div>
        <div class="copy-label">{$copyLabel}</div>
    </div>
</div>
<style>
@page{size:A5 landscape;margin:3mm}*{margin:0;padding:0;box-sizing:border-box}
.receipt{width:202mm;height:140mm;padding:4mm;font-family:Arial,sans-serif;font-size:10px;color:#1a4a7a;line-height:1.3;background:#fff;border:2px solid #1a4a7a}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a4a7a;padding-bottom:3mm;margin-bottom:3mm}
.header-left{display:flex;gap:3mm;align-items:flex-start}
.logo{height:14mm;width:auto;max-width:18mm;object-fit:contain}
.company-info{flex:1}
.company-name{font-size:14px;font-weight:bold;color:#c41e3a}
.company-address{font-size:9px;margin:1mm 0}
.company-phone{font-size:10px;font-weight:bold}
.header-right{text-align:right}
.receipt-type{font-size:13px;font-weight:bold;color:#2e7d32;margin-bottom:2mm}
.receipt-no{font-size:16px;font-weight:bold;font-family:'Courier New',monospace;padding:2mm 4mm;border:2px solid #2e7d32;background:#e8f5e9}
.main-content{display:flex;gap:4mm}
.left-section{flex:1}
.right-section{width:75mm;min-width:75mm}
.section-title{background:#1a4a7a;color:white;padding:2mm;font-weight:bold;font-size:10px;margin-bottom:2mm}
.info-grid{padding:2mm;border:1px solid #ddd;margin-bottom:3mm}
.info-row{display:flex;margin-bottom:1.5mm}
.label{font-weight:bold;width:25mm;flex-shrink:0}
.value{flex:1}
.items-box{border:1px solid #1a4a7a;padding:2mm;min-height:20mm;max-height:28mm;overflow:hidden}
.items-columns{display:flex;gap:3mm}
.items-col{flex:1;min-width:0}
.item-line{font-size:9px;margin-bottom:0.8mm;line-height:1.2}
.breakdown-box{border:1px solid #1a4a7a;padding:2mm;margin-bottom:3mm}
.breakdown-row{display:flex;justify-content:space-between;padding:1mm 0;font-size:9px}
.breakdown-row.total{border-top:1px solid #1a4a7a;margin-top:1mm;padding-top:2mm;font-weight:bold;font-size:11px}
.dates-box{display:flex;gap:3mm;margin-bottom:3mm}
.date-item{flex:1;border:1px solid #1a4a7a;padding:2mm;text-align:center}
.date-item.highlight{background:#e8f5e9;border-color:#4caf50}
.date-label{font-size:8px;color:#666}
.date-value{font-size:11px;font-weight:bold}
.date-item.highlight .date-value{color:#2e7d32}
.released-box{background:#e8f5e9;border:2px solid #4caf50;padding:3mm;text-align:center;margin-bottom:3mm;display:flex;align-items:center;justify-content:center;gap:2mm}
.released-icon{font-size:24px;color:#2e7d32}
.released-text{font-size:11px;font-weight:bold;color:#2e7d32}
.released-text span{font-size:9px;font-weight:normal;color:#666}
.weight-box{display:flex;justify-content:space-between;padding:2mm;border:1px solid #1a4a7a;font-size:10px}
.weight-value{font-weight:bold}
.footer{margin-top:3mm;padding-top:2mm;border-top:1px solid #1a4a7a;display:flex;justify-content:space-between;align-items:flex-end}
.footer-notice{font-size:8px;color:#666}
.copy-label{font-size:11px;font-weight:bold;color:#2e7d32}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
HTML;
    }

    /**
     * Get company settings with defaults - INCLUDING LOGO
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
        } catch (\Exception $e) {
            // Settings table may not exist - use defaults
        }

        // Get logo URL - check multiple possible keys
        $logoUrl = $settingsMap['logo'] ?? $settingsMap['logo_url'] ?? $settingsMap['company_logo'] ?? null;

        // If logo is a relative path, make it absolute
        if ($logoUrl && !str_starts_with($logoUrl, 'http') && !str_starts_with($logoUrl, 'data:')) {
            $path = ltrim($logoUrl, '/');
            if (str_starts_with($path, 'storage/')) {
                $logoUrl = url($path);
            } else {
                $logoUrl = url('storage/' . $path);
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
            'logo_url' => $logoUrl, // Logo URL or null - shows only if exists
        ];
    }

    /**
     * Generate styled HTML receipt - Page 1 of 2
     * FIXED: Proper A5 Landscape sizing - fits exactly in 1 page
     */
    private function generatePledgeReceiptHtml(Pledge $pledge, array $settings, string $copyType): string
    {
        $customer = $pledge->customer;
        $loanAmount = $pledge->loan_amount ?? 0;
        $monthlyInterest = $loanAmount * (floatval($settings['interest_rate_normal']) / 100);

        $totalWeight = 0;
        foreach ($pledge->items as $item) {
            $totalWeight += $item->net_weight ?? $item->gross_weight ?? 0;
        }

        $itemsHtml = $this->buildItemsHtml($pledge->items);

        $pledgeDate = $pledge->pledge_date ?? $pledge->created_at;
        if (is_string($pledgeDate))
            $pledgeDate = Carbon::parse($pledgeDate);
        $dueDate = $pledge->due_date;
        if (is_string($dueDate))
            $dueDate = Carbon::parse($dueDate);

        $icNumber = $this->formatIC($customer->ic_number ?? '');
        $citizenship = $this->getCitizenship($customer);
        $race = $this->getRace($customer);
        $birthYear = $this->extractBirthYear($customer);
        $age = $this->calculateAge($customer);
        $gender = $this->getGender($customer);
        $address = $this->formatCustomerAddress($customer);
        $amountWords = strtoupper($this->numberToMalayWords($loanAmount));
        $copyLabel = $copyType === 'office' ? 'SALINAN PEJABAT' : 'SALINAN PELANGGAN';
        $catatan = $pledge->reference_no ?? $pledge->notes ?? '';

        // Logo HTML - only show if exists in settings
        $logoHtml = '';
        if (!empty($settings['logo_url'])) {
            $logoHtml = '<img src="' . htmlspecialchars($settings['logo_url']) . '" class="logo" alt="Logo" onerror="this.style.display=\'none\'">';
        }

        // Established badge - only show if year exists
        $estHtml = '';
        if (!empty($settings['established_year'])) {
            $estHtml = '<div class="established">SEJAK<br>' . htmlspecialchars($settings['established_year']) . '</div>';
        }

        return <<<HTML
<div class="receipt">
    <div class="header">
        <div class="header-left">
            {$logoHtml}
            <div class="company-info">
                <div class="company-name">{$settings['company_name']} <span>({$settings['registration_no']})</span></div>
                <div class="company-multilang">{$settings['company_name_chinese']} {$settings['company_name_tamil']}</div>
                <div class="company-address">{$settings['address']}</div>
            </div>
        </div>
        <div class="header-right">
            {$estHtml}
            <div class="phone-box">📞 {$settings['phone']}</div>
            <div class="business-hours">BUKA 7 HARI<br>{$settings['business_days']} : {$settings['business_hours']}<br>{$settings['closed_days']}</div>
        </div>
    </div>

    <div class="main-content">
        <div class="left-section">
            <div class="section-header">Perihal terperinci artikel yang digadai:-</div>
            <div class="items-box">{$itemsHtml}</div>
            <div class="section-header">Butir-butir terperinci mengenai pemajak gadai:-</div>
            <div class="customer-row"><span class="customer-label">No. Kad Pengenalan:</span><span class="customer-value">{$icNumber}</span></div>
            <div class="customer-row"><span class="customer-label">Nama:</span><span class="customer-value">{$customer->name}</span></div>
            <div class="customer-row">
                <span class="customer-label">Kerakyatan:</span><span class="customer-value">{$citizenship}</span>
                <span class="customer-label">Tahun Lahir:</span><span class="customer-value">{$birthYear} ({$age})</span>
                <span class="customer-label">Jantina:</span><span class="customer-value">{$gender}</span>
            </div>
            <div class="customer-row"><span class="customer-label">Alamat:</span><span class="customer-value" style="flex:1;">{$address}</span></div>
        </div>
        <div class="right-section">
            <div class="ticket-box"><div class="ticket-label">NO. TIKET:</div><div class="ticket-number">{$pledge->pledge_no}</div></div>
            <div class="info-box"><div class="info-row"><span>CAJ PENGENDALIAN</span><span>TEMPOH TAMAT</span></div><div class="info-row"><b>{$settings['handling_fee']}</b><b>{$settings['redemption_period']}</b></div></div>
            <div class="info-box"><div style="font-weight:bold;">KADAR FAEDAH BULANAN</div><div>{$settings['interest_rate_normal']}% Sebulan : Dalam tempoh 6 bulan</div><div>{$settings['interest_rate_overdue']}% Sebulan : Lepas tempoh 6 bulan</div></div>
            <div class="catatan-box"><div class="catatan-label">Catatan:</div><div>{$catatan}</div></div>
            <div class="keuntungan-box">FAEDAH DIKENA = RM {$this->formatNumber($monthlyInterest)} SEBULAN</div>
        </div>
    </div>

    <div class="amount-section">
        <div class="amount-words">Amaun: {$amountWords} SAHAJA</div>
        <div class="amount-row">
            <div class="amount-figure">Pinjaman RM {$this->formatNumber($loanAmount, 0)}***</div>
            <div class="date-box"><div class="date-label">Tarikh Dipajak</div><div class="date-value">{$pledgeDate->format('d/m/Y')}</div></div>
            <div class="date-box"><div class="date-label">Tarikh Cukup Tempoh</div><div class="date-value">{$dueDate->format('d/m/Y')}</div></div>
        </div>
    </div>

    <div class="footer">
        <div class="footer-text">Anda diminta memeriksa barang gadaian dan butir-butir di atas dengan teliti sebelum meninggalkan kedai ini.</div>
        <div class="footer-text">Sebarang tuntutan selepas meninggalkan kedai ini tidak akan dilayan. Lindungan insuran di bawah polisi No:</div>
        <div class="footer-bottom"><div class="copy-label">{$copyLabel}</div><div class="weight-info">Berat (Emas, Batu): <b>{$this->formatNumber($totalWeight, 2)}g</b></div></div>
    </div>
</div>
<style>
@page{size:A5 landscape;margin:3mm}*{margin:0;padding:0;box-sizing:border-box}
.receipt{width:202mm;height:136mm;padding:2.5mm;border:2px solid #1a4a7a;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#1a4a7a;line-height:1.3;background:#fff;overflow:hidden}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5mm;border-bottom:2px solid #1a4a7a;padding-bottom:1.5mm}
.header-left{display:flex;align-items:flex-start;gap:3mm;flex:1}
.logo{height:14mm;width:auto;max-width:18mm;object-fit:contain}
.company-info{flex:1}
.company-name{font-size:15px;font-weight:bold;color:#c41e3a;margin-bottom:1px}
.company-name span{font-size:11px;color:#1a4a7a;font-weight:normal}
.company-multilang{font-size:12px;font-weight:bold;color:#c41e3a;margin-bottom:1px}
.company-address{font-size:9px;color:#1a4a7a}
.header-right{text-align:right;min-width:45mm}
.established{background:#c41e3a;color:white;padding:3px 6px;border-radius:50%;font-size:8px;font-weight:bold;display:inline-block;margin-bottom:1.5mm;line-height:1.1}
.phone-box{background:#c41e3a;color:white;padding:2px 5px;font-size:10px;margin-bottom:1.5mm;display:inline-block}
.business-hours{font-size:8px;text-align:right;color:#c41e3a;font-weight:bold;line-height:1.2}
.main-content{display:flex;gap:3mm}
.left-section{flex:1;border:1px solid #1a4a7a;padding:2mm}
.right-section{width:52mm;min-width:52mm}
.section-header{background:#e8f0f8;padding:1mm 2mm;font-weight:bold;font-size:9px;border-bottom:1px solid #1a4a7a;margin-bottom:1.5mm}
.items-box{border:1px solid #1a4a7a;min-height:20mm;max-height:26mm;padding:1.5mm;margin-bottom:1.5mm;overflow:hidden}
.items-columns{display:flex;gap:3mm}
.items-col{flex:1;min-width:0}
.item-line{font-size:9px;margin-bottom:0.8mm;line-height:1.2}
.ticket-box{border:2px solid #c41e3a;padding:1.5mm;text-align:center;margin-bottom:1.5mm;background:#fff8f8}
.ticket-label{font-size:9px;color:#c41e3a;font-weight:bold}
.ticket-number{font-size:15px;font-weight:bold;color:#c41e3a;font-family:'Courier New',monospace}
.info-box{border:1px solid #1a4a7a;padding:1.5mm;font-size:9px;margin-bottom:1.5mm}
.info-row{display:flex;justify-content:space-between}
.customer-row{display:flex;gap:3mm;margin-bottom:1.5mm;font-size:10px;flex-wrap:wrap}
.customer-label{font-weight:bold;min-width:22mm}
.customer-value{border-bottom:1px dotted #1a4a7a;min-width:30mm}
.catatan-box{border:1px solid #1a4a7a;padding:1.5mm;min-height:8mm;margin-bottom:1.5mm}
.catatan-label{font-size:9px;font-weight:bold}
.keuntungan-box{background:#fffde8;border:1px solid #d4a800;padding:1.5mm;font-size:10px;font-weight:bold;text-align:center}
.amount-section{border:2px solid #1a4a7a;padding:2mm;margin-top:1.5mm;background:#f8fafc}
.amount-words{font-size:10px;font-weight:bold;margin-bottom:1.5mm}
.amount-row{display:flex;justify-content:space-between;align-items:center}
.amount-figure{font-size:14px;font-weight:bold}
.date-box{text-align:center;border:1px solid #1a4a7a;padding:1.5mm 4mm}
.date-label{font-size:8px;color:#666}
.date-value{font-size:11px;font-weight:bold}
.footer{margin-top:1.5mm;font-size:8px;border-top:1px solid #1a4a7a;padding-top:1.5mm}
.footer-text{margin-bottom:0.8mm}
.footer-bottom{display:flex;justify-content:space-between;align-items:flex-end;margin-top:1.5mm}
.copy-label{font-size:11px;font-weight:bold;color:#c41e3a}
.weight-info{text-align:right;font-size:9px}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
HTML;
    }

    /**
     * Generate Terms and Conditions page - Page 2 of 2
     * FIXED: Proper A5 Landscape sizing - fits exactly in 1 page
     * NOW DYNAMIC: Fetches terms from TermsCondition table
     */
    private function generateTermsPageHtml(Pledge $pledge, array $settings): string
    {
        // Fetch active pledge terms from database, ordered by sort_order
        $terms = [];
        try {
            $terms = TermsCondition::where('is_active', true)
                ->where('activity_type', 'pledge')
                ->orderBy('sort_order', 'asc')
                ->orderBy('id', 'asc')
                ->get();
        } catch (\Exception $e) {
            // If table doesn't exist or error, use empty array
            \Log::warning('Failed to fetch terms: ' . $e->getMessage());
        }

        // Build terms HTML - Use Malay content (content_ms) for dot matrix print
        $termsHtml = '';
        $termNumber = 1;

        if (count($terms) > 0) {
            foreach ($terms as $term) {
                // Use content_ms (Malay) for the print, fallback to content_en
                $content = $term->content_ms ?? $term->content_en ?? '';

                // Clean and format the content - preserve any HTML like <u> for underline
                $content = str_replace(["\r\n", "\r", "\n"], '<br>', $content);

                // Build the term item with number
                $termsHtml .= "<div class=\"term-item\"><b>{$termNumber}.</b> {$content}</div>\n";
                $termNumber++;
            }
        } else {
            // Fallback to default terms if no terms in database
            $termsHtml = <<<FALLBACK
<div class="term-item"><b>1.</b> Seseorang pemajak gadai adalah berhak mendapat satu salinan tiket pajak gadai pada masa pajak gadaian. Jika hilang, satu salinan catatan di dalam buku pemegang pajak gadai boleh diberi dengan percuma.</div>
<div class="term-item"><b>2.</b> Kadar untung adalah tidak melebihi <u>dua peratus (2%)</u> sebulan atau sebahagian daripadanya campur caj pengendalian sebanyak <u>lima puluh sen (50¢)</u> bagi mana-mana pinjaman yang melebihi sepuluh ringgit.</div>
<div class="term-item"><b>3.</b> Jika mana-mana sandaran hilang atau musnah disebabkan atau dalam kebakaran, kecuaian, kecurian, rompakan atau selainnya, maka amoun pampasan adalah satu per empat <u>(25%)</u> lebih daripada jumlah pinjaman.</div>
<div class="term-item"><b>4.</b> Mana-mana sandaran hendaklah ditebus dalam masa <u>enam bulan</u> dari tarikh pajak gadaian atau dalam masa yang lebih panjang sebagaimana yang dipersetujui antara pemegang pajak gadai dengan pemajak gadai.</div>
<div class="term-item"><b>5.</b> Seorang pemajak gadai berhak pada bila-bila masa dalam masa empat bulan selepas lelong untuk memeriksa catatan jualan dalam buku pemegang pajak gadai dan laporan yang dibuat oleh pelelong.</div>
<div class="term-item"><b>6.</b> Apa-apa pertanyaan boleh dialamatkan kepada: Pendaftar Pemegang Pajak Gadai, Kementerian Perumahan dan Kerajaan Tempatan, Aras 22, No 51, Jalan Persiaran Perdana, Presint 4, 62100 Putrajaya.</div>
<div class="term-item"><b>7.</b> Jika sesuatu sandaran tidak ditebus di dalam enam bulan maka sandaran itu:-<br>(a) Jika dipajak gadai untuk wang berjumlah <u>dua ratus ringgit</u> dan ke bawah, hendaklah menjadi harta pemegang pajak gadai itu.<br>(b) Jika dipajak gadai untuk wang berjumlah lebih daripada <u>dua ratus ringgit</u> hendaklah dijual oleh seorang pelelong berlesen mengikut Akta Pelelongan.</div>
<div class="term-item"><b>8.</b> Jika mana-mana surat berdaftar tidak sampai kepada pemajak gadai pejabat adalah tanggungjawab pejabat pos dan bukan pemegang pajak gadai.</div>
<div class="term-item"><b>9.</b> Sila maklumkan kami jika sekiranya anda menukarkan alamat.</div>
<div class="term-item"><b>10.</b> Jika tarikh tamat tempoh jatuh pada Cuti Am anda dinasihatkan datang menebus/melanjut sebelum Cuti Am.</div>
<div class="term-item"><b>11.</b> Barang-barang curian tidak diterima.</div>
<div class="term-item"><b>12.</b> Data peribadi anda akan digunakan dan diproseskan <u>hanya bagi tujuan internal sahaja</u>.</div>
FALLBACK;
        }

        return <<<HTML
<div class="terms-page">
    <div class="terms-section">
        <div class="terms-title">TERMA DAN SYARAT</div>
        {$termsHtml}
        <div class="notice-box">DIKEHENDAKI MEMBAWA KAD<br>PENGENALAN APABILA MENEBUS<br>BARANG GADAIAN</div>
    </div>
    <div class="redeemer-section">
        <div class="redeemer-title">Butir-butir Penebus</div>
        <div class="redeemer-field"><div class="redeemer-label">No. K/P:</div><div class="redeemer-line"></div></div>
        <div class="redeemer-field"><div class="redeemer-label">Nama:</div><div class="redeemer-line"></div><div class="redeemer-line"></div></div>
        <div class="redeemer-field"><div class="redeemer-label">Kerakyatan:</div><div class="redeemer-line"></div></div>
        <div class="redeemer-field-row"><div><div class="redeemer-label">Tahun Lahir:</div><div class="redeemer-line"></div></div><div><div class="redeemer-label">Umur:</div><div class="redeemer-line"></div></div></div>
        <div class="redeemer-field"><div class="redeemer-label">Jantina:</div><div class="redeemer-line"></div></div>
        <div class="redeemer-field"><div class="redeemer-label">H/P No:</div><div class="redeemer-line"></div></div>
        <div class="redeemer-field"><div class="redeemer-label">Alamat:</div><div class="redeemer-line"></div><div class="redeemer-line"></div><div class="redeemer-line"></div></div>
        <div class="barcode-placeholder">|||||||||||||||||||||||</div>
        <div class="redeemer-field"><div class="redeemer-label">Cap Jari / Tandatangan:</div><div class="signature-box">Cap Jari / Tandatangan</div></div>
    </div>
</div>
<style>
@page{size:A5 landscape;margin:3mm}*{margin:0;padding:0;box-sizing:border-box}
.terms-page{width:202mm;height:136mm;padding:2.5mm;display:flex;gap:3mm;font-family:Arial,sans-serif;font-size:9px;color:#1a4a7a;background:#fff;overflow:hidden}
.terms-section{flex:1.4}
.redeemer-section{flex:0.6;min-width:52mm;border:2px solid #1a4a7a;padding:2mm}
.terms-title{font-size:13px;font-weight:bold;text-align:center;margin-bottom:2.5mm;text-decoration:underline}
.term-item{margin-bottom:1.8mm;text-align:justify;line-height:1.35}
.notice-box{border:2px solid #c41e3a;padding:2.5mm;margin-top:2.5mm;text-align:center;font-weight:bold;font-size:10px;color:#c41e3a;background:#fff8f8;line-height:1.3}
.redeemer-title{font-size:10px;font-weight:bold;text-align:center;margin-bottom:2mm;border-bottom:1px solid #1a4a7a;padding-bottom:1.5mm}
.redeemer-field{margin-bottom:2mm}
.redeemer-label{font-size:8px;margin-bottom:0.5mm}
.redeemer-line{border-bottom:1px dotted #1a4a7a;min-height:4mm;margin-bottom:1mm}
.redeemer-field-row{display:flex;gap:2mm;margin-bottom:2mm}
.redeemer-field-row>div{flex:1}
.barcode-placeholder{border:1px solid #1a4a7a;height:9mm;margin:1.5mm 0;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:12px;letter-spacing:2px;color:#1a4a7a}
.signature-box{border:1px solid #1a4a7a;height:12mm;margin-top:1mm;display:flex;align-items:center;justify-content:center;font-size:7px;color:#999}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
HTML;
    }

    /**
     * Build items HTML for receipt - 2 COLUMN LAYOUT
     * Column 1: First 3 item groups
     * Column 2: Remaining item groups
     * Prevents overflow by utilizing horizontal space
     */
    private function buildItemsHtml($items, int $itemsPerColumn = 3): string
    {
        $groupedItems = [];
        $totalItemCount = count($items);

        // Group items by category + purity + condition
        foreach ($items as $item) {
            $categoryName = strtoupper($item->category->name_ms ?? $item->category->name_en ?? 'BARANG KEMAS');
            $purity = $item->purity->code ?? '';
            $karat = $item->purity->karat ?? '';
            $condition = strtoupper($item->condition ?? '');
            $key = $categoryName . '|' . $purity . '|' . $condition;
            if (!isset($groupedItems[$key])) {
                $groupedItems[$key] = ['name' => $categoryName, 'purity' => $purity, 'karat' => $karat, 'condition' => $condition, 'count' => 0];
            }
            $groupedItems[$key]['count']++;
        }

        $groupedItemsArray = array_values($groupedItems);
        $totalGroups = count($groupedItemsArray);

        // If only 1-2 items, no need for columns
        if ($totalGroups <= 2) {
            $html = '';
            foreach ($groupedItemsArray as $item) {
                $html .= $this->formatItemLine($item);
            }
            return $html ?: "<div class='item-line'>Tiada item</div>";
        }

        // Split items evenly into 2 columns
        // Column 1 gets ceiling half, Column 2 gets the rest
        $splitAt = ceil($totalGroups / 2);
        $column1Items = array_slice($groupedItemsArray, 0, $splitAt);
        $column2Items = array_slice($groupedItemsArray, $splitAt);

        // Build Column 1 HTML
        $col1Html = '';
        foreach ($column1Items as $item) {
            $col1Html .= $this->formatItemLine($item);
        }

        // Build Column 2 HTML
        $col2Html = '';
        foreach ($column2Items as $item) {
            $col2Html .= $this->formatItemLine($item);
        }

        // If column 2 is empty, just return column 1
        if (empty($col2Html)) {
            return $col1Html;
        }

        // Build 2-column layout
        $html = "<div class='items-columns'>";
        $html .= "<div class='items-col'>{$col1Html}</div>";
        $html .= "<div class='items-col'>{$col2Html}</div>";
        $html .= "</div>";

        return $html;
    }

    /**
     * Format a single item line for the receipt
     */
    private function formatItemLine(array $item): string
    {
        $qty = $item['count'];
        $qtyWord = strtoupper($this->numberToMalayWord($qty));
        $purityDisplay = $item['purity'] . ($item['karat'] ? ' (' . $item['karat'] . ')' : '');
        $conditionText = '';
        if ($item['condition'] && $item['condition'] !== 'GOOD') {
            $conditionMap = ['BENT' => 'BENGKOK', 'BROKEN' => 'ROSAK', 'DAMAGED' => 'ROSAK', 'SCRATCHED' => 'CALAR'];
            $conditionText = $conditionMap[$item['condition']] ?? $item['condition'];
        }

        $line = "({$qty}) {$qtyWord} {$item['name']}" . ($conditionText ? " ({$conditionText})" : '');
        $html = "<div class='item-line'>{$line}</div>";
        if ($purityDisplay) {
            $html .= "<div class='item-line' style='margin-left:8px;font-size:9px;'>({$purityDisplay})</div>";
        }
        return $html;
    }

    private function formatNumber($number, $decimals = 2): string
    {
        return number_format((float) $number, $decimals);
    }
    private function formatIC(?string $ic): string
    {
        if (!$ic)
            return '-';
        $ic = preg_replace('/[^0-9]/', '', $ic);
        return strlen($ic) === 12 ? substr($ic, 0, 6) . '-' . substr($ic, 6, 2) . '-' . substr($ic, 8, 4) : ($ic ?: '-');
    }
    private function formatCustomerAddress($customer): string
    {
        $parts = array_filter([$customer->address_line1 ?? $customer->address ?? '', $customer->address_line2 ?? '', trim(($customer->postcode ?? '') . ' ' . ($customer->city ?? '')), strtoupper($customer->state ?? '')]);
        return implode(', ', $parts) ?: '-';
    }
    private function getCitizenship($customer): string
    {
        $n = strtoupper($customer->nationality ?? '');
        return str_contains($n, 'MALAYSIA') ? 'MALAYSIA' : ($n ?: 'WARGANEGARA');
    }
    private function getRace($customer): string
    {
        if (!empty($customer->race)) {
            $r = strtoupper($customer->race);
            $map = ['MALAY' => 'MELAYU', 'CHINESE' => 'CINA', 'INDIAN' => 'INDIA', 'OTHERS' => 'LAIN-LAIN'];
            return $map[$r] ?? $r;
        }
        return 'MELAYU';
    }
    private function extractBirthYear($customer): string
    {
        if (!empty($customer->date_of_birth)) {
            try {
                $d = $customer->date_of_birth;
                if (is_string($d))
                    $d = Carbon::parse($d);
                return $d->format('Y');
            } catch (\Exception $e) {
            }
        }
        $ic = preg_replace('/[^0-9]/', '', $customer->ic_number ?? '');
        if (strlen($ic) >= 6) {
            $yy = substr($ic, 0, 2);
            return ((int) $yy > (int) date('y')) ? '19' . $yy : '20' . $yy;
        }
        return '-';
    }
    private function calculateAge($customer): string
    {
        $y = $this->extractBirthYear($customer);
        if ($y === '-')
            return '-';
        $age = (int) date('Y') - (int) $y;
        return ($age < 0 || $age > 150) ? '-' : (string) $age;
    }
    private function getGender($customer): string
    {
        $g = strtolower($customer->gender ?? '');
        if (in_array($g, ['male', 'm', 'lelaki']))
            return 'LELAKI';
        if (in_array($g, ['female', 'f', 'perempuan']))
            return 'PEREMPUAN';
        return '-';
    }
    private function numberToMalayWord(int $n): string
    {
        $w = [1 => 'SATU', 2 => 'DUA', 3 => 'TIGA', 4 => 'EMPAT', 5 => 'LIMA', 6 => 'ENAM', 7 => 'TUJUH', 8 => 'LAPAN', 9 => 'SEMBILAN', 10 => 'SEPULUH'];
        return $w[$n] ?? (string) $n;
    }

    private function numberToMalayWords(float $number): string
    {
        $ones = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'lapan', 'sembilan'];
        $tens = ['', 'sepuluh', 'dua puluh', 'tiga puluh', 'empat puluh', 'lima puluh', 'enam puluh', 'tujuh puluh', 'lapan puluh', 'sembilan puluh'];
        $teens = ['sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas', 'tujuh belas', 'lapan belas', 'sembilan belas'];
        $ringgit = intval($number);
        $sen = round(($number - $ringgit) * 100);
        $words = '';
        if ($ringgit >= 1000000) {
            $m = intval($ringgit / 1000000);
            $words .= ($m == 1 ? 'sejuta' : $this->numberToMalayWords($m) . ' juta');
            $ringgit %= 1000000;
            if ($ringgit > 0)
                $words .= ' ';
        }
        if ($ringgit >= 1000) {
            $t = intval($ringgit / 1000);
            $words .= ($t == 1 ? 'seribu' : $this->numberToMalayWords($t) . ' ribu');
            $ringgit %= 1000;
            if ($ringgit > 0)
                $words .= ' ';
        }
        if ($ringgit >= 100) {
            $h = intval($ringgit / 100);
            $words .= ($h == 1 ? 'seratus' : $ones[$h] . ' ratus');
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
        $words = $words ?: 'sifar';
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

    // ═══════════════════════════════════════════════════════════════
    //  Pre-Printed Form Generation (Blank Templates)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Generate Pre-Printed Form (Blank Template)
     * Prints the FORM DESIGN ONLY - no customer data
     * For bulk printing on blank paper to create pre-printed form stock
     *
     * FRONT: Pledge ticket form with all labels, borders, yellow boxes
     * BACK:  Terms & Conditions + Redeemer details section
     */
    public function prePrintedForm(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'count' => 'sometimes|integer|min:1|max:50',
                'page' => 'sometimes|in:front,back,both',
            ]);

            $count = $validated['count'] ?? 1;
            $page = $validated['page'] ?? 'both';

            $branch = $request->user()->branch;
            $settings = $this->getCompanySettings($branch);

            $frontHtml = '';
            $backHtml = '';

            if ($page === 'front' || $page === 'both') {
                $frontHtml = $this->generatePrePrintedFrontPage($settings);
            }
            if ($page === 'back' || $page === 'both') {
                $backHtml = $this->generatePrePrintedBackPage($settings);
            }

            // Build bulk HTML if count > 1
            $bulkFrontHtml = '';
            $bulkBackHtml = '';
            for ($i = 0; $i < $count; $i++) {
                if ($frontHtml)
                    $bulkFrontHtml .= $frontHtml;
                if ($backHtml)
                    $bulkBackHtml .= $backHtml;
            }

            return $this->success([
                'front_html' => $bulkFrontHtml,
                'back_html' => $bulkBackHtml,
                'count' => $count,
                'page' => $page,
                'format' => 'html',
                'paper_size' => 'A5',
                'orientation' => 'landscape',
            ]);

        } catch (\Exception $e) {
            \Log::error('Pre-Printed Form Error: ' . $e->getMessage());
            return $this->error('Print error: ' . $e->getMessage(), 500);
        }
    }


    /**
     * FRONT PAGE — Pre-Printed Blank Form (A5 Landscape)
     * Exact clone of physical form with proper CSS scoping
     */
    private function generatePrePrintedFrontPage(array $settings): string
    {
        $companyName = htmlspecialchars($settings['company_name'] ?? 'PAJAK GADAI SIN THYE TONG SDN. BHD.');
        $regNo = htmlspecialchars($settings['registration_no'] ?? '(1363773-U)');
        $chineseName = htmlspecialchars($settings['company_name_chinese'] ?? '新泰當');
        $tamilName = htmlspecialchars($settings['company_name_tamil'] ?? 'அடகு கடை');
        $address = htmlspecialchars($settings['address'] ?? 'No. 120 & 122, Jalan Besar Kepong, 52100 Kuala Lumpur.');
        $phone1 = htmlspecialchars($settings['phone'] ?? '03-6274 0480');
        $phone2 = htmlspecialchars($settings['phone2'] ?? '03-6262 5562');
        $estYear = htmlspecialchars($settings['established_year'] ?? '1966');
        $businessDays = htmlspecialchars($settings['business_days'] ?? 'ISNIN - AHAD');
        $businessHours = htmlspecialchars($settings['business_hours'] ?? '8.30AM - 6.00PM');
        $closedDays = htmlspecialchars($settings['closed_days'] ?? 'CUTI AM & AHAD : PAJAK SAHAJA');
        $handlingFee = htmlspecialchars($settings['handling_fee'] ?? '50 SEN');
        $redemptionPeriod = htmlspecialchars($settings['redemption_period'] ?? '6 BULAN');
        $interestNormal = htmlspecialchars($settings['interest_rate_normal'] ?? '1.5');
        $interestOverdue = htmlspecialchars($settings['interest_rate_overdue'] ?? '2.0');
        $logoUrl = $settings['logo_url'] ?? null;

        // Build phone display
        $phoneHtml = $phone1;
        if ($phone2) {
            $phoneHtml .= '<br>' . $phone2;
        }

        // Build logo HTML - only show if logo exists
        $logoHtml = '';
        if ($logoUrl) {
            $logoHtml = '<img src="' . htmlspecialchars($logoUrl) . '" class="pp-logo" alt="Logo">';
        }

        return <<<'HTMLSTART'
<style>
/* ═══ FRONT PAGE STYLES ═══ */
.pp-front {
    width: 210mm; height: 148mm; padding: 2.5mm 3mm 2mm 4mm;
    font-family: Arial, Helvetica, sans-serif; color: #1a4a7a;
    background: #fff !important; overflow: hidden; box-sizing: border-box;
    page-break-after: always; break-after: page;
}
.pp-front * { box-sizing: border-box; margin: 0; padding: 0; }

/* Header - Logo + Company info left, Phone+SEJAK row right */
.pp-hdr { display: flex; align-items: flex-start; gap: 0; padding-bottom: 1.5mm; border-bottom: 1px solid #1a4a7a; }
.pp-hdr-left { flex: 1; display: flex; align-items: flex-start; gap: 2mm; }
.pp-logo { width: 12mm; height: 12mm; object-fit: contain; flex-shrink: 0; }
.pp-co-info { flex: 1; }
.pp-co-name { font-size: 33px; font-weight: bold; color: #1a4a7a; line-height: 1.1; }
.pp-co-reg { font-size: 7px; color: #1a4a7a; }
.pp-co-multi { font-size: 2rem; font-weight: bold; color: #1a4a7a; margin-top: 0.5mm; }
.pp-co-addr { font-size: 9px; color: #1a4a7a; margin-top: 0.5mm; }

/* Right side: Phone box + SEJAK on same row, then Hours below */
.pp-hdr-right { display: flex; flex-direction: column; align-items: flex-end; min-width: 55mm; }
.pp-top-row { display: flex; align-items: center; gap: 2mm; margin-bottom: 1mm; }
.pp-phone-box { background: #d42027; color: #fff; padding: 2mm 3mm; border-radius: 3px; display: flex; align-items: center; gap: 1.5mm; }
.pp-phone-icon { font-size: 14px; color: #d42027; background: #fff; border-radius: 50%; width: 6mm; height: 6mm; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.pp-phone-nums { font-size: 11px; font-weight: bold; line-height: 1.35; }
.pp-sejak { background: #d42027; color: #fff; width: 14mm; height: 14mm; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: 2px solid #b01a20; }
.pp-sejak-lbl { font-size: 6px; font-weight: bold; line-height: 1; letter-spacing: 0.5px; }
.pp-sejak-yr { font-size: 12px; font-weight: bold; line-height: 1; }
.pp-hrs-box { background: #f5c518; color: #000; padding: 1.5mm 2.5mm; width: 55mm; }
.pp-hrs-title { font-size: 13px; font-weight: bold; text-align: center; }
.pp-hrs-line { font-size: 8px; font-weight: bold; line-height: 1.4; }

/* Middle section - Items left, Yellow boxes right */
.pp-mid { display: flex; border: 1px solid #1a4a7a; margin-bottom: 0; }
.pp-items-sec { flex: 1; padding: 1.5mm 2mm; border-right: 1px solid #1a4a7a; }
.pp-items-title { font-size: 9px; font-weight: bold; text-decoration: underline; margin-bottom: 1.5mm; }
.pp-items-area { min-height: 22mm; padding-left: 3mm; }
.pp-item-n { font-size: 10px; height: 5.5mm; line-height: 5.5mm; }

/* Right column - Same width as header hrs-box (55mm) */
.pp-rcol { width: 55mm; min-width: 55mm; }
.pp-tkt-box { background: #f5c518; padding: 2mm; border-bottom: 1px solid #1a4a7a; }
.pp-tkt-lbl { font-size: 9px; font-weight: bold; color: #000; }
.pp-tkt-space { min-height: 10mm; }
.pp-rate-row { display: flex; border-bottom: 1px solid #1a4a7a; color: #1a4a7a;}
.pp-rate-cell { flex: 1; padding: 1.5mm; text-align: center; }
.pp-rate-cell:first-child { border-right: 1px solid #1a4a7a; }
.pp-rate-lbl { font-size: 7px; font-weight: bold; color: #000; }
.pp-rate-val { font-size: 11px; font-weight: bold; color: #000; }
.pp-rate-big { font-size: 15px; }
.pp-kadar { padding: 1.5mm 2mm; color: #1a4a7a; }
.pp-kadar-title { font-size: 8px; font-weight: bold; color: #000; text-align: center; }
.pp-kadar-ln { font-size: 7.5px; color: #000; line-height: 1.5; }

/* Customer section - NO DOTTED LINES */
.pp-cust-sec { display: flex; }
.pp-cust-left { flex: 1; }
.pp-cust-title { font-size: 9px; font-weight: bold; text-decoration: underline; padding: 1mm 0; }
.pp-cust-box { border: 2px solid #d42027; padding: 2mm 2.5mm; min-height: 30mm; }
.pp-cust-row { display: flex; align-items: baseline; margin-bottom: 3mm; font-size: 11px; font-weight: bold; }
.pp-cust-row:last-child { margin-bottom: 0; }
.pp-cust-lbl { white-space: nowrap; min-width: 24mm; }
.pp-cust-lbl-s { white-space: nowrap; margin-left: 3mm; }
.pp-cust-sp { flex: 1; min-height: 5mm; }
.pp-cust-sp-s { width: 24mm; min-height: 5mm; }

.pp-cust-right { width: 55mm; min-width: 55mm; display: flex; flex-direction: column; }
.pp-cat-hdr { font-size: 10px; font-weight: bold; border: 1px solid #1a4a7a; border-bottom: none; padding: 1mm 2mm; }
.pp-cat-area { border: 1px solid #1a4a7a; flex: 1; min-height: 14mm; }
.pp-keuntungan { font-size: 9px; font-weight: bold; color: #d42027; padding: 1.5mm 1mm; line-height: 1.4; }

/* Amount section - NO DOTTED LINES */
.pp-amt-row { border: 1px solid #1a4a7a; border-bottom: none; padding: 1.5mm 2.5mm; display: flex; align-items: baseline; gap: 2mm; }
.pp-amt-lbl { font-size: 11px; font-weight: bold; }
.pp-amt-sp { flex: 1; min-height: 5mm; }
.pp-amt-sahaja { font-size: 11px; font-weight: bold; }

/* Bottom section - NO DOTTED LINES */
.pp-bot { display: flex; border: 1.5px solid #1a4a7a; }
.pp-pin-cell { flex: 1; padding: 1.5mm 2.5mm; display: flex; align-items: baseline; gap: 1.5mm; border-right: 1.5px solid #1a4a7a; }
.pp-pin-lbl { font-size: 10px; }
.pp-pin-rm { font-size: 15px; font-weight: bold; }
.pp-pin-sp { flex: 1; min-height: 7mm; }
.pp-pin-stars { font-size: 15px; font-weight: bold; }
.pp-dt-cell { width: 30mm; text-align: center; padding: 1mm 2mm; border-right: 1.5px solid #1a4a7a; }
.pp-dt-cell:last-child { border-right: none; }
.pp-dt-lbl { font-size: 8px; font-weight: bold; }
.pp-dt-sp { min-height: 6mm; }
.pp-dt-yel { background: #f5c518; }

/* Footer */
.pp-ftr { font-size: 7px; line-height: 1.4; margin-top: 0.5mm; display: flex; justify-content: space-between; align-items: flex-end; }
.pp-ftr-left { flex: 1; }
.pp-ftr-right { text-align: right; font-size: 6px; }
.pp-gm-box { display: inline-block; text-align: center; font-size: 7px; line-height: 1.3; min-width: 10mm; vertical-align: top; }

@media print {
    .pp-front { page-break-after: always; break-after: page; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
</style>
HTMLSTART
            . <<<HTML
<div class="pp-front">
    <!-- HEADER -->
    <div class="pp-hdr">
        <div class="pp-hdr-left">
            {$logoHtml}
            <div class="pp-co-info">
                <div class="pp-co-name">{$companyName}</div>
                <!-- <div class="pp-co-reg">{$regNo}</div> -->
                <div class="pp-co-multi">{$chineseName} {$tamilName}</div>
                <div class="pp-co-addr">{$address}</div>
            </div>
        </div>
        <div class="pp-hdr-right">
            <!-- Phone + SEJAK on same row -->
            <div class="pp-top-row">
                <div class="pp-phone-box">
                    <span class="pp-phone-icon">☎</span>
                    <div class="pp-phone-nums">{$phoneHtml}</div>
                </div>
                <div class="pp-sejak">
                    <span class="pp-sejak-lbl">SEJAK</span>
                    <span class="pp-sejak-yr">{$estYear}</span>
                </div>
            </div>
            <div class="pp-hrs-box">
                <div class="pp-hrs-title">BUKA 7 HARI</div>
                <div class="pp-hrs-line">{$businessDays} : {$businessHours}</div>
                <div class="pp-hrs-line">{$closedDays}</div>
            </div>
        </div>
    </div>

    <!-- MIDDLE: Items + Ticket/Rates -->
    <div class="pp-mid">
        <div class="pp-items-sec">
            <div class="pp-items-title">Perihal terperinci artikel yang digadai:-</div>
            <div class="pp-items-area">
               
            </div>
        </div>
        <div class="pp-rcol">
            <div class="pp-tkt-box"><div class="pp-tkt-lbl">NO. TIKET:</div><div class="pp-tkt-space"></div></div>
            <div class="pp-rate-row">
                <div class="pp-rate-cell"><div class="pp-rate-lbl">CAJ PENGENDALIAN</div><div class="pp-rate-val">{$handlingFee}</div></div>
                <div class="pp-rate-cell"><div class="pp-rate-lbl">TEMPOH TAMAT</div><div class="pp-rate-val pp-rate-big">{$redemptionPeriod}</div></div>
            </div>
            <div class="pp-kadar">
                <div class="pp-kadar-title">KADAR KEUNTUNGAN BULANAN</div>
                <div class="pp-kadar-ln">{$interestNormal}% Sebulan : Dalam tempoh 6 bulan</div>
                <div class="pp-kadar-ln">{$interestOverdue}% Sebulan : Lepas tempoh 6 bulan</div>
            </div>
        </div>
    </div>

    <!-- CUSTOMER -->
    <div class="pp-cust-sec">
        <div class="pp-cust-left">
            <div class="pp-cust-title">Butir-butir terperinci mengenai pemajak gadai:-</div>
            <div class="pp-cust-box">
                <div class="pp-cust-row"><span class="pp-cust-lbl">No. Kad :<br>Pengenalan</span><span class="pp-cust-sp"></span></div>
                <div class="pp-cust-row"><span class="pp-cust-lbl">Nama :</span><span class="pp-cust-sp"></span></div>
                <div class="pp-cust-row">
                    <span class="pp-cust-lbl">Kerakyatan :</span><span class="pp-cust-sp-s"></span>
                    <span class="pp-cust-lbl-s">Tahun Lahir :</span><span class="pp-cust-sp-s"></span>
                    <span class="pp-cust-lbl-s">Jantina :</span><span class="pp-cust-sp-s"></span>
                </div>
                <div class="pp-cust-row" style="justify-content:flex-end;"><span class="pp-cust-lbl-s">Panjang (cm) :</span><span class="pp-cust-sp-s"></span></div>
                <div class="pp-cust-row"><span class="pp-cust-lbl">Alamat :</span><span class="pp-cust-sp"></span></div>
            </div>
        </div>
        <div class="pp-cust-right">
            <div class="pp-cat-hdr">Catatan :</div>
            <div class="pp-cat-area"></div>
            <div class="pp-keuntungan">KEUNTUNGAN DIKENA = RM ________ SEBULAN</div>
        </div>
    </div>

    <!-- AMOUNT -->
    <div class="pp-amt-row"><span class="pp-amt-lbl">Amaun</span><span class="pp-amt-sp"></span><span class="pp-amt-sahaja">SAHAJA</span></div>

    <!-- BOTTOM -->
    <div class="pp-bot">
        <div class="pp-pin-cell"><span class="pp-pin-lbl">Pinjaman</span><span class="pp-pin-rm">RM</span><span class="pp-pin-sp"></span><span class="pp-pin-stars">***</span></div>
        <div class="pp-dt-cell"><div class="pp-dt-lbl">Tarikh Dipajak</div><div class="pp-dt-sp"></div></div>
        <div class="pp-dt-cell pp-dt-yel"><div class="pp-dt-lbl">Tarikh Cukup Tempoh</div><div class="pp-dt-sp"></div></div>
    </div>

    <!-- FOOTER -->
    <div class="pp-ftr">
        <div class="pp-ftr-left">
            <div>Anda diminta memeriksa barang gadaian dan butir-butir di atas dengan teliti sebelum meninggalkan kedai ini.</div>
            <div>Sebarang tuntutan selepas meninggalkan kedai ini tidak akan dilayan. Lindungan insuran di bawah polisi No :</div>
        </div>
        <div class="pp-ftr-right">
            <span style="font-size:5px;vertical-align:super;">Termasuk Emas, Batu<br>dan lain-lain</span> Berat :
            <div class="pp-gm-box">(gm)<br><br>L U</div>
        </div>
    </div>
</div>
HTML;
    }


    /**
     * BACK PAGE — Pre-Printed Blank Form (A5 Landscape)
     * Exact clone of physical form with proper CSS scoping
     */
    private function generatePrePrintedBackPage(array $settings): string
    {
        // Fetch terms from database
        $termsItems = [];
        try {
            $dbTerms = TermsCondition::where('is_active', true)
                ->where('activity_type', 'pledge')
                ->orderBy('sort_order', 'asc')
                ->orderBy('id', 'asc')
                ->get();

            if ($dbTerms->count() > 0) {
                foreach ($dbTerms as $term) {
                    $content = $term->content_ms ?? $term->content_en ?? '';
                    $content = str_replace(["\r\n", "\r", "\n"], '<br>', $content);
                    $termsItems[] = $content;
                }
            }
        } catch (\Exception $e) {
            // fallback below
        }

        // Fallback default terms if DB empty
        if (empty($termsItems)) {
            $termsItems = [
                'Seseorang pemajak gadai adalah berhak mendapat satu salinan tiket pajak gadai pada masa pajak gadaian. Jika hilang, satu salinan catatan di dalam buku pemegang pajak gadai boleh diberi dengan percuma.',
                'Kadar untung adalah tidak melebihi <b>dua peratus (2%)</b> sebulan atau sebahagian daripadanya campur caj pengendalian sebanyak <b>lima puluh sen (50¢)</b> bagi mana-mana pinjaman yang melebihi sepuluh ringgit.',
                'Jika mana-mana sandaran hilang atau musnah disebabkan atau dalam kebakaran, kecuaian, kecurian, rompakan atau selainnya, maka amaun pampasan adalah satu per empat <b>(25%)</b> lebih daripada jumlah pinjaman.',
                'Mana-mana sandaran hendaklah ditebus dalam masa enam bulan dari tarikh pajak gadaian atau dalam masa yang lebih panjang sebagaimana yang dipersetujui antara pemegang pajak gadai dengan pemajak gadai.<br><b><u><i>Setelah membayar amaun keuntungan yang ditetapkan, maka seseorang pemajak gadai boleh mendapat tempoh lanjutan enam (6) bulan lagi dari tarikh pembayaran amaun keuntungan.</i></u></b>',
                'Seorang pemajak gadai berhak pada bila-bila masa dalam masa empat bulan selepas lelong untuk memeriksa catatan jualan dalam buku pemegang pajak gadai dan laporan yang dibuat oleh pelelong. Dia berhak, atas permintaan, kepada apa-apa lebihan jika ada selepas potongan keuntungan yang kena di bayar ke atas sandaran itu dan kos lelong.',
                'Apa-apa pertanyaan boleh dialamatkan kepada:<br>Pendaftar Pemegang Pajak Gadai,<br>Kementerian Perumahan dan Kerajaan Tempatan, BKKK.<br>Aras 22, No 51, Jalan Persiaran Perdana, Presint 4, 62100 Putrajaya.',
                'Jika sesuatu sandaran tidak ditebus di dalam enam bulan maka sandaran itu:-<br>(a) Jika dipajak gadai untuk wang berjumlah <b>dua ratus ringgit</b> dan ke bawah, hendaklah menjadi harta pemegang pajak gadai itu.<br>(b) Jika dipajak gadai untuk wang berjumlah lebih daripada <b>dua ratus ringgit</b> hendaklah dijual oleh seorang pelelong berlesen mengikut Akta Pelelongan.',
                'Jika mana-mana surat berdaftar tidak sampai kepada pemajak gadai adalah tanggungjawab pejabat pos dan bukan pemegang pajak gadai.',
                'Sila maklumkan kami sekiranya anda menukarkan alamat. Jika tidak, alamat seperti yang tercatat di dalam tiket akan dianggap betul.',
                'Jika tarikh tamat tempoh jatuh pada Cuti Am anda dinasihatkan datang menebus/melanjut sebelum Cuti Am. Jika tidak, kadar ketuntutan lebih satu bulan akan dikira.',
                'Barang-barang curian tidak diterima. Adalah dianggap bahawa barang-barang yang dipajak gadai adalah bukan barang curian.',
                'Data peribadi anda akan digunakan dan diproseskan <u>hanya bagi tujuan internal sahaja</u>.',
            ];
        }

        $termsHtml = '';
        foreach ($termsItems as $idx => $content) {
            $num = $idx + 1;
            $termsHtml .= "<div class=\"pp-tm\"><b>{$num}.</b> {$content}</div>\n";
        }

        return <<<'HTMLSTART'
<style>
/* ═══ BACK PAGE STYLES ═══ */
.pp-back {
    width: 210mm; height: 148mm; padding: 3mm 4mm; display: flex;
    font-family: Arial, Helvetica, sans-serif; color: #1a4a7a;
    background: #fff !important; overflow: hidden; box-sizing: border-box;
    page-break-after: always; break-after: page;
}
.pp-back * { box-sizing: border-box; margin: 0; padding: 0; }

/* Terms column */
.pp-terms-col { flex: 1; padding-right: 2mm; overflow: hidden; }
.pp-terms-h { font-size: 12px; font-weight: bold; text-align: center; text-decoration: underline; margin-bottom: 1.5mm; }
.pp-tm { font-size: 7.5px; line-height: 1.3; margin-bottom: 0.8mm; text-align: justify; }
.pp-notice {
    border: 2.5px solid #1a4a7a; padding: 2.5mm 4mm; margin-top: 2mm;
    text-align: center; font-size: 11px; font-weight: bold; line-height: 1.35;
}

/* Redeemer column */
.pp-red-col {
    width: 56mm; min-width: 56mm; border: 1.5px solid #1a4a7a;
    padding: 2mm 2.5mm; display: flex; flex-direction: column;
}
.pp-red-h {
    font-size: 10px; font-weight: bold; text-align: center;
    border-bottom: 1.5px solid #1a4a7a; padding-bottom: 1.5mm; margin-bottom: 3mm;
}
.pp-rr { margin-bottom: 3mm; }
.pp-rl { font-size: 8px; font-weight: bold; }
.pp-rb { min-height: 5mm; border-bottom: 1px dotted #1a4a7a; }
.pp-rd { font-size: 8px; text-align: right; }
.pp-ri { display: flex; gap: 2mm; }
.pp-rh { flex: 1; }
.pp-sig-l { font-size: 8px; font-weight: bold; margin-bottom: 1mm; }
.pp-sig-b { border: 1px solid #1a4a7a; min-height: 14mm; }

@media print {
    .pp-back { page-break-after: always; break-after: page; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
</style>
HTMLSTART
            . <<<HTML
<div class="pp-back">
    <div class="pp-terms-col">
        <div class="pp-terms-h">TERMA DAN SYARAT</div>
        {$termsHtml}
        <div class="pp-notice">DIKEHENDAKI MEMBAWA KAD<br>PENGENALAN APABILA MENEBUS<br>BARANG GADAIAN</div>
    </div>

    <div class="pp-red-col">
        <div class="pp-red-h">Butir-butir Penebus</div>
        <div class="pp-rr"><span class="pp-rl">No. K/P:</span><div class="pp-rb"></div></div>
        <div class="pp-rr"><span class="pp-rl">Nama:</span><div class="pp-rb"></div></div>
        <div class="pp-rr"><span class="pp-rl">Kerakyatan:</span><div class="pp-rb"></div></div>
        <div class="pp-rr"><div class="pp-ri"><div class="pp-rh"><span class="pp-rl">Tahun Lahir:</span><div class="pp-rb"></div></div><div class="pp-rh"><span class="pp-rl">Umur:</span><div class="pp-rb"></div></div></div></div>
        <div class="pp-rr"><span class="pp-rl">Jantina:</span><div class="pp-rb"></div></div>
        <div class="pp-rr"><span class="pp-rl">H/P No:</span><div class="pp-rb"></div></div>
        <div class="pp-rr"><span class="pp-rl">Alamat:</span><div class="pp-rb"></div><div class="pp-rb"></div><div class="pp-rb"></div></div>
        <div style="flex:1;"></div>
        <div><div class="pp-sig-l">Cap Jari /<br>Tandatangan</div><div class="pp-sig-b"></div></div>
    </div>
</div>
HTML;
    }

}