<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resit Pembaharuan - {{ $renewal->renewal_no ?? $pledge->pledge_no }}</title>
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
        /* ═══ RENEWAL NO BOX (NEW) ═══ */
        .renewal-no-box {
            background: #fff3e0;
            padding: 2pt 4pt;
            text-align: center;
            border-bottom: 1.5pt solid #1a4a7a;
        }
        .renewal-no-label {
            font-size: 5.5pt;
            font-weight: bold;
            color: #e65100;
        }
        .renewal-no-value {
            font-size: 9pt;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #e65100;
        }
        .rate-section {
            text-align: center;
            padding: 3pt 4pt;
            border-bottom: 1.5pt solid #1a4a7a;
        }
        .rate-label {
            font-size: 5.5pt;
            font-weight: bold;
            color: #1a4a7a;
        }
        .rate-value {
            font-size: 13pt;
            font-weight: bold;
            color: #1a4a7a;
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
            border: 1.5pt solid #d42027;
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
            border: 1.5pt solid #d42027;
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
            border: 1.5pt solid #d42027;
        }
        .bottom-table td {
            border: 1.5pt solid #d42027;
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

        /* ═══ INTEREST BREAKDOWN ROW ═══ */
        .interest-row {
            width: 100%;
            border-collapse: collapse;
            border: 1.5pt solid #d42027;
            border-top: none;
        }
        .interest-row td {
            border: 1.5pt solid #d42027;
            padding: 2pt 6pt;
            vertical-align: middle;
        }
        .int-lbl {
            font-size: 6.5pt;
            font-weight: bold;
            color: #1a4a7a;
            white-space: nowrap;
        }
        .int-val {
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
            color: #d42027;
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

        /* ═══ RENEWAL TYPE BADGE ═══ */
        .type-badge {
            background: #d42027;
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

        // ─── RENEWAL-SPECIFIC: get pledge from renewal ───
        $pledge = $renewal->pledge;
        $customer = $pledge->customer;
        $loanAmount = $pledge->loan_amount ?? 0;

        // ─── RENEWAL AMOUNTS ───
        $interestAmount = $renewal->interest_amount ?? 0;
        $handlingFee = $renewal->handling_fee ?? 0;
        $totalPaid = $renewal->total_payable ?? $renewal->total_amount ?? ($interestAmount + $handlingFee);
        $renewalMonths = $renewal->renewal_months ?? 1;

        // ─── PAYMENT DETAILS ───
        $paymentMethod = ucfirst($renewal->payment_method ?? 'cash');
        $cashAmount = $renewal->cash_amount ?? 0;
        $transferAmount = $renewal->transfer_amount ?? 0;
        $bankName = $renewal->bank->name ?? '';
        $referenceNo = $renewal->reference_no ?? '';

        $totalWeight = 0;
        foreach ($pledge->items as $item) {
            $totalWeight += $item->net_weight ?? $item->gross_weight ?? 0;
        }

        // ─── RENEWAL DATES ───
        $renewalDate = $renewal->created_at ?? now();
        if (is_string($renewalDate)) $renewalDate = \Carbon\Carbon::parse($renewalDate);

        $previousDueDate = $renewal->previous_due_date ?? $pledge->due_date;
        if (is_string($previousDueDate)) $previousDueDate = \Carbon\Carbon::parse($previousDueDate);

        $newDueDate = $renewal->new_due_date ?? $pledge->due_date;
        if (is_string($newDueDate)) $newDueDate = \Carbon\Carbon::parse($newDueDate);

        $pledgeDate = $pledge->pledge_date ?? $pledge->created_at;
        if (is_string($pledgeDate)) $pledgeDate = \Carbon\Carbon::parse($pledgeDate);

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

        // ─── AMOUNT WORDS = TOTAL PAID (interest+fees), not loan amount ───
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
                    {{-- ─── CHANGED: Renewal badge top-right ─── --}}
                    <span class="type-badge">PEMBAHARUAN / RENEWAL</span>
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

        {{-- ═══ MID SECTION (same items list + barcode) ═══ --}}
        <table class="mid-section">
            <tr>
                <td class="items-cell">
                    <div class="items-title">Perihal terperinci artikel yang digadai:-</div>
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
                    {{-- ─── SAME: Pledge ticket number (unchanged on renewal) ─── --}}
                    <div class="ticket-box">
                        <div class="ticket-label">NO. TIKET:</div>
                        <div class="ticket-number">{{ $pledge->pledge_no }}</div>
                    </div>
                    {{-- ─── NEW: Renewal number ─── --}}
                    <div class="renewal-no-box">
                        <div class="renewal-no-label">NO. PEMBAHARUAN:</div>
                        <div class="renewal-no-value">{{ $renewal->renewal_no }}</div>
                    </div>
                    {{-- ─── CHANGED: "TEMPOH TAMAT BARU" instead of "TEMPOH TAMAT" ─── --}}
                    <div class="rate-section">
                        <div class="rate-label">TEMPOH TAMAT BARU</div>
                        <div class="rate-value">{{ $redemptionPeriod }}</div>
                    </div>
                    <div class="kadar-section">
                        <div class="kadar-title">KADAR KEUNTUNGAN BULANAN</div>
                        <div class="kadar-line">0.5% Sebulan : Untuk tempoh 6 bulan pertama</div>
                        <div class="kadar-line">{{ $interestRateNormal }}% Sebulan : Dalam tempoh 6 bulan</div>
                        <div class="kadar-line">{{ $interestRateOverdue }}% Sebulan : Lepas tempoh 6 bulan</div>
                    </div>
                </td>
            </tr>
        </table>

        {{-- ═══ CUSTOMER (same as pledge) ═══ --}}
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

        {{-- ═══ AMOUNT (changed: shows total paid in words, not loan amount) ═══ --}}
        <div class="amount-box">
            <span class="amount-label">Amaun Dibayar</span>&nbsp;&nbsp;
            <span class="amount-words">{{ $amountWords }} SAHAJA</span>
        </div>

        {{-- ═══ BOTTOM (changed: loan stays same, date = renewal date) ═══ --}}
        <table class="bottom-table">
            <tr>
                <td class="pinjaman-cell">
                    <span class="pinjaman-label">Pinjaman Asal</span>
                    <span class="pinjaman-rm">RM</span>
                    <span class="pinjaman-amount">{{ number_format($loanAmount, 2) }}</span>
                    <span class="pinjaman-stars">***</span>
                </td>
                <td class="date-cell">
                    {{-- ─── CHANGED: "Tarikh Pembaharuan" instead of "Tarikh Dipajak" ─── --}}
                    <div class="date-label">Tarikh Pembaharuan</div>
                    <div class="date-value">{{ $renewalDate->format('d/m/Y') }}</div>
                </td>
            </tr>
        </table>

        {{-- ═══ NEW: Interest + Payment breakdown row ═══ --}}
        <table class="interest-row">
            <tr>
                <td>
                    <span class="int-lbl">Faedah ({{ $renewalMonths }} bln):</span>
                    <span class="int-val">RM {{ number_format($interestAmount, 2) }}</span>
                </td>
                @if($handlingFee > 0)
                    <td>
                        <span class="int-lbl">Yuran:</span>
                        <span class="int-val">RM {{ number_format($handlingFee, 2) }}</span>
                    </td>
                @endif
                <td>
                    <span class="int-lbl">Jumlah Dibayar:</span>
                    <span class="int-val" style="color: #d42027; font-size: 9pt;">RM {{ number_format($totalPaid, 2) }}</span>
                </td>
                <td>
                    <span class="int-lbl">Kaedah:</span>
                    <span class="int-val">{{ $paymentMethod }}</span>
                    @if($transferAmount > 0 && $bankName)
                        <span class="int-lbl" style="padding-left: 4pt;">{{ $bankName }}</span>
                    @endif
                </td>
            </tr>
            {{-- ─── NEW: Date comparison row ─── --}}
            <tr>
                <td>
                    <span class="int-lbl">Tarikh Pajak Asal:</span>
                    <span class="int-val">{{ $pledgeDate->format('d/m/Y') }}</span>
                </td>
                <td>
                    <span class="int-lbl">Tarikh Tamat Lama:</span>
                    <span class="int-val">{{ $previousDueDate->format('d/m/Y') }}</span>
                </td>
                <td style="background: #e8f5e9;" colspan="{{ $handlingFee > 0 ? 1 : 2 }}">
                    <span class="int-lbl" style="color: #2e7d32;">Tarikh Tamat Baru:</span>
                    <span class="int-val" style="color: #2e7d32; font-size: 9pt;">{{ $newDueDate->format('d/m/Y') }}</span>
                </td>
                @if($handlingFee > 0)
                    <td>
                        @if($referenceNo)
                            <span class="int-lbl">Rujukan:</span>
                            <span class="int-val">{{ $referenceNo }}</span>
                        @endif
                    </td>
                @endif
            </tr>
        </table>

        {{-- ═══ FOOTER (same as pledge) ═══ --}}
        <table class="footer-table">
            <tr>
                <td class="footer-left">
                    <div>Sila simpan resit ini sebagai bukti pembayaran faedah dan pembaharuan gadaian anda.</div>
                    <div>Sebarang tuntutan selepas meninggalkan kedai ini tidak akan dilayan. Lindungan insuran di bawah polisi No :</div>
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