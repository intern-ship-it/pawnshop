<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resit Penebusan - {{ $redemption->redemption_no ?? $pledge->pledge_no }}</title>
    <style>
        @page {
            size: 700pt 420pt;
            margin: 0;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'DejaVu Sans', Arial, Helvetica, sans-serif;
            font-size: 7pt;
            color: #1a4a7a;
            background: #fff;
            width: 700pt;
            height: 420pt;
        }

        /* ═══ PAGE ═══ */
        .page {
            width: 650pt;
            padding: 10pt 18pt 6pt 14pt;
            overflow: visible;
        }

        /* ═══ HEADER ═══ */
        .header-table {
            width: 100%;
            border-collapse: collapse;
            border-bottom: 2.5pt solid #1a4a7a;
        }
        .header-table > tr > td,
        .header-table > tbody > tr > td {
            vertical-align: top;
            padding-bottom: 4pt;
        }
        .header-left { /* auto width */ }
        .header-right {
            text-align: right;
            width: 200pt;
        }
        .logo {
            width: 46pt;
            height: 46pt;
            vertical-align: top;
        }
        .company-name {
            font-size: 21pt;
            font-weight: bold;
            color: #1a4a7a;
            line-height: 1.15;
        }
        .company-multilang {
            font-size: 11pt;
            font-weight: bold;
            color: #1a4a7a;
            line-height: 1.3;
            margin-top: 1pt;
        }
        .company-address {
            font-size: 7.5pt;
            color: #1a4a7a;
            margin-top: 1pt;
        }
        .phone-box {
            background: #d42027;
            color: #fff;
            padding: 4pt 8pt;
            font-size: 8pt;
            font-weight: bold;
            display: inline-block;
            text-align: center;
            line-height: 1.3;
            white-space: nowrap;
            border-radius: 20pt;
        }
        .established {
            background: #d42027;
            color: #fff;
            padding: 3pt 6pt;
            font-size: 6.5pt;
            font-weight: bold;
            display: inline-block;
            text-align: center;
            line-height: 1.2;
        }
        .hours-box {
            background: #f5c518;
            color: #000;
            padding: 2pt 6pt;
            text-align: center;
            margin-top: 3pt;
        }
        .hours-title {
            font-size: 8pt;
            font-weight: bold;
            color: #000;
        }
        .hours-line {
            font-size: 6.5pt;
            font-weight: bold;
            color: #1a4a7a;
        }

        /* ═══ MID SECTION ═══ */
        .mid-section {
            width: 100%;
            border: 1.5pt solid #1a4a7a;
            border-collapse: collapse;
            margin-top: 4pt;
            margin-bottom: 4pt;
        }
        .mid-section td {
            vertical-align: top;
            border: 1.5pt solid #1a4a7a;
        }
        .items-cell {
            padding: 4pt 6pt;
            width: 62%;
        }
        .items-title {
            font-size: 6.5pt;
            font-weight: bold;
            color: #1a4a7a;
            margin-bottom: 3pt;
        }
        .items-area {
            padding-left: 2pt;
            min-height: 24pt;
        }
        .item-line {
            font-size: 9pt;
            font-weight: bold;
            color: #1a4a7a;
            margin-bottom: 1pt;
            line-height: 1.4;
        }
        .barcode-area {
            text-align: right;
            padding: 6pt 10pt 2pt 0;
        }
        .barcode-img {
            max-width: 180pt;
            height: 48pt;
        }
        .barcode-text {
            font-size: 6.5pt;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            text-align: right;
            color: #555;
            margin-top: 1pt;
            padding-right: 10pt;
        }
        .right-col {
            width: 38%;
        }
        .ticket-box {
            background: #f5c518;
            padding: 3pt 4pt;
            text-align: center;
            border-bottom: 1.5pt solid #1a4a7a;
        }
        .ticket-label {
            font-size: 6pt;
            font-weight: bold;
            color: #000;
        }
        .ticket-number {
            font-size: 12pt;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #d42027;
            padding: 1pt 0;
        }
        /* ═══ REDEMPTION NO BOX (GREEN) ═══ */
        .redemption-no-box {
            background: #e8f5e9;
            padding: 2pt 4pt;
            text-align: center;
            border-bottom: 1.5pt solid #1a4a7a;
        }
        .redemption-no-label {
            font-size: 5.5pt;
            font-weight: bold;
            color: #2e7d32;
        }
        .redemption-no-value {
            font-size: 9pt;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #2e7d32;
        }
        /* ═══ REDEEMED STATUS BOX (replaces TEMPOH TAMAT) ═══ */
        .status-section {
            text-align: center;
            padding: 3pt 4pt;
            border-bottom: 1.5pt solid #1a4a7a;
            background: #e8f5e9;
        }
        .status-label {
            font-size: 5.5pt;
            font-weight: bold;
            color: #2e7d32;
        }
        .status-value {
            font-size: 13pt;
            font-weight: bold;
            color: #2e7d32;
        }
        .kadar-section {
            padding: 3pt 6pt;
        }
        .kadar-title {
            font-size: 5.5pt;
            font-weight: bold;
            color: #1a4a7a;
            text-align: center;
            margin-bottom: 2pt;
        }
        .kadar-line {
            font-size: 5.5pt;
            color: #1a4a7a;
            line-height: 1.6;
        }

        /* ═══ CUSTOMER ═══ */
        .cust-heading {
            font-size: 7pt;
            font-weight: bold;
            color: #1a4a7a;
            padding: 2pt 0;
        }
        .cust-box {
            border: 1.5pt solid #2e7d32;
            padding: 3pt 6pt;
            margin-bottom: 3pt;
        }
        .cust-grid {
            width: 100%;
            border-collapse: collapse;
        }
        .cust-grid td {
            padding: 1pt 2pt;
            vertical-align: top;
        }
        .cl {
            font-size: 6.5pt;
            font-weight: bold;
            color: #1a4a7a;
            white-space: nowrap;
        }
        .cv {
            font-size: 8.5pt;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #000;
        }

        /* ═══ AMOUNT ═══ */
        .amount-box {
            border: 1.5pt solid #2e7d32;
            border-bottom: none;
            padding: 3pt 6pt;
            overflow: hidden;
        }
        .amount-label {
            font-size: 8pt;
            font-weight: bold;
            color: #1a4a7a;
        }
        .amount-words {
            font-size: 6pt;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #000;
        }

        /* ═══ BOTTOM ═══ */
        .bottom-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5pt solid #2e7d32;
        }
        .bottom-table td {
            border: 1.5pt solid #2e7d32;
            padding: 3pt 6pt;
            vertical-align: middle;
        }
        .pinjaman-cell { width: 62%; }
        .pinjaman-label {
            font-size: 8pt;
            font-weight: bold;
            color: #1a4a7a;
        }
        .pinjaman-rm {
            font-size: 9pt;
            font-weight: bold;
            color: #1a4a7a;
            padding-left: 6pt;
        }
        .pinjaman-amount {
            font-size: 16pt;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #000;
            padding-left: 8pt;
        }
        .pinjaman-stars {
            font-size: 12pt;
            font-weight: bold;
            color: #000;
            float: right;
        }
        .date-cell {
            text-align: center;
            width: 38%;
        }
        .date-label {
            font-size: 6.5pt;
            font-weight: bold;
            color: #1a4a7a;
        }
        .date-value {
            font-size: 10pt;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #000;
        }

        /* ═══ PAYMENT BREAKDOWN ROW ═══ */
        .payment-row {
            width: 100%;
            border-collapse: collapse;
            border: 1.5pt solid #2e7d32;
            border-top: none;
        }
        .payment-row td {
            border: 1.5pt solid #2e7d32;
            padding: 2pt 6pt;
            vertical-align: middle;
        }
        .pay-lbl {
            font-size: 6.5pt;
            font-weight: bold;
            color: #1a4a7a;
            white-space: nowrap;
        }
        .pay-val {
            font-size: 8pt;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #000;
        }

        /* ═══ FOOTER ═══ */
        .footer-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 3pt;
        }
        .footer-table td {
            vertical-align: bottom;
        }
        .footer-left {
            font-size: 6pt;
            color: #1a4a7a;
            line-height: 1.4;
        }
        .footer-right {
            text-align: right;
            width: 80pt;
        }
        .copy-label {
            font-size: 10pt;
            font-weight: bold;
            color: #2e7d32;
            margin-top: 2pt;
        }
        .weight-label {
            font-size: 5.5pt;
            color: #1a4a7a;
            text-align: right;
        }
        .weight-value {
            font-size: 8pt;
            font-weight: bold;
            color: #000;
            text-align: right;
        }

        /* ═══ REDEMPTION TYPE BADGE (GREEN) ═══ */
        .type-badge {
            background: #2e7d32;
            color: #fff;
            padding: 1.5pt 8pt;
            font-size: 7pt;
            font-weight: bold;
            display: inline-block;
            letter-spacing: 0.5pt;
            border-radius: 2pt;
        }

        @media print {
            html, body { margin: 0 !important; padding: 0 !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
    </style>
</head>
<body>
    @php
        $companyName = $settings['company_name'] ?? 'PAJAK GADAI SDN BHD';
        $chineseName = $settings['company_name_chinese'] ?? '';
        $tamilName = $settings['company_name_tamil'] ?? '';
        $address = $settings['address'] ?? '';
        $phone = $settings['phone'] ?? '';
        $phone2 = $settings['phone2'] ?? '';
        $estYear = $settings['established_year'] ?? '';
        $businessDays = $settings['business_days'] ?? 'ISNIN - AHAD';
        $businessHours = $settings['business_hours'] ?? '8.30AM - 6.00PM';
        $redemptionPeriod = $settings['redemption_period'] ?? '6 BULAN';
        $interestRateNormal = $settings['interest_rate_normal'] ?? '1.5';
        $interestRateOverdue = $settings['interest_rate_overdue'] ?? '2.0';
        $logoUrl = $settings['logo_url'] ?? null;

        // ─── REDEMPTION-SPECIFIC: get pledge from redemption ───
        $pledge = $redemption->pledge;
        $customer = $pledge->customer;
        $loanAmount = $pledge->loan_amount ?? 0;

        // ─── REDEMPTION AMOUNTS (principal + interest + fees) ───
        $principal = $redemption->principal_amount ?? $pledge->loan_amount ?? 0;
        $interestAmount = $redemption->interest_amount ?? 0;
        $handlingFee = $redemption->handling_fee ?? 0;
        $totalPaid = $redemption->total_payable ?? $redemption->total_amount ?? ($principal + $interestAmount + $handlingFee);
        $interestMonths = $redemption->interest_months ?? 1;

        // ─── PAYMENT DETAILS ───
        $paymentMethod = ucfirst($redemption->payment_method ?? 'cash');
        $cashAmount = $redemption->cash_amount ?? 0;
        $transferAmount = $redemption->transfer_amount ?? 0;
        $bankName = $redemption->bank->name ?? '';
        $referenceNo = $redemption->reference_no ?? '';

        $totalWeight = 0;
        $itemCount = count($pledge->items);
        foreach ($pledge->items as $item) {
            $totalWeight += $item->net_weight ?? $item->gross_weight ?? 0;
        }

        // ─── REDEMPTION DATES ───
        $redemptionDate = $redemption->created_at ?? now();
        if (is_string($redemptionDate)) $redemptionDate = \Carbon\Carbon::parse($redemptionDate);

        $pledgeDate = $pledge->pledge_date ?? $pledge->created_at;
        if (is_string($pledgeDate)) $pledgeDate = \Carbon\Carbon::parse($pledgeDate);

        $dueDate = $pledge->due_date;
        if (is_string($dueDate)) $dueDate = \Carbon\Carbon::parse($dueDate);

        // ─── CUSTOMER FORMATTING (same as pledge) ───
        $ic = preg_replace('/[^0-9]/', '', $customer->ic_number ?? '');
        $icFormatted = strlen($ic) === 12
            ? substr($ic, 0, 6) . '-' . substr($ic, 6, 2) . '-' . substr($ic, 8, 4)
            : ($ic ?: '-');

        if (!empty($customer->date_of_birth)) {
            try {
                $dob = $customer->date_of_birth;
                if (is_string($dob)) $dob = \Carbon\Carbon::parse($dob);
                $birthYear = $dob->format('Y');
            } catch (\Exception $e) { $birthYear = '-'; }
        } else {
            $birthYear = (strlen($ic) >= 6)
                ? ((intval(substr($ic, 0, 2)) > intval(date('y'))) ? '19' . substr($ic, 0, 2) : '20' . substr($ic, 0, 2))
                : '-';
        }

        $g = strtolower($customer->gender ?? '');
        $gender = in_array($g, ['male', 'm', 'lelaki']) ? 'LELAKI' : (in_array($g, ['female', 'f', 'perempuan']) ? 'PEREMPUAN' : '-');

        $nat = strtoupper($customer->nationality ?? '');
        $nationality = str_contains($nat, 'MALAYSIA') ? 'MALAYSIA' : ($nat ?: 'WARGANEGARA');

        $addrParts = array_filter([
            $customer->address_line1 ?? $customer->address ?? '',
            $customer->address_line2 ?? '',
            trim(($customer->postcode ?? '') . ' ' . ($customer->city ?? '')),
            strtoupper($customer->state ?? '')
        ]);
        $customerAddress = implode(', ', $addrParts) ?: '-';

        $catatan = $pledge->reference_no ?? $pledge->notes ?? '';
        $usedDescriptions = [];
        foreach ($pledge->items as $item) {
            $desc = $item->description ?? '';
            if ($desc && !in_array($desc, $usedDescriptions, true) && !str_contains($catatan, $desc)) {
                if ($catatan) $catatan .= '; ';
                $catatan .= $desc;
                $usedDescriptions[] = $desc;
            }
        }

        // ─── AMOUNT WORDS = TOTAL REDEEMED (principal + interest + fees) ───
        $amountWords = '';
        try {
            $amountWords = strtoupper(app(\App\Http\Controllers\Api\DotMatrixPrintController::class)->numberToMalayWordsPublic($totalPaid) ?? '');
        } catch (\Exception $e) {}
        if (empty($amountWords)) {
            $amountWords = strtoupper(number_format($totalPaid, 2));
        }

        $barcodeUrl = $barcode_data_uri ?? '';
        $copyLabel = ($copy_type ?? 'customer') === 'office' ? 'SALINAN PEJABAT' : 'SALINAN PELANGGAN';
    @endphp

    <div class="page">

        {{-- ═══ HEADER ═══ --}}
        <table class="header-table">
            <tr>
                <td class="header-left">
                    <table style="border-collapse: collapse;">
                        <tr>
                            @if($logoUrl)
                                <td style="vertical-align: top; padding-right: 6pt; width: 50pt;">
                                    <img src="{{ $logoUrl }}" class="logo" alt="Logo">
                                </td>
                            @endif
                            <td style="vertical-align: top;">
                                <div class="company-name">{{ $companyName }}</div>
                                @if($chineseName || $tamilName)
                                    <div class="company-multilang">{{ $chineseName }}&nbsp; {{ $tamilName }}</div>
                                @endif
                                <div class="company-address">{{ $address }}</div>
                            </td>
                        </tr>
                    </table>
                </td>
                <td class="header-right">
                    {{-- ─── CHANGED: GREEN redemption badge ─── --}}
                    <span class="type-badge">&#10003; PENEBUSAN / REDEMPTION</span>
                    <table style="margin-left: auto; border-collapse: collapse; margin-top: 2pt;">
                        <tr>
                            <td style="padding-right: 3pt;">
                                <span class="phone-box">&#9742; {{ $phone }}@if($phone2)<br>{{ $phone2 }}@endif</span>
                            </td>
                            @if($estYear)
                                <td><span class="established">SEJAK<br>{{ $estYear }}</span></td>
                            @endif
                        </tr>
                    </table>
                    <div class="hours-box">
                        <div class="hours-title">BUKA 7 HARI</div>
                        <div class="hours-line">{{ $businessDays }} : {{ $businessHours }}</div>
                    </div>
                </td>
            </tr>
        </table>

        {{-- ═══ MID SECTION (same items + barcode) ═══ --}}
        <table class="mid-section">
            <tr>
                <td class="items-cell">
                    {{-- ─── CHANGED: "artikel yang ditebus" instead of "digadai" ─── --}}
                    <div class="items-title">Perihal terperinci artikel yang ditebus:-</div>
                    <div class="items-area">
                        @foreach($pledge->items as $index => $item)
                            <div class="item-line">
                                {{ $index + 1 }}. {{ $item->category->name_ms ?? $item->category->name_en ?? 'Item' }}
                                {{ $item->purity->code ?? '' }}
                                - {{ number_format($item->net_weight ?? $item->gross_weight ?? 0, 2) }}g
                            </div>
                        @endforeach
                    </div>
                    <div class="barcode-area">
                        @if($barcodeUrl)
                            <img src="{{ $barcodeUrl }}" class="barcode-img" alt="{{ $pledge->pledge_no }}">
                        @endif
                        <div class="barcode-text">{{ $pledge->pledge_no }}</div>
                    </div>
                </td>
                <td class="right-col">
                    {{-- SAME: Pledge ticket number ─── --}}
                    <div class="ticket-box">
                        <div class="ticket-label">NO. TIKET:</div>
                        <div class="ticket-number">{{ $pledge->pledge_no }}</div>
                    </div>
                    {{-- ─── NEW: Redemption number (green) ─── --}}
                    <div class="redemption-no-box">
                        <div class="redemption-no-label">NO. PENEBUSAN:</div>
                        <div class="redemption-no-value">{{ $redemption->redemption_no }}</div>
                    </div>
                    {{-- ─── CHANGED: Status "DITEBUS" instead of "TEMPOH TAMAT" (no due date needed) ─── --}}
                    <div class="status-section">
                        <div class="status-label">STATUS GADAIAN</div>
                        <div class="status-value">DITEBUS</div>
                    </div>
                    {{-- ─── CHANGED: Payment breakdown instead of interest rates ─── --}}
                    <div class="kadar-section">
                        <div class="kadar-title">BUTIRAN BAYARAN / PAYMENT DETAILS</div>
                        <div class="kadar-line">Pinjaman Pokok : RM {{ number_format($principal, 2) }}</div>
                        <div class="kadar-line">Faedah ({{ $interestMonths }} bln) : RM {{ number_format($interestAmount, 2) }}</div>
                        @if($handlingFee > 0)
                            <div class="kadar-line">Yuran Pengendalian : RM {{ number_format($handlingFee, 2) }}</div>
                        @endif
                        <div class="kadar-line" style="border-top: 0.5pt solid #1a4a7a; padding-top: 1pt; margin-top: 1pt; font-weight: bold; font-size: 6pt;">
                            JUMLAH : RM {{ number_format($totalPaid, 2) }}
                        </div>
                    </div>
                </td>
            </tr>
        </table>

        {{-- ═══ CUSTOMER (same layout, GREEN border) ═══ --}}
        <div class="cust-heading">Butir-butir terperinci mengenai pemajak gadai:-</div>
        <div class="cust-box">
            <table class="cust-grid">
                <tr>
                    <td style="width: 14%;"><span class="cl">No. Kad</span><br><span class="cl">Pengenalan :</span></td>
                    <td style="width: 20%;"><span class="cv">{{ $icFormatted }}</span></td>
                    <td style="width: 8%;"><span class="cl">Nama :</span></td>
                    <td style="width: 28%;"><span class="cv">{{ $customer->name ?? '-' }}</span></td>
                    <td style="width: 10%;"><span class="cl">Kerakyatan :</span></td>
                    <td style="width: 20%;"><span class="cv">{{ $nationality }}</span></td>
                </tr>
            </table>
            <table class="cust-grid">
                <tr>
                    <td style="width: 14%;"><span class="cl">Tahun Lahir :</span></td>
                    <td style="width: 20%;"><span class="cv">{{ $birthYear }}</span></td>
                    <td style="width: 8%;"><span class="cl">Jantina :</span></td>
                    <td style="width: 58%;"><span class="cv">{{ $gender }}</span></td>
                </tr>
            </table>
            <table class="cust-grid">
                <tr>
                    <td style="width: 10%;"><span class="cl">Alamat :</span></td>
                    <td style="width: 90%;"><span class="cv">{{ $customerAddress }}</span></td>
                </tr>
            </table>
            <table class="cust-grid">
                <tr>
                    <td style="width: 10%;"><span class="cl">Catatan :</span></td>
                    <td style="width: 90%;"><span class="cv">{{ $catatan }}</span></td>
                </tr>
            </table>
        </div>

        {{-- ═══ AMOUNT (total redeemed in words) ═══ --}}
        <div class="amount-box">
            <span class="amount-label">Amaun Penebusan</span>&nbsp;&nbsp;
            <span class="amount-words">{{ $amountWords }} SAHAJA</span>
        </div>

        {{-- ═══ BOTTOM (total paid + redemption date) ═══ --}}
        <table class="bottom-table">
            <tr>
                <td class="pinjaman-cell">
                    {{-- ─── CHANGED: "Jumlah Penebusan" instead of "Pinjaman" ─── --}}
                    <span class="pinjaman-label">Jumlah Penebusan</span>
                    <span class="pinjaman-rm">RM</span>
                    <span class="pinjaman-amount">{{ number_format($totalPaid, 2) }}</span>
                    <span class="pinjaman-stars">***</span>
                </td>
                <td class="date-cell">
                    {{-- ─── CHANGED: "Tarikh Penebusan" instead of "Tarikh Dipajak" ─── --}}
                    <div class="date-label">Tarikh Penebusan</div>
                    <div class="date-value">{{ $redemptionDate->format('d/m/Y') }}</div>
                </td>
            </tr>
        </table>

        {{-- ═══ NEW: Payment + original pledge info row ═══ --}}
        <table class="payment-row">
            <tr>
                <td>
                    <span class="pay-lbl">Kaedah:</span>
                    <span class="pay-val">{{ $paymentMethod }}</span>
                </td>
                @if($cashAmount > 0)
                    <td>
                        <span class="pay-lbl">Tunai:</span>
                        <span class="pay-val">RM {{ number_format($cashAmount, 2) }}</span>
                    </td>
                @endif
                @if($transferAmount > 0)
                    <td>
                        <span class="pay-lbl">Pindahan:</span>
                        <span class="pay-val">RM {{ number_format($transferAmount, 2) }}</span>
                    </td>
                @endif
                @if($bankName)
                    <td>
                        <span class="pay-lbl">Bank:</span>
                        <span class="pay-val">{{ $bankName }}</span>
                    </td>
                @endif
                @if($referenceNo)
                    <td>
                        <span class="pay-lbl">Rujukan:</span>
                        <span class="pay-val">{{ $referenceNo }}</span>
                    </td>
                @endif
            </tr>
            <tr>
                <td>
                    <span class="pay-lbl">Tarikh Pajak Asal:</span>
                    <span class="pay-val">{{ $pledgeDate->format('d/m/Y') }}</span>
                </td>
                <td>
                    <span class="pay-lbl">Pinjaman Asal:</span>
                    <span class="pay-val">RM {{ number_format($loanAmount, 2) }}</span>
                </td>
                <td colspan="3" style="background: #e8f5e9; text-align: center;">
                    <span style="font-size: 8pt; font-weight: bold; color: #2e7d32;">&#10003; {{ $itemCount }} BARANG DITEBUS / {{ $itemCount }} ITEM(S) RELEASED</span>
                </td>
            </tr>
        </table>

        {{-- ═══ FOOTER (changed: check items message + GREEN color) ═══ --}}
        <table class="footer-table">
            <tr>
                <td class="footer-left">
                    {{-- ─── CHANGED: Redemption-specific message ─── --}}
                    <div>Anda diminta memeriksa barang tebusan dan butir-butir di atas dengan teliti sebelum meninggalkan kedai ini.</div>
                    <div>Barang telah diterima dalam keadaan baik. Sebarang tuntutan selepas meninggalkan kedai ini tidak akan dilayan.</div>
                    <div class="copy-label">{{ $copyLabel }}</div>
                </td>
                <td class="footer-right">
                    <div class="weight-label">Termasuk Emas, Batu<br>dan lain-lain</div>
                    <div class="weight-value">{{ number_format($totalWeight, 2) }}g</div>
                </td>
            </tr>
        </table>

    </div>
</body>
</html>