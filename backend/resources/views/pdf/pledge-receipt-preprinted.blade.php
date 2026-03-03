<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resit Pajak Gadai - {{ $pledge->pledge_no }}</title>
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
            font-size: 7px;
            color: #1a4a7a;
            background: #fff;
            width: 700pt;
            height: 420pt;
            overflow: hidden;
        }

        /* ═══ SINGLE PAGE CONTAINER ═══ */
        .page {
            width: 700pt;
            max-height: 420pt;
            padding: 6pt 25pt 6pt 10pt;
            overflow: hidden;
        }

        /* ═══ HEADER ═══ */
        .header-table {
            width: 100%;
            border-collapse: collapse;
            border-bottom: 2px solid #1a4a7a;
        }
        .header-left {
            vertical-align: top;
            padding-bottom: 3pt;
        }
        .header-right {
            vertical-align: top;
            text-align: right;
            width: 200pt;
            padding-bottom: 3pt;
            padding-right: 5pt;
        }
        .logo {
            width: 45pt;
            height: 45pt;
            vertical-align: top;
            margin-right: 5pt;
        }
        .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #1a4a7a;
            line-height: 1.1;
        }
        .company-multilang {
            font-size: 16px;
            font-weight: bold;
            color: #1a4a7a;
        }
        .company-address {
            font-size: 8px;
            color: #1a4a7a;
            margin-top: 1pt;
        }
        .phone-box {
            background: #d42027;
            color: #fff;
            padding: 4pt 6pt;
            font-size: 9px;
            font-weight: bold;
            display: inline-block;
            border-radius: 3px;
        }
        .established {
            background: #d42027;
            color: #fff;
            padding: 5pt 6pt;
            font-size: 7px;
            font-weight: bold;
            display: inline-block;
            text-align: center;
            line-height: 1.1;
            border-radius: 20pt;
        }
        .hours-box {
            background: #f5c518;
            color: #000;
            padding: 2pt 4pt;
            text-align: center;
            margin-top: 2pt;
            border-radius: 2px;
        }
        .hours-title {
            font-size: 8px;
            font-weight: bold;
        }
        .hours-line {
            font-size: 6px;
            font-weight: bold;
            color: #1a4a7a;
        }

        /* ═══ MIDDLE SECTION ═══ */
        .mid-section {
            width: 100%;
            border: 1px solid #1a4a7a;
            border-collapse: collapse;
            margin-top: 2pt;
            margin-bottom: 2pt;
        }
        .mid-section td {
            vertical-align: top;
            border: 1px solid #1a4a7a;
        }
        .items-cell {
            padding: 3pt 4pt;
            width: 65%;
        }
        .items-title {
            font-size: 6px;
            font-weight: bold;
            margin-bottom: 2pt;
            color: #1a4a7a;
        }
        .items-area {
            padding-left: 3pt;
        }
        .item-line {
            font-size: 8px;
            font-weight: bold;
            margin-bottom: 1pt;
        }
        .barcode-area {
            text-align: right;
            padding: 3pt 15pt 2pt 0;
        }
        .barcode-img {
            max-width: 160pt;
            height: 42pt;
        }
        .barcode-text {
            font-size: 6px;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            text-align: right;
            color: #666;
            padding-right: 15pt;
        }

        /* Right column */
        .right-col {
            width: 35%;
        }
        .ticket-box {
            background: #f5c518;
            padding: 2pt;
            text-align: center;
            border-bottom: 1px solid #1a4a7a;
        }
        .ticket-label {
            font-size: 6px;
            font-weight: bold;
            color: #000;
        }
        .ticket-number {
            font-size: 11px;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #d42027;
            padding: 1pt 0;
        }
        .rate-section {
            text-align: center;
            padding: 2pt;
            border-bottom: 1px solid #1a4a7a;
        }
        .rate-label {
            font-size: 5px;
            font-weight: bold;
            color: #1a4a7a;
        }
        .rate-value {
            font-size: 12px;
            font-weight: bold;
            color: #1a4a7a;
        }
        .kadar-section {
            padding: 2pt 4pt;
        }
        .kadar-title {
            font-size: 5px;
            font-weight: bold;
            color: #1a4a7a;
            text-align: center;
            margin-bottom: 1pt;
        }
        .kadar-line {
            font-size: 5px;
            color: #1a4a7a;
            line-height: 1.4;
        }

        /* ═══ CUSTOMER SECTION ═══ */
        .cust-title {
            font-size: 6px;
            font-weight: bold;
            padding: 1pt 0;
            color: #1a4a7a;
        }
        .cust-box {
            border: 1px solid #d42027;
            padding: 2pt 4pt;
            margin-bottom: 1pt;
        }
        .cust-table {
            width: 100%;
            border-collapse: collapse;
        }
        .cust-table td {
            padding: 1pt 0;
            font-size: 7px;
            vertical-align: top;
        }
        .cust-label {
            font-size: 6px;
            font-weight: bold;
            white-space: nowrap;
            padding-right: 3pt;
            color: #1a4a7a;
        }
        .cust-value {
            font-size: 8px;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
        }

        /* ═══ AMOUNT ═══ */
        .amount-row {
            border: 1px solid #d42027;
            border-bottom: none;
            padding: 2pt 4pt;
        }
        .amount-label {
            font-size: 8px;
            font-weight: bold;
            color: #1a4a7a;
        }
        .amount-words {
            font-size: 7px;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            margin-left: 4pt;
        }

        /* ═══ BOTTOM ROW ═══ */
        .bottom-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #d42027;
        }
        .bottom-table td {
            border: 1px solid #d42027;
            padding: 2pt 4pt;
            vertical-align: middle;
        }
        .pinjaman-cell {
            width: 60%;
        }
        .pinjaman-label {
            font-size: 7px;
            color: #1a4a7a;
        }
        .pinjaman-rm {
            font-size: 8px;
            font-weight: bold;
            color: #1a4a7a;
            margin-left: 3pt;
        }
        .pinjaman-amount {
            font-size: 14px;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            margin-left: 6pt;
        }
        .pinjaman-stars {
            font-size: 10px;
            font-weight: bold;
            float: right;
        }
        .date-cell {
            text-align: center;
            width: 40%;
        }
        .date-label {
            font-size: 6px;
            font-weight: bold;
            color: #1a4a7a;
        }
        .date-value {
            font-size: 9px;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
        }

        /* ═══ FOOTER ═══ */
        .footer-table {
            width: 100%;
            margin-top: 1pt;
        }
        .footer-left {
            vertical-align: bottom;
            font-size: 5px;
            color: #1a4a7a;
        }
        .footer-right {
            text-align: right;
            vertical-align: bottom;
        }
        .copy-label {
            font-size: 8px;
            font-weight: bold;
            color: #d42027;
            margin-top: 1pt;
        }
        .weight-info {
            font-size: 6px;
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

        $customer = $pledge->customer;
        $loanAmount = $pledge->loan_amount ?? 0;

        $totalWeight = 0;
        foreach ($pledge->items as $item) {
            $totalWeight += $item->net_weight ?? $item->gross_weight ?? 0;
        }

        $pledgeDate = $pledge->pledge_date ?? $pledge->created_at;
        if (is_string($pledgeDate)) $pledgeDate = \Carbon\Carbon::parse($pledgeDate);
        $dueDate = $pledge->due_date;
        if (is_string($dueDate)) $dueDate = \Carbon\Carbon::parse($dueDate);

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

        $amountWords = '';
        try {
            $amountWords = strtoupper(app(\App\Http\Controllers\Api\DotMatrixPrintController::class)->numberToMalayWordsPublic($loanAmount) ?? '');
        } catch (\Exception $e) {}
        if (empty($amountWords)) {
            $amountWords = strtoupper(number_format($loanAmount, 2));
        }

        $barcodeUrl = $barcode_data_uri ?? '';
        $copyLabel = ($copy_type ?? 'customer') === 'office' ? 'SALINAN PEJABAT' : 'SALINAN PELANGGAN';
    @endphp

    <div class="page">

        <!-- HEADER -->
        <table class="header-table">
            <tr>
                <td class="header-left">
                    @if($logoUrl)
                        <img src="{{ $logoUrl }}" class="logo" style="float: left; margin-right: 4pt;">
                    @endif
                    <div class="company-name">{{ $companyName }}</div>
                    @if($chineseName || $tamilName)
                        <div class="company-multilang">{{ $chineseName }} {{ $tamilName }}</div>
                    @endif
                    <div class="company-address">{{ $address }}</div>
                </td>
                <td class="header-right">
                    <table style="margin-left: auto; border-collapse: collapse;">
                        <tr>
                            <td style="padding-right: 2pt;">
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
                        @if($barcodeUrl)
                            <img src="{{ $barcodeUrl }}" class="barcode-img" alt="{{ $pledge->pledge_no }}">
                        @endif
                        <div class="barcode-text">{{ $pledge->pledge_no }}</div>
                    </div>
                </td>
                <td class="right-col">
                    <div class="ticket-box">
                        <div class="ticket-label">NO. TIKET:</div>
                        <div class="ticket-number">{{ $pledge->pledge_no }}</div>
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
                <tr><td><span class="cust-label">Catatan :</span> <span class="cust-value">{{ $catatan }}</span></td></tr>
            </table>
        </div>

        <!-- AMOUNT IN WORDS -->
        <div class="amount-row">
            <span class="amount-label">Amaun</span>
            <span class="amount-words">{{ $amountWords }} SAHAJA</span>
        </div>

        <!-- BOTTOM ROW: Pinjaman | Tarikh Dipajak (NO Tarikh Cukup Tempoh) -->
        <table class="bottom-table">
            <tr>
                <td class="pinjaman-cell">
                    <span class="pinjaman-label">Pinjaman</span>
                    <span class="pinjaman-rm">RM</span>
                    <span class="pinjaman-amount">{{ number_format($loanAmount, 2) }}</span>
                    <span class="pinjaman-stars">***</span>
                </td>
                <td class="date-cell">
                    <div class="date-label">Tarikh Dipajak</div>
                    <div class="date-value">{{ $pledgeDate->format('d/m/Y') }}</div>
                </td>
            </tr>
        </table>

        <!-- FOOTER -->
        <table class="footer-table">
            <tr>
                <td class="footer-left">
                    <div>Anda diminta memeriksa barang gadaian dan butir-butir di atas dengan teliti sebelum meninggalkan kedai ini.</div>
                    <div>Sebarang tuntutan selepas meninggalkan kedai ini tidak akan dilayan. Lindungan insuran di bawah polisi No :</div>
                    <div class="copy-label">{{ $copyLabel }}</div>
                </td>
                <td class="footer-right">
                    <div class="weight-info">Termasuk Emas, Batu<br>dan lain-lain</div>
                    <div style="font-size: 7px; font-weight: bold;">{{ number_format($totalWeight, 2) }}g</div>
                </td>
            </tr>
        </table>

    </div>

</body>
</html>