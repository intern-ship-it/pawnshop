<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resit Pajak Gadai / Pledge Receipt</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 10px;
            margin: 0;
            padding: 15px;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        .company-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 3px;
        }
        .branch-info {
            font-size: 9px;
            color: #666;
        }
        .receipt-title {
            font-size: 14px;
            font-weight: bold;
            text-align: center;
            margin: 10px 0;
            text-transform: uppercase;
        }
        .copy-type {
            text-align: center;
            font-size: 10px;
            color: #666;
            margin-bottom: 10px;
        }
        .info-section {
            margin-bottom: 15px;
        }
        .info-row {
            display: flex;
            margin-bottom: 3px;
        }
        .info-label {
            width: 120px;
            font-weight: bold;
        }
        .info-value {
            flex: 1;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 10px 0;
        }
        th, td {
            border: 1px solid #333;
            padding: 5px;
            text-align: left;
            font-size: 9px;
        }
        th {
            background-color: #f0f0f0;
            font-weight: bold;
        }
        .text-right {
            text-align: right;
        }
        .text-center {
            text-align: center;
        }
        .summary-box {
            background-color: #f9f9f9;
            border: 1px solid #333;
            padding: 10px;
            margin: 10px 0;
        }
        .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
        }
        .total-row {
            font-weight: bold;
            font-size: 12px;
            border-top: 1px solid #333;
            padding-top: 5px;
            margin-top: 5px;
        }
        .terms-section {
            margin-top: 15px;
            font-size: 8px;
            color: #666;
        }
        .terms-title {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .signature-section {
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
        }
        .signature-box {
            width: 45%;
            text-align: center;
        }
        .signature-line {
            border-top: 1px solid #333;
            margin-top: 40px;
            padding-top: 5px;
        }
        .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 8px;
            color: #666;
        }
        .gold-prices {
            font-size: 8px;
            color: #666;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">{{ $pledge->branch->name ?? 'PAWN SHOP' }}</div>
        <div class="branch-info">
            {{ $pledge->branch->address ?? '' }}<br>
            Tel: {{ $pledge->branch->phone ?? '' }} | Lesen: {{ $pledge->branch->license_no ?? '' }}
        </div>
    </div>

    <div class="receipt-title">RESIT PAJAK GADAI / PLEDGE RECEIPT</div>
    <div class="copy-type">({{ $copy_type === 'office' ? 'Salinan Pejabat / Office Copy' : 'Salinan Pelanggan / Customer Copy' }})</div>

    <div class="info-section">
        <div class="info-row">
            <span class="info-label">No. Resit / Receipt No:</span>
            <span class="info-value"><strong>{{ $pledge->receipt_no }}</strong></span>
        </div>
        <div class="info-row">
            <span class="info-label">No. Pajak / Pledge No:</span>
            <span class="info-value">{{ $pledge->pledge_no }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Tarikh / Date:</span>
            <span class="info-value">{{ $pledge->pledge_date->format('d/m/Y') }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Tarikh Tamat / Due Date:</span>
            <span class="info-value"><strong>{{ $pledge->due_date->format('d/m/Y') }}</strong></span>
        </div>
    </div>

    <div class="info-section">
        <div class="info-row">
            <span class="info-label">Nama / Name:</span>
            <span class="info-value">{{ $pledge->customer->name }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">No. K/P / IC No:</span>
            <span class="info-value">{{ $pledge->customer->ic_number }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">No. Tel / Phone:</span>
            <span class="info-value">{{ $pledge->customer->phone }}</span>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 30px">#</th>
                <th>Perkara / Item</th>
                <th style="width: 50px">Ketulenan</th>
                <th style="width: 60px" class="text-right">Berat (g)</th>
                <th style="width: 70px" class="text-right">Harga/g</th>
                <th style="width: 70px" class="text-right">Nilai (RM)</th>
            </tr>
        </thead>
        <tbody>
            @foreach($pledge->items as $index => $item)
            <tr>
                <td class="text-center">{{ $index + 1 }}</td>
                <td>{{ $item->category->name_en ?? 'Item' }} {{ $item->description ? '- ' . $item->description : '' }}</td>
                <td class="text-center">{{ $item->purity->code ?? '' }}</td>
                <td class="text-right">{{ number_format($item->net_weight, 3) }}</td>
                <td class="text-right">{{ number_format($item->price_per_gram, 2) }}</td>
                <td class="text-right">{{ number_format($item->net_value, 2) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="summary-box">
        <div class="summary-row">
            <span>Jumlah Berat / Total Weight:</span>
            <span>{{ number_format($pledge->total_weight, 3) }} g</span>
        </div>
        <div class="summary-row">
            <span>Nilai Kasar / Gross Value:</span>
            <span>RM {{ number_format($pledge->gross_value, 2) }}</span>
        </div>
        <div class="summary-row">
            <span>Tolakan / Deduction:</span>
            <span>RM {{ number_format($pledge->total_deduction, 2) }}</span>
        </div>
        <div class="summary-row">
            <span>Nilai Bersih / Net Value:</span>
            <span>RM {{ number_format($pledge->net_value, 2) }}</span>
        </div>
        <div class="summary-row">
            <span>Peratusan Pinjaman / Loan %:</span>
            <span>{{ $pledge->loan_percentage }}%</span>
        </div>
        <div class="summary-row total-row">
            <span>JUMLAH PINJAMAN / LOAN AMOUNT:</span>
            <span>RM {{ number_format($pledge->loan_amount, 2) }}</span>
        </div>
    </div>

    <div class="info-section">
        <div class="info-row">
            <span class="info-label">Kadar Faedah / Interest:</span>
            <span class="info-value">{{ $pledge->interest_rate }}% sebulan (Bulan 1-6) / {{ $pledge->interest_rate_extended }}% sebulan (Bulan 7+)</span>
        </div>
        <div class="info-row">
            <span class="info-label">Bayaran / Payment:</span>
            <span class="info-value">
                @if($pledge->payments->first())
                    @php $payment = $pledge->payments->first(); @endphp
                    @if($payment->cash_amount > 0)Tunai: RM {{ number_format($payment->cash_amount, 2) }}@endif
                    @if($payment->transfer_amount > 0) Pindahan: RM {{ number_format($payment->transfer_amount, 2) }} ({{ $payment->bank->name ?? '' }})@endif
                @endif
            </span>
        </div>
    </div>

    <div class="gold-prices">
        Harga Emas Semasa / Current Gold Prices ({{ $pledge->pledge_date->format('d/m/Y') }}):
        999: RM{{ number_format($pledge->gold_price_999, 2) }}/g |
        916: RM{{ number_format($pledge->gold_price_916, 2) }}/g |
        750: RM{{ number_format($pledge->gold_price_750, 2) }}/g
    </div>

    @if($terms)
    <div class="terms-section">
        <div class="terms-title">Terma & Syarat / Terms & Conditions:</div>
        <div>{!! nl2br(e($terms->content_ms)) !!}</div>
    </div>
    @endif

    <div class="signature-section">
        <div class="signature-box">
            <div class="signature-line">Tandatangan Penggadai / Customer Signature</div>
        </div>
        <div class="signature-box">
            <div class="signature-line">Tandatangan Pegawai / Officer Signature</div>
            <div style="font-size: 8px; margin-top: 3px;">{{ $pledge->createdBy->name ?? '' }}</div>
        </div>
    </div>

    <div class="footer">
        Dicetak pada / Printed: {{ $printed_at->format('d/m/Y H:i:s') }} oleh {{ $printed_by }}<br>
        Sila simpan resit ini dengan selamat. Resit diperlukan untuk tebus atau sambung pajakan.<br>
        Please keep this receipt safe. Receipt is required for redemption or renewal.
    </div>
</body>
</html>
