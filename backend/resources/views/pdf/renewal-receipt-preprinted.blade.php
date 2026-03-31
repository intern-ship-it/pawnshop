<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resit Pembaharuan - {{ $renewal->renewal_no ?? $pledge->pledge_no }}</title>
    <style>
        @page {
            size:710pt 550pt;
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
            width: 710pt;
            height: 550pt;
        }

        /* ═══ PAGE ═══ */
        .page {
            width: 682pt;
            padding: 10pt 8pt 6pt 14pt;
            overflow: visible;
            position: relative;
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
            width: 100pt;
            max-width: 100pt;
            vertical-align: top;
        }
        .company-name {
            font-size: 22pt;
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
            font-size: 11.5pt;
            color: #1a4a7a;
            margin-top: 1pt;
        }
        .phone-box {
            background: #d42027;
            color: #fff;
            padding: 3mm 4mm;
            font-size: 9pt;
            font-weight: bold;
            display: inline-block;
            text-align: center;
            line-height: 1.3;
            white-space: nowrap;
            border-radius: 3px;
        }
        .established {
            background: #d42027;
            color: #fff;
            padding: 8pt 6pt;
            font-size: 7pt;
            font-weight: bold;
            display: inline-block;
            text-align: center;
            line-height: 1.2;
            border-radius: 55%;
        }
        .hours-box {
            background: #f5c518;
            color: #000;
            padding: 5pt 8pt 5pt 8pt;
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

        /* ═══ RENEWAL TYPE BADGE ═══ */
        .type-badge {
            background: #d42027;
            color: #fff;
            padding: 2pt 10pt;
            font-size: 7.5pt;
            font-weight: bold;
            display: inline-block;
            letter-spacing: 0.5pt;
            border-radius: 2pt;
            margin-bottom: 2pt;
        }

        /* ═══ MID SECTION ═══ */
        .mid-section {
            width: 100%;
            border: 1.5pt solid #1a4a7a;
            border-collapse: collapse;
            table-layout: fixed;
            margin-top: 4pt;
            margin-bottom: 4pt;
        }
        .mid-section td {
            vertical-align: top;
            border-left: 1.5pt solid #1a4a7a;
        }
        .items-cell {
            padding: 4pt 6pt;
            width: 40%;
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
            font-size: 8pt;
            font-weight: bold;
            color: #1a4a7a;
            margin-bottom: 2pt;
            line-height: 1.3;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
        .item-description-text {
            font-size: 7.5pt;
            font-weight: normal;
            color: #1a4a7a;
            word-wrap: break-word;
            overflow-wrap: break-word;
            display: inline;
        }
        .mid-section .barcode-cell {
            width: 20%;
            text-align: center;
            vertical-align: middle;
            padding: 6pt 4pt;
            border-left: 1.5pt dotted #1a4a7a;
            border-right: none;
        }
        .barcode-img {
            max-width: 120pt;
            height: 38pt;
        }
        .barcode-text {
            font-size: 6pt;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            text-align: center;
            color: #555;
            margin-top: 1pt;
        }
        .barcode-label {
            font-size: 5pt;
            text-align: center;
            color: #999;
            margin-top: 1pt;
            text-transform: uppercase;
            letter-spacing: 1pt;
        }
        .right-col {
            width: 40%;
        }
        .ticket-box {
            background: #f5c518;
            padding: 3pt 4pt;
            text-align: center;
            border-bottom: 1.5pt solid #1a4a7a;
        }
        .ticket-label {
            font-size: 7pt;
            font-weight: bold;
            color: #000;
            text-align: justify;
        }
        .ticket-number {
            font-size: 12pt;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #000;
            padding: 1pt 0;
        }
        /* ═══ RENEWAL NO BOX ═══ */
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
            font-size: 7pt;
            font-weight: bold;
            color: #1a4a7a;
            text-align: center;
            margin-bottom: 2pt;
        }
        .kadar-line {
            font-size: 7.5pt;
            color: #1a4a7a;
            line-height: 1.6;
            font-weight: 800;
        }

        /* ═══ CUSTOMER ═══ */
        .cust-heading {
            font-size: 6pt;
            font-weight: bold;
            color: #1a4a7a;
            padding: 1pt 0;
        }
        .cust-box {
            border: 1.5pt solid #d42027;
            padding: 2pt 6pt;
            margin-bottom: 2pt;
        }
        .cust-grid {
            width: 100%;
            border-collapse: collapse;
        }
        .cust-grid td {
            padding: 1.5pt 2pt;
            vertical-align: bottom;
        }
        .cl {
            font-size: 8pt;
            font-weight: bold;
            color: #1a4a7a;
            white-space: nowrap;
        }
        .cv {
            font-size: 8pt;
            font-weight: 900;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #000;
            white-space: nowrap;
        }

        /* ═══ RENEWAL PAYMENT SUMMARY ═══ */
        .renewal-summary {
            width: 100%;
            border: 1.5pt solid #d42027;
            border-collapse: collapse;
            margin-bottom: 2pt;
        }
        .renewal-summary td {
            padding: 1.5pt 6pt;
            border-bottom: 0.5pt solid #eee;
            vertical-align: middle;
        }
        .renewal-summary .rs-label {
            font-size: 7pt;
            font-weight: bold;
            color: #1a4a7a;
            width: 50%;
        }
        .renewal-summary .rs-value {
            font-size: 8pt;
            font-weight: 900;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #000;
            text-align: right;
        }
        .renewal-summary .rs-total {
            background: #fff3e0;
            font-size: 9pt;
            font-weight: 900;
            color: #e65100;
        }

        /* ═══ AMOUNT ═══ */
        .amount-box {
            border: 1.5pt solid #d42027;
            border-bottom: none;
            padding: 4pt 6pt;
            overflow: hidden;
        }
        .amount-label {
            font-size: 8pt;
            font-weight: bold;
            color: #1a4a7a;
        }
        .amount-words {
            font-size: 7.5pt;
            font-weight: 900;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #000;
            letter-spacing: 0.3pt;
        }

        /* ═══ BOTTOM ═══ */
        .bottom-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5pt solid #d42027;
        }
        .bottom-table td {
            border: 1.5pt solid #d42027;
            padding: 2pt 6pt;
            vertical-align: middle;
        }
        .pinjaman-cell { width: 62%; }
        .pinjaman-label {
            font-size: 7pt;
            font-weight: bold;
            color: #1a4a7a;
        }
        .pinjaman-rm {
            font-size: 8pt;
            font-weight: bold;
            color: #1a4a7a;
            padding-left: 6pt;
        }
        .pinjaman-amount {
            font-size: 18pt;
            font-weight: 900;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #000;
            padding-left: 20pt;
        }
        .pinjaman-stars {
            font-size: 12pt;
            font-weight: bold;
            color: #000;
            float: right;
        }
        .keuntungan-text {
            font-size: 9.5pt;
            font-weight: bold;
            color: #1a4a7a;
            padding-left: 6pt;
        }
        .date-cell {
            text-align: center;
            width: 38%;
        }
        .date-label {
            font-size: 6pt;
            font-weight: bold;
            color: #1a4a7a;
        }
        .date-value {
            font-size: 9pt;
            font-weight: 800;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #000;
            margin-bottom: 3pt;
        }
        .date-new-label {
            font-size: 6pt;
            font-weight: bold;
            color: #e65100;
        }
        .date-new-value {
            font-size: 9pt;
            font-weight: 800;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #e65100;
            margin-bottom: 1pt;
        }

        /* ═══ FOOTER ═══ */
        .footer-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 2pt;
        }
        .footer-left {
            font-size: 7pt;
            color: #1a4a7a;
            line-height: 1.3;
        }
        .footer-right {
            text-align: right;
            width: 80pt;
        }
        .copy-label {
            font-size: 8pt;
            font-weight: bold;
            color: #d42027;
            margin-top: 1pt;
        }
        .weight-label {
            font-size: 6.5pt;
            color: #1a4a7a;
            text-align: right;
        }
        .weight-value {
            font-size: 7pt;
            font-weight: bold;
            color: #000;
            text-align: right;
        }

        @media print {
            html, body { margin: 0 !important; padding: 0 !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
    </style>
</head>
<body>
    @php
        $pledge = $renewal->pledge;
        $companyName = $settings['company_name'] ?? 'PAJAK GADAI SDN BHD';
        $chineseName = $settings['company_name_chinese'] ?? '';
        $tamilName = $settings['company_name_tamil'] ?? '';
        $address = $settings['address'] ?? '';
        $phone = $settings['phone'] ?? '';
        $phone2 = $settings['phone2'] ?? '';
        $estYear = $settings['established_year'] ?? '';
        $businessDays = $settings['business_days'] ?? 'ISNIN - AHAD';
        $businessHours = $settings['business_hours'] ?? '9.00AM - 6.00PM';
        $redemptionPeriod = $settings['redemption_period'] ?? '6 BULAN';
        $interestRateNormal = $settings['interest_rate_normal'] ?? '1.5';
        $interestRateOverdue = $settings['interest_rate_overdue'] ?? '2.0';
        $logoUrl = $settings['logo_url'] ?? null;

        $customer = $pledge->customer;
        $loanAmount = $pledge->loan_amount ?? 0;

        // Renewal-specific amounts
        $interestAmount = $renewal->interest_amount ?? 0;
        $handlingFee = $renewal->handling_fee ?? 0;
        $totalPayable = $renewal->total_payable ?? ($interestAmount + $handlingFee);
        $renewalMonths = $renewal->renewal_months ?? 1;
        $renewalCount = $renewal->renewal_count ?? 1;

        $totalWeight = 0;
        foreach ($pledge->items as $item) {
            $totalWeight += $item->net_weight ?? $item->gross_weight ?? 0;
        }

        // Renewal date
        $renewalDate = $renewal->created_at ?? now();
        if (is_string($renewalDate)) $renewalDate = \Carbon\Carbon::parse($renewalDate);

        // Previous due date
        $previousDueDate = $renewal->previous_due_date ?? $pledge->due_date;
        if (is_string($previousDueDate)) $previousDueDate = \Carbon\Carbon::parse($previousDueDate);

        // New due date
        $newDueDate = $renewal->new_due_date;
        if (is_string($newDueDate)) $newDueDate = \Carbon\Carbon::parse($newDueDate);

        // Original pledge date
        $pledgeDate = $pledge->pledge_date ?? $pledge->created_at;
        if (is_string($pledgeDate)) $pledgeDate = \Carbon\Carbon::parse($pledgeDate);

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
        $race = strtoupper($customer->race ?? '');
        $nationality = str_contains($nat, 'MALAYSIA') ? 'MALAYSIA' : ($nat ?: 'WARGANEGARA');
        if ($race) $nationality .= '  (' . $race . ')';

        $addrParts = array_filter([
            $customer->address_line1 ?? $customer->address ?? '',
            $customer->address_line2 ?? '',
            trim(($customer->postcode ?? '') . ' ' . ($customer->city ?? '')),
            strtoupper($customer->state ?? '')
        ]);
        $customerAddress = implode(', ', $addrParts) ?: '-';

        $catatan = $pledge->reference_no ?? $pledge->notes ?? '';

        // Amount in words for total payable (renewal payment)
        $amountWords = '';
        try {
            $amountWords = strtoupper(app(\App\Http\Controllers\Api\DotMatrixPrintController::class)->numberToMalayWordsPublic($totalPayable) ?? '');
        } catch (\Exception $e) {}
        if (empty($amountWords)) {
            $amountWords = strtoupper(number_format($totalPayable, 2));
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
                                <td style="vertical-align: top; width: 100pt;">
                                    <img src="{{ $logoUrl }}" class="logo" alt="Logo">
                                </td>
                            @endif
                            <td style="vertical-align: top;">
                                <div class="company-name">{{ $companyName }}</div>
                                @if(($chineseName || $tamilName) && !empty($multilang_image_uri ?? null))
                                    <div class="company-multilang"><img src="{{ $multilang_image_uri }}" style="height: 33pt; width: auto;" alt="{{ $chineseName }} {{ $tamilName }}"></div>
                                @elseif($chineseName || $tamilName)
                                    <div class="company-multilang">{{ $chineseName }}&nbsp; {{ $tamilName }}</div>
                                @endif
                                <div class="company-address">{{ $address }}</div>
                            </td>
                        </tr>
                    </table>
                </td>
                <td class="header-right">
                    {{-- Renewal badge top-right --}}
                    <span class="type-badge">PEMBAHARUAN / RENEWAL</span>
                    <table style="margin-left: auto; border-collapse: collapse; width: auto; margin-top: 2pt;">
                        <tr>
                            <td style="padding-right: 3pt; vertical-align: middle;">
                                <span class="phone-box">&#9742; {{ $phone }}@if($phone2)<br>{{ $phone2 }}@endif</span>
                            </td>
                            @if($estYear)
                                <td style="vertical-align: middle; padding-left: 3pt;"><span class="established">SEJAK<br>{{ $estYear }}</span></td>
                            @endif
                        </tr>
                        <tr>
                            <td colspan="{{ $estYear ? '2' : '1' }}" style="padding-top: 3pt;">
                                <div class="hours-box">
                                    <div class="hours-title">BUKA 7 HARI</div>
                                    <div class="hours-line">{{ $businessDays }} : {{ $businessHours }}</div>
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        {{-- ═══ MID SECTION ═══ --}}
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
                                @if(!empty($item->description))
                                    -- <span class="item-description-text">{{ $item->description }}</span>
                                @endif
                            </div>
                        @endforeach
                    </div>
                </td>
                <td class="barcode-cell">
                    @if($barcodeUrl)
                        <img src="{{ $barcodeUrl }}" class="barcode-img" alt="{{ $pledge->pledge_no }}">
                    @endif
                    <div class="barcode-text">{{ $pledge->pledge_no }}</div>
                    <div class="barcode-label">BARCODE</div>
                </td>
                <td class="right-col">
                    <div class="ticket-box">
                        <div class="ticket-label">NO. TIKET:</div>
                        <div class="ticket-number">{{ $pledge->pledge_no }}</div>
                    </div>
                    {{-- Renewal number sub-box --}}
                    <div class="renewal-no-box">
                        <div class="renewal-no-label">NO. PEMBAHARUAN / RENEWAL NO:</div>
                        <div class="renewal-no-value">{{ $renewal->renewal_no }}</div>
                    </div>
                    <div class="rate-section">
                        <div class="rate-label">TEMPOH TAMAT BARU / NEW DUE DATE</div>
                        <div class="rate-value">{{ $newDueDate ? $newDueDate->format('d/m/Y') : '-' }}</div>
                    </div>
                    <div class="kadar-section">
                        <div class="kadar-title">KADAR KEUNTUNGAN BULANAN</div>
                        <div class="kadar-line"><span style="font-weight: bold;color:black;"> 1.</span> {{ number_format($pledge->interest_rate, 1) }}% SEBULAN : UNTUK TEMPOH 6 BULAN PERTAMA</div>
                        <div class="kadar-line"><span style="font-weight: bold;color:black;"> 2.</span> {{ number_format($pledge->interest_rate_extended, 1) }}% SEBULAN : PEMBAHARUAN SETERUSNYA TEMPOH 6 BULAN</div>
                        <div class="kadar-line"><span style="font-weight: bold;color:black;"> 3.</span> {{ number_format($pledge->interest_rate_overdue, 1) }}% SEBULAN : LEPAS MATANG TEMPOH 6 BULAN</div>
                    </div>
                </td>
            </tr>
        </table>

        {{-- ═══ CUSTOMER ═══ --}}
        <div class="cust-heading">Butir-butir terperinci mengenai pemajak gadai:-</div>
        <div class="cust-box">
            <table class="cust-grid">
                <tr>
                    <td style="width: 9%;"><span class="cl">No. Kad</span><br><span class="cl">Pengenalan :</span></td>
                    <td style="width: 15%;"><span class="cv">{{ $icFormatted }}</span></td>
                    <td style="width: 3%;"><span class="cl">Nama :</span></td>
                    <td style="width: 25%;"><span class="cv">{{ $customer->name ?? '-' }}</span></td>
                    <td style="width: 7%;"><span class="cl">Kerakyatan :</span></td>
                    <td style=""><span class="cv">{{ $nationality }}</span></td>
                </tr>
                <tr>
                    <td><span class="cl">Tahun Lahir :</span></td>
                    <td><span class="cv">{{ $birthYear }}</span></td>
                    <td><span class="cl">Jantina :</span></td>
                    <td colspan="3"><span class="cv">{{ $gender }}</span></td>
                </tr>
                <tr>
                    <td><span class="cl">Alamat :</span></td>
                    <td colspan="5"><span class="cv">{{ $customerAddress }}</span></td>
                </tr>
                <!-- <tr>
                    <td><span class="cl">Catatan :</span></td>
                    <td colspan="5"><span class="cv">{{ $catatan }}</span></td>
                </tr> -->
            </table>
        </div>

        {{-- ═══ RENEWAL PAYMENT SUMMARY ═══ --}}
        <table class="renewal-summary">
            <tr>
                <td class="rs-label">Faedah / Interest :</td>
                <td class="rs-value">RM {{ number_format($interestAmount, 2) }}</td>
                <td class="rs-label rs-total">JUMLAH BAYARAN / TOTAL PAID :</td>
                <td class="rs-value rs-total">RM {{ number_format($totalPayable, 2) }}</td>
            </tr>
        </table>

        {{-- ═══ AMOUNT IN WORDS ═══ --}}
        <div class="amount-box">
            <span class="amount-label">Jumlah :</span>&nbsp;&nbsp;
            <span class="amount-words">{{ $amountWords }} SAHAJA</span>
        </div>

        {{-- ═══ BOTTOM ═══ --}}
        @php
            $monthlyInterest = $loanAmount * ($pledge->interest_rate / 100);
        @endphp
        <table class="bottom-table">
            <tr>
                <td class="pinjaman-cell">
                    <span class="pinjaman-label">Pinjaman</span>
                    <span class="pinjaman-rm">RM</span>
                    <span class="pinjaman-amount">{{ number_format($loanAmount, 2) }}</span>
                    <span class="keuntungan-text">Keuntungan Dikena RM {{ number_format($monthlyInterest, 2) }} sebulan</span>
                    <span class="pinjaman-stars">***</span>
                </td>
                <td class="date-cell">
                    <div class="date-new-label">Tarikh Tamat Baru / New Due Date</div>
                    <div class="date-new-value">{{ $newDueDate ? $newDueDate->format('d/m/Y') : '-' }}</div>
                </td>
            </tr>
        </table>

        {{-- ═══ FOOTER ═══ --}}
        <table class="footer-table">
            <tr>
                <td class="footer-left">
                    <div>Anda diminta memeriksa barang gadaian dan butir-butir di atas dengan teliti sebelum meninggalkan kedai ini.</div>
                    <div>Sebarang tuntutan selepas meninggalkan kedai ini tidak akan dilayan. Lindungan insuran di bawah <strong>polisi No : {{ $settings['insurance_policy_no'] ?? '' }}</strong></div>
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