<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resit Pajak Gadai - {{ $pledge->pledge_no }}</title>
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
        .header {
            width: 100%;
            padding-bottom: 1.5mm;
            border-bottom: 1px solid #1a4a7a;
            margin-bottom: 1.5mm;
        }
        .header-table {
            width: 100%;
            border-collapse: collapse;
        }
        .header-left {
            vertical-align: top;
        }
        .header-right {
            vertical-align: top;
            text-align: right;
            width: 50mm;
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

        /* ═══ MIDDLE SECTION - Items + Right Column ═══ */
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
            color: #1a4a7a;
        }
        .items-area {
            min-height: 22mm;
            padding-left: 2mm;
        }
        .item-line {
            font-size: 10px;
            font-weight: bold;
            margin-bottom: 1mm;
            font-family: 'DejaVu Sans', Arial, sans-serif;
        }

        /* Barcode area in items */
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

        /* Right column */
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
            color: #1a4a7a;
        }
        .rate-value {
            font-size: 16px;
            font-weight: bold;
            color: #1a4a7a;
        }
        .kadar-section {
            padding: 1.5mm 2mm;
        }
        .kadar-title {
            font-size: 7px;
            font-weight: bold;
            color: #1a4a7a;
            text-align: center;
            margin-bottom: 1mm;
        }
        .kadar-line {
            font-size: 7px;
            color: #1a4a7a;
            line-height: 1.5;
        }

        /* ═══ CUSTOMER SECTION ═══ */
        .cust-title {
            font-size: 8px;
            font-weight: bold;
            padding: 1mm 0;
            color: #1a4a7a;
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
            color: #1a4a7a;
        }
        .cust-value {
            font-size: 10px;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
        }

        /* ═══ AMOUNT SECTION ═══ */
        .amount-row {
            border: 1px solid #d42027;
            border-bottom: none;
            padding: 1.5mm 3mm;
        }
        .amount-label {
            font-size: 10px;
            font-weight: bold;
            color: #1a4a7a;
        }
        .amount-words {
            font-size: 9px;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
            margin-left: 3mm;
        }

        /* ═══ BOTTOM ROW ═══ */
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
        .pinjaman-cell {
            width: 50%;
        }
        .pinjaman-label {
            font-size: 9px;
            color: #1a4a7a;
        }
        .pinjaman-rm {
            font-size: 10px;
            font-weight: bold;
            color: #1a4a7a;
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
            color: #1a4a7a;
        }
        .date-value {
            font-size: 11px;
            font-weight: bold;
            font-family: 'DejaVu Sans Mono', 'Courier New', monospace;
        }

        /* ═══ FOOTER ═══ */
        .footer {
            margin-top: 1mm;
            font-size: 6px;
            line-height: 1.4;
            color: #1a4a7a;
        }
        .footer-table {
            width: 100%;
        }
        .footer-left {
            vertical-align: bottom;
        }
        .footer-right {
            text-align: right;
            vertical-align: bottom;
        }
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

        /* ═══ TERMS PAGE (PAGE 2) ═══ */
        .terms-page {
            width: 210mm;
            height: 148mm;
            padding: 3mm 5mm;
            page-break-after: always;
        }
        .terms-table {
            width: 100%;
            height: 100%;
            border-collapse: collapse;
        }
        .terms-col {
            vertical-align: top;
            padding-right: 3mm;
            width: 62%;
        }
        .redeemer-col {
            vertical-align: top;
            width: 38%;
            border-left: 1px solid #1a4a7a;
            padding-left: 3mm;
        }
        .terms-title {
            font-size: 13px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 3mm;
            text-decoration: underline;
        }
        .term-item {
            font-size: 8px;
            line-height: 1.4;
            margin-bottom: 2mm;
            text-align: justify;
        }
        .notice-box {
            border: 2px solid #1a4a7a;
            padding: 2mm 4mm;
            margin-top: 2mm;
            text-align: center;
            font-size: 10px;
            font-weight: bold;
            line-height: 1.3;
        }
        .redeemer-title {
            font-size: 10px;
            font-weight: bold;
            text-align: right;
            padding-bottom: 2mm;
            margin-bottom: 2mm;
            border-bottom: 1px solid #1a4a7a;
        }
        .redeemer-field {
            margin-bottom: 3mm;
        }
        .redeemer-label {
            font-size: 8px;
            font-weight: bold;
            display: block;
        }
        .redeemer-line {
            border-bottom: 1px solid #1a4a7a;
            min-height: 5mm;
            margin-top: 1mm;
        }
        .sig-box {
            border: 1px solid #1a4a7a;
            height: 18mm;
            margin-top: 2mm;
            text-align: right;
            padding: 1mm 2mm;
            vertical-align: bottom;
        }
        .sig-label {
            font-size: 8px;
            font-weight: bold;
            position: relative;
            top: 12mm;
        }
    </style>
</head>
<body>
    @php
        $companyName = $settings['company_name'] ?? 'PAJAK GADAI SDN BHD';
        $chineseName = $settings['company_name_chinese'] ?? '';
        $tamilName = $settings['company_name_tamil'] ?? '';
        $regNo = $settings['registration_no'] ?? '';
        $licenseNo = $settings['license_no'] ?? '';
        $address = $settings['address'] ?? '';
        $phone = $settings['phone'] ?? '';
        $phone2 = $settings['phone2'] ?? '';
        $estYear = $settings['established_year'] ?? '';
        $businessDays = $settings['business_days'] ?? 'ISNIN - AHAD';
        $businessHours = $settings['business_hours'] ?? '8.30AM - 6.00PM';
        $closedDays = $settings['closed_days'] ?? '';
        $redemptionPeriod = $settings['redemption_period'] ?? '6 BULAN';
        $interestRateNormal = $settings['interest_rate_normal'] ?? '1.5';
        $interestRateOverdue = $settings['interest_rate_overdue'] ?? '2.0';
        $logoUrl = $settings['logo_url'] ?? null;

        $customer = $pledge->customer;
        $loanAmount = $pledge->loan_amount ?? 0;

        // Calculate total weight
        $totalWeight = 0;
        foreach ($pledge->items as $item) {
            $totalWeight += $item->net_weight ?? $item->gross_weight ?? 0;
        }

        // Format dates
        $pledgeDate = $pledge->pledge_date ?? $pledge->created_at;
        if (is_string($pledgeDate)) $pledgeDate = \Carbon\Carbon::parse($pledgeDate);
        $dueDate = $pledge->due_date;
        if (is_string($dueDate)) $dueDate = \Carbon\Carbon::parse($dueDate);

        // Customer details
        $ic = preg_replace('/[^0-9]/', '', $customer->ic_number ?? '');
        $icFormatted = strlen($ic) === 12 ? substr($ic, 0, 6) . '-' . substr($ic, 6, 2) . '-' . substr($ic, 8, 4) : ($ic ?: '-');

        // Birth year from IC
        if (!empty($customer->date_of_birth)) {
            try {
                $dob = $customer->date_of_birth;
                if (is_string($dob)) $dob = \Carbon\Carbon::parse($dob);
                $birthYear = $dob->format('Y');
            } catch (\Exception $e) {
                $birthYear = '-';
            }
        } else {
            $birthYear = (strlen($ic) >= 6) ? ((intval(substr($ic, 0, 2)) > intval(date('y'))) ? '19' . substr($ic, 0, 2) : '20' . substr($ic, 0, 2)) : '-';
        }

        // Gender
        $g = strtolower($customer->gender ?? '');
        $gender = in_array($g, ['male', 'm', 'lelaki']) ? 'LELAKI' : (in_array($g, ['female', 'f', 'perempuan']) ? 'PEREMPUAN' : '-');

        // Nationality
        $nat = strtoupper($customer->nationality ?? '');
        $nationality = str_contains($nat, 'MALAYSIA') ? 'MALAYSIA' : ($nat ?: 'WARGANEGARA');

        // Address
        $addrParts = array_filter([
            $customer->address_line1 ?? $customer->address ?? '',
            $customer->address_line2 ?? '',
            trim(($customer->postcode ?? '') . ' ' . ($customer->city ?? '')),
            strtoupper($customer->state ?? '')
        ]);
        $customerAddress = implode(', ', $addrParts) ?: '-';

        // Catatan
        $catatan = '';
        foreach ($pledge->items as $item) {
            $desc = $item->description ?? '';
            if ($desc) {
                if ($catatan) $catatan .= '; ';
                $catatan .= $desc;
            }
        }
        if ($pledge->reference_no) {
            $catatan = $pledge->reference_no . ($catatan ? '; ' . $catatan : '');
        }
        if ($pledge->notes && !$pledge->reference_no) {
            $catatan = $pledge->notes . ($catatan ? '; ' . $catatan : '');
        }

        // Amount in Malay words helper
        $amountWords = strtoupper(app(\App\Http\Controllers\Api\DotMatrixPrintController::class)->numberToMalayWordsPublic($loanAmount) ?? '');
        // Fallback if method not available
        if (empty($amountWords)) {
            $amountWords = strtoupper(number_format($loanAmount, 2));
        }

        // Barcode URL (TEC-IT)
        $barcodeUrl = 'https://barcode.tec-it.com/barcode.ashx?data=' . urlencode($pledge->pledge_no) . '&code=Code128&translate-esc=on&dmsize=Default&unit=Fit&imagetype=Png&rotation=0&color=%23000000&bgcolor=%23ffffff&qunit=Mm&quiet=0&modulewidth=0.265';

        // Copy type label
        $copyLabel = ($copy_type ?? 'customer') === 'office' ? 'SALINAN PEJABAT' : 'SALINAN PELANGGAN';
    @endphp

    <!-- ═══════════════════════════════════════════ -->
    <!-- PAGE 1: RECEIPT (FRONT) -->
    <!-- ═══════════════════════════════════════════ -->
    <div class="page">

        <!-- HEADER -->
        <table class="header-table" style="border-bottom: 1px solid #1a4a7a; padding-bottom: 1.5mm; margin-bottom: 1.5mm;">
            <tr>
                <td class="header-left" style="vertical-align: top;">
                    @if($logoUrl)
                        <img src="{{ $logoUrl }}" class="logo" style="float: left; margin-right: 2mm;">
                    @endif
                    <div class="company-name">{{ $companyName }}</div>
                    @if($chineseName || $tamilName)
                        <div class="company-multilang">{{ $chineseName }} {{ $tamilName }}</div>
                    @endif
                    <div class="company-address">{{ $address }}</div>
                </td>
                <td class="header-right" style="vertical-align: top; text-align: right; width: 50mm;">
                    <table style="margin-left: auto; border-collapse: collapse;">
                        <tr>
                            <td style="padding-right: 1mm;">
                                <span class="phone-box">&#9742; {{ $phone }}@if($phone2)<br>{{ $phone2 }}@endif</span>
                            </td>
                            @if($estYear)
                            <td>
                                <span class="established">SEJAK<br>{{ $estYear }}</span>
                            </td>
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

        <!-- MIDDLE SECTION: Items + Right Column -->
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
                    <!-- Barcode -->
                    <div class="barcode-area">
                        <img src="{{ $barcodeUrl }}" class="barcode-img" alt="{{ $pledge->pledge_no }}">
                        <div class="barcode-text">{{ $pledge->pledge_no }}<br><span style="font-size: 6px; color: #999;">BARCODE</span></div>
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
            <!-- Row 1: IC | Name | Nationality -->
            <table class="cust-table">
                <tr>
                    <td style="width: 33%;">
                        <span class="cust-label">No. Kad<br>Pengenalan :</span>
                        <span class="cust-value">{{ $icFormatted }}</span>
                    </td>
                    <td style="width: 37%;">
                        <span class="cust-label">Nama :</span>
                        <span class="cust-value">{{ $customer->name ?? '-' }}</span>
                    </td>
                    <td style="width: 30%;">
                        <span class="cust-label">Kerakyatan :</span>
                        <span class="cust-value">{{ $nationality }}</span>
                    </td>
                </tr>
            </table>
            <!-- Row 2: Birth Year | Gender -->
            <table class="cust-table">
                <tr>
                    <td style="width: 33%;">
                        <span class="cust-label">Tahun Lahir :</span>
                        <span class="cust-value">{{ $birthYear }}</span>
                    </td>
                    <td style="width: 67%;">
                        <span class="cust-label">Jantina :</span>
                        <span class="cust-value">{{ $gender }}</span>
                    </td>
                </tr>
            </table>
            <!-- Row 3: Address -->
            <table class="cust-table">
                <tr>
                    <td>
                        <span class="cust-label">Alamat :</span>
                        <span class="cust-value">{{ $customerAddress }}</span>
                    </td>
                </tr>
            </table>
            <!-- Row 4: Catatan -->
            <table class="cust-table">
                <tr>
                    <td>
                        <span class="cust-label">Catatan :</span>
                        <span class="cust-value">{{ $catatan }}</span>
                    </td>
                </tr>
            </table>
        </div>

        <!-- AMOUNT IN WORDS -->
        <div class="amount-row">
            <span class="amount-label">Amaun</span>
            <span class="amount-words">{{ $amountWords }} RINGGIT DAN {{ strtoupper(number_format(($loanAmount - floor($loanAmount)) * 100)) }} SEN SAHAJA</span>
        </div>

        <!-- BOTTOM ROW: Pinjaman | Tarikh Dipajak | Tarikh Cukup Tempoh -->
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
                <td class="date-cell-yellow">
                    <div class="date-label">Tarikh Cukup Tempoh</div>
                    <div class="date-value">{{ $dueDate->format('d/m/Y') }}</div>
                </td>
            </tr>
        </table>

        <!-- FOOTER -->
        <table class="footer-table" style="margin-top: 1mm;">
            <tr>
                <td class="footer-left" style="font-size: 6px; color: #1a4a7a; vertical-align: bottom;">
                    <div>Anda diminta memeriksa barang gadaian dan butir-butir di atas dengan teliti sebelum meninggalkan kedai ini.</div>
                    <div>Sebarang tuntutan selepas meninggalkan kedai ini tidak akan dilayan. Lindungan insuran di bawah polisi No :</div>
                    <div class="copy-label">{{ $copyLabel }}</div>
                </td>
                <td class="footer-right" style="text-align: right; vertical-align: bottom;">
                    <div class="weight-info">Termasuk Emas, Batu<br>dan lain-lain</div>
                    <div style="font-size: 9px; font-weight: bold;">{{ number_format($totalWeight, 2) }}g</div>
                </td>
            </tr>
        </table>

    </div>

    <!-- ═══════════════════════════════════════════ -->
    <!-- PAGE 2: TERMS & CONDITIONS (BACK) -->
    <!-- ═══════════════════════════════════════════ -->
    <div class="terms-page">
        <table class="terms-table">
            <tr>
                <td class="terms-col">
                    <div class="terms-title">TERMA DAN SYARAT</div>
                    @if(!empty($terms) && count($terms) > 0)
                        @foreach($terms as $index => $term)
                            <div class="term-item">
                                <strong>{{ $index + 1 }}.</strong> {!! $term->content_ms ?? $term->content_en ?? '' !!}
                            </div>
                        @endforeach
                    @else
                        <div class="term-item"><strong>1.</strong> Seseorang pemajak gadai adalah berhak mendapat satu salinan tiket pajak gadai pada masa pajak gadaian.</div>
                        <div class="term-item"><strong>2.</strong> Kadar untung adalah tidak melebihi <u>dua peratus (2%)</u> sebulan atau sebahagian daripadanya campur caj pengendalian sebanyak <u>lima puluh sen (50&cent;)</u>.</div>
                        <div class="term-item"><strong>3.</strong> Jika mana-mana sandaran hilang atau musnah, maka amaun pampasan adalah satu per empat <u>(25%)</u> lebih daripada jumlah pinjaman.</div>
                        <div class="term-item"><strong>4.</strong> Mana-mana sandaran hendaklah ditebus dalam masa <u>enam bulan</u> dari tarikh pajak gadaian.</div>
                        <div class="term-item"><strong>5.</strong> Seorang pemajak gadai berhak memeriksa catatan jualan dalam buku pemegang pajak gadai dan laporan pelelong.</div>
                        <div class="term-item"><strong>6.</strong> Apa-apa pertanyaan boleh dialamatkan kepada: Pendaftar Pemegang Pajak Gadai, KPKT, Putrajaya.</div>
                        <div class="term-item"><strong>7.</strong> Jika sesuatu sandaran tidak ditebus di dalam enam bulan: (a) RM200 ke bawah menjadi harta pemegang pajak gadai. (b) Lebih RM200 hendaklah dijual oleh pelelong berlesen.</div>
                        <div class="term-item"><strong>8.</strong> Sila maklumkan kami sekiranya anda menukarkan alamat.</div>
                        <div class="term-item"><strong>9.</strong> Barang-barang curian tidak diterima.</div>
                        <div class="term-item"><strong>10.</strong> Data peribadi anda akan digunakan dan diproseskan <u>hanya bagi tujuan internal sahaja</u>.</div>
                    @endif
                    <div class="notice-box">DIKEHENDAKI MEMBAWA KAD<br>PENGENALAN APABILA MENEBUS<br>BARANG GADAIAN</div>
                </td>
                <td class="redeemer-col">
                    <div class="redeemer-title">Butir-butir Penebus</div>
                    <div class="redeemer-field"><span class="redeemer-label">No. K/P:</span><div class="redeemer-line"></div></div>
                    <div class="redeemer-field"><span class="redeemer-label">Nama:</span><div class="redeemer-line"></div></div>
                    <div class="redeemer-field"><span class="redeemer-label">Kerakyatan:</span><div class="redeemer-line"></div></div>
                    <div class="redeemer-field">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="width: 50%;"><span class="redeemer-label">Tahun Lahir:</span><div class="redeemer-line"></div></td>
                                <td style="width: 50%;"><span class="redeemer-label">Umur:</span><div class="redeemer-line"></div></td>
                            </tr>
                        </table>
                    </div>
                    <div class="redeemer-field"><span class="redeemer-label">Jantina:</span><div class="redeemer-line"></div></div>
                    <div class="redeemer-field"><span class="redeemer-label">H/P No:</span><div class="redeemer-line"></div></div>
                    <div class="redeemer-field">
                        <span class="redeemer-label">Alamat:</span>
                        <div class="redeemer-line"></div>
                        <div class="redeemer-line"></div>
                        <div class="redeemer-line"></div>
                    </div>
                    <div style="margin-top: 4mm;">
                        <div class="sig-box">
                            <span class="sig-label">Cap Jari /<br>Tandatangan</span>
                        </div>
                    </div>
                </td>
            </tr>
        </table>
    </div>

</body>
</html>