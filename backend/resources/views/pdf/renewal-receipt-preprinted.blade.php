<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resit Pembaharuan - {{ $renewal->renewal_no }}</title>
    <style>
        @page {
            size: A5 landscape;
            margin: 0;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'DejaVu Sans', Arial, Helvetica, sans-serif;
            font-size: 9px;
            color: #1a4a7a;
            background: #fff;
            width: 210mm;
            height: 148mm;
        }

        /* ═══ PAGE CONTAINER ═══ */
        .page {
            width: 210mm;
            height: 148mm;
            padding: 3mm 5mm;
            position: relative;
            overflow: hidden;
            page-break-after: always;
        }

        /* ═══ HEADER ═══ */
        .header-table {
            width: 100%;
            border-collapse: collapse;
            border-bottom: 1px solid #1a4a7a;
            padding-bottom: 1.5mm;
            margin-bottom: 1.5mm;
        }
        .logo {
            width: 12mm;
            height: 12mm;
            vertical-align: top;
            margin-right: 2mm;
        }
        .company-name {
            font-size: 18px;
            font-weight: bold;
            color: #1a4a7a;
            line-height: 1.1;
        }
        .company-multilang {
            font-size: 14px;
            font-weight: bold;
            color: #1a4a7a;
            margin-top: 0.5mm;
        }
        .company-address {
            font-size: 8px;
            color: #1a4a7a;
            margin-top: 0.5mm;
        }
        .phone-box {
            background: #d42027;
            color: #fff;
            padding: 1.5mm 3mm;
            font-size: 9px;
            font-weight: bold;
            display: inline-block;
            border-radius: 3px;
        }
        .established {
            background: #d42027;
            color: #fff;
            padding: 2mm 3mm;
            font-size: 8px;
            font-weight: bold;
            display: inline-block;
            border-radius: 50%;
            text-align: center;
            line-height: 1.1;
        }
        .hours-box {
            background: #f5c518;
            color: #000;
            padding: 1mm 2mm;
            text-align: center;
            margin-top: 1mm;
        }
        .hours-title {
            font-size: 9px;
            font-weight: bold;
        }
        .hours-line {
            font-size: 6px;
            font-weight: bold;
            color: #1a4a7a;
        }

        /* ═══ TRANSACTION TYPE BANNER ═══ */
        .type-banner {
            background: #d42027;
            color: #fff;
            text-align: center;
            padding: 1.5mm 4mm;
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 1px;
            margin-bottom: 1mm;
        }

        /* ═══ MIDDLE SECTION ═══ */
        .mid-section {
            width: 100%;
            border: 1px solid #1a4a7a;
            border-collapse: collapse;
            margin-bottom: 1mm;
        }
        .mid-section td {
            vertical-align: top;
            border: 1px solid #1a4a7a;
        }
        .items-cell {
            padding: 1.5mm 2mm;
            width: 63%;
        }
        .items-title {
            font-size: 8px;
            font-weight: bold;
            margin-bottom: 1mm;
        }
        .items-area {
            min-height: 22mm;
            padding-left: 2mm;
        }
        .item-line {
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 1mm;
        }
        .barcode-area {
            text-align: center;
            padding: 2mm 0;
        }
        .barcode-img {
            max-width: 55mm;
            height: 14mm;
        }
        .barcode-text {
            font-size: 8px;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            text-align: center;
            color: #666;
            margin-top: 0.5mm;
        }
        .right-col {
            width: 37%;
        }
        .ticket-box {
            background: #f5c518;
            padding: 1.5mm;
            text-align: center;
            border-bottom: 1px solid #1a4a7a;
        }
        .ticket-label {
            font-size: 8px;
            font-weight: bold;
            color: #000;
        }
        .ticket-number {
            font-size: 13px;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #d42027;
            padding: 1mm 0;
        }
        .rate-section {
            text-align: center;
            padding: 1.5mm;
            border-bottom: 1px solid #1a4a7a;
        }
        .rate-label {
            font-size: 6px;
            font-weight: bold;
        }
        .rate-value {
            font-size: 16px;
            font-weight: bold;
        }
        .kadar-section {
            padding: 1.5mm 2mm;
        }
        .kadar-title {
            font-size: 7px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 1mm;
        }
        .kadar-line {
            font-size: 7px;
            line-height: 1.5;
        }

        /* ═══ CUSTOMER SECTION ═══ */
        .cust-title {
            font-size: 8px;
            font-weight: bold;
            padding: 1mm 0;
        }
        .cust-box {
            border: 1px solid #d42027;
            padding: 2mm 3mm;
            margin-bottom: 1mm;
        }
        .cust-table {
            width: 100%;
            border-collapse: collapse;
        }
        .cust-table td {
            padding: 1mm 0;
            font-size: 9px;
            vertical-align: top;
        }
        .cust-label {
            font-size: 8px;
            font-weight: bold;
            white-space: nowrap;
            padding-right: 2mm;
        }
        .cust-value {
            font-size: 10px;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
        }

        /* ═══ AMOUNT & BOTTOM ═══ */
        .amount-row {
            border: 1px solid #d42027;
            border-bottom: none;
            padding: 1.5mm 3mm;
        }
        .amount-label {
            font-size: 10px;
            font-weight: bold;
        }
        .amount-words {
            font-size: 9px;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            margin-left: 3mm;
        }
        .bottom-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #d42027;
        }
        .bottom-table td {
            border: 1px solid #d42027;
            padding: 1.5mm 3mm;
            vertical-align: middle;
        }
        .pinjaman-label {
            font-size: 9px;
        }
        .pinjaman-rm {
            font-size: 10px;
            font-weight: bold;
            margin-left: 2mm;
        }
        .pinjaman-amount {
            font-size: 16px;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            margin-left: 4mm;
        }
        .pinjaman-stars {
            font-size: 12px;
            font-weight: bold;
            float: right;
        }
        .date-cell {
            text-align: center;
            width: 25%;
        }
        .date-cell-yellow {
            text-align: center;
            width: 25%;
            background: #f5c518;
        }
        .date-label {
            font-size: 7px;
            font-weight: bold;
        }
        .date-value {
            font-size: 11px;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
        }

        /* ═══ FOOTER ═══ */
        .copy-label {
            font-size: 10px;
            font-weight: bold;
            color: #d42027;
            margin-top: 1mm;
        }
        .weight-info {
            font-size: 8px;
            text-align: right;
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

        $pledge = $renewal->pledge;
        $customer = $pledge->customer;
        $loanAmount = $pledge->loan_amount ?? 0;
        $interestAmount = $renewal->interest_amount ?? 0;
        $handlingFee = $renewal->handling_fee ?? 0;
        $totalPaid = $renewal->total_amount ?? ($interestAmount + $handlingFee);

        $totalWeight = 0;
        foreach ($pledge->items as $item) {
            $totalWeight += $item->net_weight ?? $item->gross_weight ?? 0;
        }

        // Dates
        $renewalDate = $renewal->created_at ?? now();
        if (is_string($renewalDate)) $renewalDate = \Carbon\Carbon::parse($renewalDate);
        $newDueDate = $renewal->new_due_date;
        if (is_string($newDueDate)) $newDueDate = \Carbon\Carbon::parse($newDueDate);

        // Customer details
        $ic = preg_replace('/[^0-9]/', '', $customer->ic_number ?? '');
        $icFormatted = strlen($ic) === 12 ? substr($ic, 0, 6) . '-' . substr($ic, 6, 2) . '-' . substr($ic, 8, 4) : ($ic ?: '-');

        if (!empty($customer->date_of_birth)) {
            try {
                $dob = $customer->date_of_birth;
                if (is_string($dob)) $dob = \Carbon\Carbon::parse($dob);
                $birthYear = $dob->format('Y');
            } catch (\Exception $e) { $birthYear = '-'; }
        } else {
            $birthYear = (strlen($ic) >= 6) ? ((intval(substr($ic, 0, 2)) > intval(date('y'))) ? '19' . substr($ic, 0, 2) : '20' . substr($ic, 0, 2)) : '-';
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

        // Catatan for renewal
        $catatan = "SAMBUNGAN; Asal: {$pledge->pledge_no}; Faedah Dibayar: RM " . number_format($interestAmount, 2);
        $renewalCount = $renewal->renewal_count ?? 1;

        // Amount in words
        $amountWords = '';
        try {
            $amountWords = strtoupper(app(\App\Http\Controllers\Api\DotMatrixPrintController::class)->numberToMalayWordsPublic($loanAmount) ?? '');
        } catch (\Exception $e) {}
        if (empty($amountWords)) $amountWords = strtoupper(number_format($loanAmount, 2));

        // Barcode - use locally generated base64 data URI (no external requests)
        $barcodeUrl = $barcode_data_uri ?? '';
    @endphp

    <div class="page">

        <!-- HEADER -->
        <table class="header-table" style="border-bottom: 1px solid #1a4a7a; padding-bottom: 1.5mm; margin-bottom: 1.5mm;">
            <tr>
                <td style="vertical-align: top;">
                    @if($logoUrl)
                        <img src="{{ $logoUrl }}" class="logo" style="float: left; margin-right: 2mm;">
                    @endif
                    <div class="company-name">{{ $companyName }}</div>
                    @if($chineseName || $tamilName)
                        <div class="company-multilang">{{ $chineseName }} {{ $tamilName }}</div>
                    @endif
                    <div class="company-address">{{ $address }}</div>
                </td>
                <td style="vertical-align: top; text-align: right; width: 50mm;">
                    <table style="margin-left: auto; border-collapse: collapse;">
                        <tr>
                            <td style="padding-right: 1mm;">
                                <span class="phone-box">&#9742; {{ $phone }}@if($phone2)<br>{{ $phone2 }}@endif</span>
                            </td>
                            @if($estYear)
                            <td><span class="established">SEJAK<br>{{ $estYear }}</span></td>
                            @endif
                        </tr>
                    </table>
                    <div class="hours-box" style="margin-top: 1mm;">
                        <div class="hours-title">BUKA 7 HARI</div>
                        <div class="hours-line">{{ $businessDays }} : {{ $businessHours }}</div>
                    </div>
                </td>
            </tr>
        </table>

        <!-- TRANSACTION TYPE BANNER -->
        <div class="type-banner">SAMBUNGAN / RENEWAL #{{ $renewalCount }}</div>

        <!-- MIDDLE SECTION -->
        <table class="mid-section">
            <tr>
                <td class="items-cell">
                    <div class="items-title">Perihal terperinci artikel yang digadai:-</div>
                    <div class="items-area">
                        @foreach($pledge->items as $index => $item)
                            <div class="item-line">
                                {{ $index + 1 }}. {{ $item->category->name_ms ?? $item->category->name_en ?? 'Item' }} {{ $item->purity->code ?? '' }} - {{ number_format($item->net_weight ?? $item->gross_weight ?? 0, 2) }}g
                            </div>
                        @endforeach
                    </div>
                    <div class="barcode-area">
                        <img src="{{ $barcodeUrl }}" class="barcode-img" alt="{{ $pledge->pledge_no }}">
                        <div class="barcode-text">{{ $pledge->pledge_no }}</div>
                    </div>
                </td>
                <td class="right-col">
                    <div class="ticket-box">
                        <div class="ticket-label">NO. TIKET:</div>
                        <div class="ticket-number">{{ $renewal->renewal_no }}</div>
                    </div>
                    <div class="rate-section">
                        <div class="rate-label">TEMPOH TAMAT</div>
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

        <!-- CUSTOMER SECTION -->
        <div class="cust-title">Butir-butir terperinci mengenai pemajak gadai:-</div>
        <div class="cust-box">
            <table class="cust-table">
                <tr>
                    <td style="width: 33%;"><span class="cust-label">No. Kad Pengenalan :</span> <span class="cust-value">{{ $icFormatted }}</span></td>
                    <td style="width: 37%;"><span class="cust-label">Nama :</span> <span class="cust-value">{{ $customer->name ?? '-' }}</span></td>
                    <td style="width: 30%;"><span class="cust-label">Kerakyatan :</span> <span class="cust-value">{{ $nationality }}</span></td>
                </tr>
            </table>
            <table class="cust-table">
                <tr>
                    <td style="width: 33%;"><span class="cust-label">Tahun Lahir :</span> <span class="cust-value">{{ $birthYear }}</span></td>
                    <td style="width: 67%;"><span class="cust-label">Jantina :</span> <span class="cust-value">{{ $gender }}</span></td>
                </tr>
            </table>
            <table class="cust-table">
                <tr><td><span class="cust-label">Alamat :</span> <span class="cust-value">{{ $customerAddress }}</span></td></tr>
            </table>
            <table class="cust-table">
                <tr><td><span class="cust-label">Catatan :</span> <span class="cust-value" style="color: #003399;">{{ $catatan }}</span></td></tr>
            </table>
        </div>

        <!-- AMOUNT IN WORDS -->
        <div class="amount-row">
            <span class="amount-label">Amaun</span>
            <span class="amount-words">{{ $amountWords }} RINGGIT DAN {{ strtoupper(number_format(($loanAmount - floor($loanAmount)) * 100)) }} SEN SAHAJA</span>
        </div>

        <!-- BOTTOM ROW -->
        <table class="bottom-table">
            <tr>
                <td style="width: 50%;">
                    <span class="pinjaman-label">Pinjaman</span>
                    <span class="pinjaman-rm">RM</span>
                    <span class="pinjaman-amount">{{ number_format($loanAmount, 2) }}</span>
                    <span class="pinjaman-stars">***</span>
                </td>
                <td class="date-cell">
                    <div class="date-label">Tarikh Sambungan</div>
                    <div class="date-value">{{ $renewalDate->format('d/m/Y') }}</div>
                </td>
                <td class="date-cell-yellow">
                    <div class="date-label">Tarikh Cukup Tempoh</div>
                    <div class="date-value">{{ $newDueDate->format('d/m/Y') }}</div>
                </td>
            </tr>
        </table>

        <!-- FOOTER -->
        <table style="width: 100%; margin-top: 1mm;">
            <tr>
                <td style="font-size: 6px; color: #1a4a7a; vertical-align: bottom;">
                    <div>Faedah Dibayar: RM {{ number_format($interestAmount, 2) }} | Caj Pengendalian: RM {{ number_format($handlingFee, 2) }} | Jumlah: RM {{ number_format($totalPaid, 2) }}</div>
                    <div class="copy-label">RESIT PEMBAHARUAN</div>
                </td>
                <td style="text-align: right; vertical-align: bottom;">
                    <div class="weight-info">Berat: <strong>{{ number_format($totalWeight, 2) }}g</strong></div>
                </td>
            </tr>
        </table>

    </div>

</body>
</html>