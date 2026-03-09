<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resit Tebusan - {{ $redemption->redemption_no ?? $pledge->pledge_no }}</title>
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
            background: #006600;
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
            background: #006600;
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
            background: #e8f5e9;
            color: #000;
            padding: 7pt 6pt 14pt 6pt;
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

        /* ═══ REDEMPTION TYPE BADGE ═══ */
        .type-badge {
            background: #006600;
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
            margin-top: 4pt;
            margin-bottom: 4pt;
        }
        .mid-section td {
            vertical-align: top;
            border-left: 1.5pt solid #1a4a7a;
        }
        .items-cell {
            padding: 4pt 6pt;
            width: 25%;
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
            margin-bottom: 1pt;
            line-height: 1.4;
        }
        .mid-section .barcode-cell {
            width: 22%;
            text-align: center;
            vertical-align: middle;
            padding: 6pt 4pt;
            border-left: 1.5pt dotted #1a4a7a;
            border-right: none;
        }
        .barcode-img {
            max-width: 130pt;
            height: 38pt;
        }
        .barcode-text {
            font-size: 6pt;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            text-align: center;
            color: #555;
            margin-top: 1pt;
        }
        .right-col {
            width: 38%;
        }
        .ticket-box {
            background: #e8f5e9;
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
        /* ═══ REDEMPTION NO BOX ═══ */
        .redemption-no-box {
            background: #e8f5e9;
            padding: 2pt 4pt;
            text-align: center;
            border-bottom: 1.5pt solid #1a4a7a;
        }
        .redemption-no-label {
            font-size: 5.5pt;
            font-weight: bold;
            color: #006600;
        }
        .redemption-no-value {
            font-size: 9pt;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #006600;
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
        .redeemed-stamp {
            text-align: center;
            padding: 4pt 4pt;
            border-bottom: 1.5pt solid #1a4a7a;
        }
        .redeemed-stamp-text {
            font-size: 14pt;
            font-weight: 900;
            color: #006600;
            border: 2pt solid #006600;
            padding: 2pt 12pt;
            display: inline-block;
            letter-spacing: 1pt;
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
            border: 1.5pt solid #006600;
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

        /* ═══ REDEMPTION PAYMENT SUMMARY ═══ */
        .redemption-summary {
            width: 100%;
            border: 1.5pt solid #006600;
            border-collapse: collapse;
            margin-bottom: 2pt;
        }
        .redemption-summary td {
            padding: 1.5pt 6pt;
            border-bottom: 0.5pt solid #eee;
            vertical-align: middle;
        }
        .redemption-summary .rs-label {
            font-size: 7pt;
            font-weight: bold;
            color: #1a4a7a;
            width: 30%;
        }
        .redemption-summary .rs-value {
            font-size: 8pt;
            font-weight: 900;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #000;
            text-align: right;
            width: 20%;
        }
        .redemption-summary .rs-total {
            background: #e8f5e9;
            font-size: 9pt;
            font-weight: 900;
            color: #006600;
        }

        /* ═══ AMOUNT ═══ */
        .amount-box {
            border: 1.5pt solid #006600;
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
            border: 1.5pt solid #006600;
        }
        .bottom-table td {
            border: 1.5pt solid #006600;
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
            padding-left: 77pt;
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
        .date-redemption-label {
            font-size: 6pt;
            font-weight: bold;
            color: #006600;
        }
        .date-redemption-value {
            font-size: 9pt;
            font-weight: 800;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            color: #006600;
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
            color: #006600;
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
        $pledge = $redemption->pledge;
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

        // Redemption-specific amounts
        $principalAmount = $redemption->principal_amount ?? $loanAmount;
        $interestAmount = $redemption->interest_amount ?? 0;
        $overdueInterest = $redemption->overdue_interest ?? 0;
        $handlingFee = $redemption->handling_fee ?? 0;
        $totalPayable = $redemption->total_payable ?? ($principalAmount + $interestAmount + $overdueInterest + $handlingFee);

        $totalWeight = 0;
        foreach ($pledge->items as $item) {
            $totalWeight += $item->net_weight ?? $item->gross_weight ?? 0;
        }

        // Redemption date
        $redemptionDate = $redemption->created_at ?? now();
        if (is_string($redemptionDate)) $redemptionDate = \Carbon\Carbon::parse($redemptionDate);

        // Original pledge date
        $pledgeDate = $pledge->pledge_date ?? $pledge->created_at;
        if (is_string($pledgeDate)) $pledgeDate = \Carbon\Carbon::parse($pledgeDate);

        // Due date
        $dueDate = $pledge->due_date;
        if (is_string($dueDate)) $dueDate = \Carbon\Carbon::parse($dueDate);

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

        // Amount in words for total payable (redemption payment)
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
                    {{-- Redemption badge top-right --}}
                    <span class="type-badge">TEBUSAN / REDEMPTION</span>
                    <table style="margin-left: auto; border-collapse: collapse; margin-top: 2pt;">
                        <tr>
                            <td style="padding-right: 3pt; vertical-align: middle;">
                                <span class="phone-box">&#9742; {{ $phone }}@if($phone2)<br>{{ $phone2 }}@endif</span>
                            </td>
                            @if($estYear)
                                <td style="vertical-align: middle; margin-right:3pt;"><span class="established">SEJAK<br>{{ $estYear }}</span></td>
                            @endif
                        </tr>
                    </table>
                    <table style="margin-left: auto; border-collapse: collapse; margin-top: 3pt;">
                        <tr>
                            <td>
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
                    <div class="items-title">Barang dilepaskan / Items released:-</div>
                    <div class="items-area">
                        @foreach($pledge->items as $index => $item)
                            <div class="item-line">
                                {{ $index + 1 }}. {{ $item->category->name_ms ?? $item->category->name_en ?? 'Item' }}
                                {{ $item->purity->code ?? '' }}
                                - {{ number_format($item->net_weight ?? $item->gross_weight ?? 0, 2) }}g
                            </div>
                        @endforeach
                    </div>
                </td>
                <td class="barcode-cell">
                    @if($barcodeUrl)
                        <img src="{{ $barcodeUrl }}" class="barcode-img" alt="{{ $pledge->pledge_no }}">
                    @endif
                    <div class="barcode-text">{{ $pledge->pledge_no }}</div>
                </td>
                <td class="right-col">
                    <div class="ticket-box">
                        <div class="ticket-label">NO. TIKET:</div>
                        <div class="ticket-number">{{ $pledge->pledge_no }}</div>
                    </div>
                    {{-- Redemption number sub-box --}}
                    <div class="redemption-no-box">
                        <div class="redemption-no-label">NO. TEBUSAN / REDEMPTION NO:</div>
                        <div class="redemption-no-value">{{ $redemption->redemption_no }}</div>
                    </div>
                    {{-- Redeemed stamp --}}
                    <div class="redeemed-stamp">
                        <span class="redeemed-stamp-text">DITEBUS / REDEEMED</span>
                    </div>
                    <div class="kadar-section">
                        <div class="kadar-title">KADAR KEUNTUNGAN BULANAN</div>
                        <div class="kadar-line"><span style="font-weight: bold;color:black;"> 1.</span> 0.5% SEBULAN : UNTUK TEMPOH 6 BULAN PERTAMA</div>
                        <div class="kadar-line"><span style="font-weight: bold;color:black;"> 2.</span> 1.5% SEBULAN : PEMBAHARUAN SETERUSNYA TEMPOH 6 BULAN</div>
                        <div class="kadar-line"><span style="font-weight: bold;color:black;"> 3.</span> 2.0% SEBULAN : LEPAS MATANG TEMPOH 6 BULAN</div>
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
                <tr>
                    <td><span class="cl">Catatan :</span></td>
                    <td colspan="5"><span class="cv">{{ $catatan }}</span></td>
                </tr>
            </table>
        </div>

        {{-- ═══ REDEMPTION PAYMENT SUMMARY ═══ --}}
        <table class="redemption-summary">
            <tr>
                <td class="rs-label">Pinjaman / Principal :</td>
                <td class="rs-value">RM {{ number_format($principalAmount, 2) }}</td>
                <td class="rs-label rs-total">JUMLAH TEBUSAN / TOTAL REDEMPTION :</td>
                <td class="rs-value rs-total">RM {{ number_format($totalPayable, 2) }}</td>
            </tr>
            <tr>
                <td class="rs-label">Faedah / Interest :</td>
                <td class="rs-value">RM {{ number_format($interestAmount, 2) }}</td>
                <td class="rs-label">Bayaran Tunai / Cash :</td>
                <td class="rs-value">RM {{ number_format($redemption->cash_amount ?? $totalPayable, 2) }}</td>
            </tr>
            <tr>
                @if(($overdueInterest ?? 0) > 0)
                    <td class="rs-label">Faedah Lewat / Overdue :</td>
                    <td class="rs-value">RM {{ number_format($overdueInterest, 2) }}</td>
                @else
                    <td class="rs-label">Yuran / Handling Fee :</td>
                    <td class="rs-value">RM {{ number_format($handlingFee, 2) }}</td>
                @endif
                <td class="rs-label">Pindahan / Transfer :</td>
                <td class="rs-value">RM {{ number_format($redemption->transfer_amount ?? 0, 2) }}</td>
            </tr>
        </table>

        {{-- ═══ AMOUNT IN WORDS ═══ --}}
        <div class="amount-box">
            <span class="amount-label">Jumlah Tebusan (Amaun)</span>&nbsp;&nbsp;
            <span class="amount-words">{{ $amountWords }} SAHAJA</span>
        </div>

        {{-- ═══ BOTTOM ═══ --}}
        <table class="bottom-table">
            <tr>
                <td class="pinjaman-cell">
                    <span class="pinjaman-label">Jumlah Tebusan / Total Redemption</span>
                    <span class="pinjaman-rm">RM</span>
                    <span class="pinjaman-amount">{{ number_format($totalPayable, 2) }}</span>
                    <span class="pinjaman-stars">***</span>
                </td>
                <td class="date-cell">
                    <div class="date-label">Tarikh Pajakan / Pledge Date</div>
                    <div class="date-value">{{ $pledgeDate ? $pledgeDate->format('d/m/Y') : '-' }}</div>
                    <div class="date-redemption-label">Tarikh Tebusan / Redemption Date</div>
                    <div class="date-redemption-value">{{ $redemptionDate->format('d/m/Y') }}</div>
                </td>
            </tr>
        </table>

        {{-- ═══ FOOTER ═══ --}}
        <table class="footer-table">
            <tr>
                <td class="footer-left">
                    <div>Saya mengaku telah menerima semua barang gadaian seperti yang dinyatakan di atas.</div>
                    <div>I acknowledge receipt of all pledged items as listed above.</div>
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