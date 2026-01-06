<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resit Pajak Gadai - {{ $pledge->receipt_no }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 11px;
            line-height: 1.5;
            color: #000;
            padding: 15mm;
            background: #fff;
        }

        /* Header */
        .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
            margin-bottom: 15px;
        }

        .logo-text {
            font-size: 24px;
            font-weight: bold;
            color: #8B4513;
            letter-spacing: 2px;
            margin-bottom: 5px;
        }

        .company-name {
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 3px;
        }

        .company-reg {
            font-size: 10px;
            color: #333;
            margin-bottom: 8px;
        }

        .company-details {
            font-size: 9px;
            color: #444;
            line-height: 1.4;
        }

        .company-details div {
            margin-bottom: 1px;
        }

        /* Document Title */
        .doc-title {
            text-align: center;
            margin: 15px 0;
            padding: 8px 0;
            border: 2px solid #000;
        }

        .doc-title h2 {
            font-size: 14px;
            font-weight: bold;
            letter-spacing: 1px;
        }

        /* Copy Type */
        .copy-type {
            text-align: right;
            font-size: 10px;
            font-style: italic;
            margin-bottom: 10px;
            color: #666;
        }

        /* Info Section - Two Columns */
        .info-section {
            width: 100%;
            margin-bottom: 15px;
            border: 1px solid #ccc;
        }

        .info-section table {
            width: 100%;
            border-collapse: collapse;
        }

        .info-section td {
            padding: 10px;
            vertical-align: top;
            width: 50%;
        }

        .info-section td:first-child {
            border-right: 1px solid #ccc;
        }

        .info-row {
            margin-bottom: 4px;
        }

        .info-label {
            display: inline-block;
            width: 90px;
            color: #333;
        }

        .info-value {
            font-weight: bold;
        }

        .info-value.highlight {
            color: #8B4513;
        }

        /* Items Table */
        .items-section {
            margin-bottom: 15px;
        }

        .section-title {
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 8px;
            border-bottom: 1px solid #000;
            padding-bottom: 3px;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }

        .items-table th {
            background: #f5f5f5;
            border: 1px solid #000;
            padding: 6px 8px;
            text-align: center;
            font-weight: bold;
            font-size: 9px;
        }

        .items-table td {
            border: 1px solid #000;
            padding: 6px 8px;
            text-align: center;
        }

        .items-table td.left {
            text-align: left;
        }

        .items-table td.right {
            text-align: right;
        }

        /* Summary Section */
        .summary-section {
            width: 100%;
            margin-bottom: 15px;
        }

        .summary-table {
            width: 50%;
            margin-left: auto;
            border-collapse: collapse;
            font-size: 10px;
        }

        .summary-table td {
            padding: 4px 8px;
            border: 1px solid #000;
        }

        .summary-table td.label {
            text-align: right;
            background: #f5f5f5;
            width: 60%;
        }

        .summary-table td.value {
            text-align: right;
            width: 40%;
        }

        .summary-table tr.total td {
            font-weight: bold;
            font-size: 12px;
            background: #fffacd;
        }

        .summary-table tr.total td.value {
            color: #8B4513;
        }

        /* Info Box */
        .info-box {
            border: 1px solid #ccc;
            padding: 10px;
            margin-bottom: 15px;
            font-size: 10px;
        }

        .info-box-title {
            font-weight: bold;
            margin-bottom: 5px;
            border-bottom: 1px dotted #ccc;
            padding-bottom: 3px;
        }

        .info-box-row {
            margin-bottom: 2px;
        }

        .info-box-row span {
            display: inline-block;
        }

        .info-box-row span:first-child {
            width: 100px;
        }

        /* Two Column Layout */
        .two-col-table {
            width: 100%;
            margin-bottom: 15px;
        }

        .two-col-table td {
            width: 48%;
            vertical-align: top;
        }

        .two-col-table td.gap {
            width: 4%;
        }

        /* Gold Prices */
        .gold-prices-table {
            width: 100%;
            margin-bottom: 15px;
            font-size: 9px;
            border-collapse: collapse;
        }

        .gold-prices-table td {
            text-align: center;
            padding: 5px;
            border: 1px solid #ccc;
            width: 25%;
        }

        .gold-label {
            color: #666;
            font-size: 8px;
        }

        .gold-value {
            font-weight: bold;
            color: #8B4513;
        }

        /* Signatures */
        .signature-table {
            width: 100%;
            margin: 30px 0 15px 0;
        }

        .signature-table td {
            width: 50%;
            text-align: center;
            padding: 0 20px;
            vertical-align: bottom;
        }

        .signature-img-container {
            height: 50px;
            margin-bottom: 5px;
        }

        .signature-img-container img {
            max-height: 45px;
            max-width: 120px;
        }

        .signature-line {
            border-top: 1px solid #000;
            padding-top: 5px;
            font-size: 9px;
        }

        .signature-name {
            font-size: 9px;
            font-weight: bold;
            margin-top: 3px;
        }

        /* Remarks/Terms */
        .remarks {
            border: 1px solid #ccc;
            padding: 10px;
            margin-bottom: 15px;
            font-size: 9px;
        }

        .remarks-title {
            font-weight: bold;
            margin-bottom: 5px;
        }

        .remarks ol {
            padding-left: 15px;
            margin: 0;
        }

        .remarks li {
            margin-bottom: 2px;
        }

        /* Warning */
        .warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 8px;
            text-align: center;
            font-size: 9px;
            margin-bottom: 15px;
        }

        .warning strong {
            color: #856404;
        }

        /* Footer */
        .footer {
            text-align: center;
            font-size: 8px;
            color: #666;
            border-top: 1px solid #ccc;
            padding-top: 10px;
            margin-top: 15px;
        }

        /* Due Date Highlight */
        .due-date-box {
            display: inline-block;
            background: #dc3545;
            color: white;
            padding: 2px 8px;
            font-weight: bold;
            font-size: 10px;
        }
    </style>
</head>
<body>
    @php
        // Get settings - try branch settings first, then fall back to branch data
        $companyName = $settings['company_name'] ?? $pledge->branch->company_name ?? $pledge->branch->name ?? 'PAJAK GADAI SDN BHD';
        $licenseNo = $settings['license_no'] ?? $pledge->branch->license_no ?? '';
        $regNo = $settings['registration_no'] ?? $pledge->branch->registration_no ?? '';
        $address = $settings['address'] ?? $pledge->branch->address ?? '';
        $phone = $settings['phone'] ?? $pledge->branch->phone ?? '';
        $fax = $settings['fax'] ?? $pledge->branch->fax ?? '';
        $email = $settings['email'] ?? $pledge->branch->email ?? '';
        $headerText = $settings['receipt_header_text'] ?? 'PAJAK GADAI BERLESEN';
        $footerText = $settings['receipt_footer_text'] ?? 'Terima kasih atas sokongan anda';
    @endphp

    <!-- Header -->
    <div class="header">
        <div class="logo-text">{{ $headerText }}</div>
        <div class="company-name">{{ $companyName }}</div>
        @if($regNo)
        <div class="company-reg">({{ $regNo }})</div>
        @endif
        <div class="company-details">
            @if($address)<div>{{ $address }}</div>@endif
            <div>
                @if($phone)Tel: {{ $phone }}@endif
                @if($fax) | Fax: {{ $fax }}@endif
            </div>
            <div>
                @if($email)Email: {{ $email }}@endif
                @if($licenseNo) | Lesen KPKT: {{ $licenseNo }}@endif
            </div>
        </div>
    </div>

    <!-- Document Title -->
    <div class="doc-title">
        <h2>RESIT PAJAK GADAI / PAWN RECEIPT</h2>
    </div>

    <!-- Copy Type -->
    <div class="copy-type">
        {{ $copy_type === 'office' ? '[ Salinan Pejabat / Office Copy ]' : '[ Salinan Pelanggan / Customer Copy ]' }}
    </div>

    <!-- Info Section -->
    <div class="info-section">
        <table>
            <tr>
                <td>
                    <div class="info-row">
                        <span class="info-label">No. Resit:</span>
                        <span class="info-value highlight">{{ $pledge->receipt_no }}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">No. Pajak:</span>
                        <span class="info-value">{{ $pledge->pledge_no }}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Tarikh:</span>
                        <span class="info-value">{{ $pledge->pledge_date->format('d/m/Y') }}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Tarikh Tamat:</span>
                        <span class="due-date-box">{{ $pledge->due_date->format('d/m/Y') }}</span>
                    </div>
                </td>
                <td>
                    <div class="info-row">
                        <span class="info-label">Nama:</span>
                        <span class="info-value">{{ $pledge->customer->name ?? '-' }}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">No. K/P:</span>
                        <span class="info-value">{{ $pledge->customer->ic_number ?? '-' }}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">No. Tel:</span>
                        <span class="info-value">{{ $pledge->customer->phone ?? '-' }}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Pegawai:</span>
                        <span class="info-value">{{ $pledge->createdBy->name ?? '-' }}</span>
                    </div>
                </td>
            </tr>
        </table>
    </div>

    <!-- Items Section -->
    <div class="items-section">
        <div class="section-title">Butiran Barang Kemas / Details of Item(s):</div>
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 5%">#</th>
                    <th style="width: 30%">Perkara / Description</th>
                    <th style="width: 12%">Ketulenan</th>
                    <th style="width: 12%">Berat (g)</th>
                    <th style="width: 13%">Harga/g (RM)</th>
                    <th style="width: 13%">Tolakan (RM)</th>
                    <th style="width: 15%">Nilai (RM)</th>
                </tr>
            </thead>
            <tbody>
                @foreach($pledge->items as $index => $item)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td class="left">{{ $item->category->name_en ?? 'Item' }}@if($item->description) - {{ Str::limit($item->description, 20) }}@endif</td>
                    <td>{{ $item->purity->code ?? '-' }}</td>
                    <td>{{ number_format($item->net_weight, 3) }}</td>
                    <td class="right">{{ number_format($item->price_per_gram, 2) }}</td>
                    <td class="right">{{ number_format($item->deduction_amount ?? 0, 2) }}</td>
                    <td class="right"><strong>{{ number_format($item->net_value, 2) }}</strong></td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Summary -->
    <div class="summary-section">
        <table class="summary-table">
            <tr>
                <td class="label">Jumlah Berat / Total Weight:</td>
                <td class="value">{{ number_format($pledge->total_weight, 3) }}g</td>
            </tr>
            <tr>
                <td class="label">Nilai Kasar / Gross Value:</td>
                <td class="value">RM {{ number_format($pledge->gross_value, 2) }}</td>
            </tr>
            <tr>
                <td class="label">Tolakan / Deductions:</td>
                <td class="value">- RM {{ number_format($pledge->total_deduction, 2) }}</td>
            </tr>
            <tr>
                <td class="label">Nilai Bersih / Net Value:</td>
                <td class="value">RM {{ number_format($pledge->net_value, 2) }}</td>
            </tr>
            <tr>
                <td class="label">Margin Pinjaman / Loan %:</td>
                <td class="value">{{ number_format($pledge->loan_percentage, 0) }}%</td>
            </tr>
            <tr class="total">
                <td class="label">JUMLAH PINJAMAN / LOAN AMOUNT:</td>
                <td class="value">RM {{ number_format($pledge->loan_amount, 2) }}</td>
            </tr>
        </table>
    </div>

    <!-- Interest & Payment Info -->
    <table class="two-col-table">
        <tr>
            <td>
                <div class="info-box">
                    <div class="info-box-title">Kadar Faedah / Interest Rate:</div>
                    <div class="info-box-row">
                        <span>Bulan 1-6:</span>
                        <span><strong>{{ number_format($pledge->interest_rate, 2) }}%</strong> sebulan</span>
                    </div>
                    <div class="info-box-row">
                        <span>Bulan 7+:</span>
                        <span><strong>{{ number_format($pledge->interest_rate_extended, 2) }}%</strong> sebulan</span>
                    </div>
                </div>
            </td>
            <td class="gap"></td>
            <td>
                <div class="info-box">
                    <div class="info-box-title">Bayaran / Payment:</div>
                    @if($pledge->payments && $pledge->payments->count() > 0)
                        @php $payment = $pledge->payments->first(); @endphp
                        <div class="info-box-row">
                            <span>Kaedah:</span>
                            <span><strong>{{ strtoupper($payment->payment_method ?? 'TUNAI') }}</strong></span>
                        </div>
                        @if(($payment->cash_amount ?? 0) > 0)
                        <div class="info-box-row">
                            <span>Tunai:</span>
                            <span>RM {{ number_format($payment->cash_amount, 2) }}</span>
                        </div>
                        @endif
                        @if(($payment->transfer_amount ?? 0) > 0)
                        <div class="info-box-row">
                            <span>Pindahan:</span>
                            <span>RM {{ number_format($payment->transfer_amount, 2) }}</span>
                        </div>
                        @endif
                    @else
                        <div class="info-box-row">
                            <span>Tunai:</span>
                            <span>RM {{ number_format($pledge->loan_amount, 2) }}</span>
                        </div>
                    @endif
                </div>
            </td>
        </tr>
    </table>

    <!-- Gold Prices Reference -->
    <table class="gold-prices-table">
        <tr>
            <td>
                <div class="gold-label">999 (24K)</div>
                <div class="gold-value">RM{{ number_format($pledge->gold_price_999, 2) }}/g</div>
            </td>
            <td>
                <div class="gold-label">916 (22K)</div>
                <div class="gold-value">RM{{ number_format($pledge->gold_price_916, 2) }}/g</div>
            </td>
            <td>
                <div class="gold-label">875 (21K)</div>
                <div class="gold-value">RM{{ number_format($pledge->gold_price_875, 2) }}/g</div>
            </td>
            <td>
                <div class="gold-label">750 (18K)</div>
                <div class="gold-value">RM{{ number_format($pledge->gold_price_750, 2) }}/g</div>
            </td>
        </tr>
    </table>

    <!-- Warning -->
    <div class="warning">
        <strong>PERINGATAN / REMINDER:</strong> Sila tebus atau perbaharui pajakan sebelum <strong>{{ $pledge->due_date->format('d/m/Y') }}</strong> untuk mengelakkan pelupusan barang.<br>
        Please redeem or renew before <strong>{{ $pledge->due_date->format('d/m/Y') }}</strong> to avoid forfeiture.
    </div>

    <!-- Signatures - Fixed Alignment -->
    <table class="signature-table">
        <tr>
            <td>
                <div class="signature-img-container">
                    @if($pledge->customer_signature)
                    <img src="{{ $pledge->customer_signature }}" alt="Signature">
                    @endif
                </div>
                <div class="signature-line">
                    Tandatangan Penggadai<br>
                    <em>Customer Signature</em>
                </div>
            </td>
            <td>
                <div class="signature-img-container">
                    {{-- Officer signature placeholder --}}
                </div>
                <div class="signature-line">
                    Tandatangan Pegawai<br>
                    <em>Officer Signature</em>
                </div>
                <div class="signature-name">{{ $pledge->createdBy->name ?? '' }}</div>
            </td>
        </tr>
    </table>

    <!-- Terms -->
    <div class="remarks">
        <div class="remarks-title">#Terma & Syarat / Terms & Conditions:</div>
        @if($terms && count($terms) > 0)
        <ol>
            @foreach($terms as $term)
            <li>{{ $term->content_en ?? $term->content ?? '' }}</li>
            @endforeach
        </ol>
        @else
        <ol>
            <li>Barang yang digadai mestilah ditebus dalam tempoh 6 bulan dari tarikh gadaian.</li>
            <li>Faedah akan dikenakan mengikut kadar yang ditetapkan.</li>
            <li>Resit ini WAJIB dibawa semasa menebus barang.</li>
            <li>Barang yang tidak ditebus akan dilupuskan mengikut peraturan KPKT.</li>
            <li>Pihak kedai tidak bertanggungjawab atas kehilangan resit.</li>
        </ol>
        @endif
    </div>

    <!-- Footer -->
    <div class="footer">
        <strong>{{ $pledge->receipt_no }}</strong><br>
        Dicetak / Printed: {{ $printed_at->format('d/m/Y H:i:s') }} oleh {{ $printed_by }}<br>
        {{ $footerText }}<br>
        <em>PawnSys - KPKT Compliant Pawn Management System</em>
    </div>
</body>
</html>