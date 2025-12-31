<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resit Sambung Pajak / Renewal Receipt</title>
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
        .info-section {
            margin-bottom: 15px;
        }
        .info-row {
            display: flex;
            margin-bottom: 3px;
        }
        .info-label {
            width: 150px;
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
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">{{ $renewal->pledge->branch->name ?? 'PAWN SHOP' }}</div>
        <div class="branch-info">
            {{ $renewal->pledge->branch->address ?? '' }}<br>
            Tel: {{ $renewal->pledge->branch->phone ?? '' }}
        </div>
    </div>

    <div class="receipt-title">RESIT SAMBUNG PAJAK / RENEWAL RECEIPT</div>

    <div class="info-section">
        <div class="info-row">
            <span class="info-label">No. Sambungan / Renewal No:</span>
            <span class="info-value"><strong>{{ $renewal->renewal_no }}</strong></span>
        </div>
        <div class="info-row">
            <span class="info-label">No. Pajak Asal / Original Pledge:</span>
            <span class="info-value">{{ $renewal->pledge->pledge_no }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">No. Resit / Receipt No:</span>
            <span class="info-value">{{ $renewal->pledge->receipt_no }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Tarikh Sambung / Renewal Date:</span>
            <span class="info-value">{{ $renewal->created_at->format('d/m/Y') }}</span>
        </div>
    </div>

    <div class="info-section">
        <div class="info-row">
            <span class="info-label">Nama Penggadai / Customer:</span>
            <span class="info-value">{{ $renewal->pledge->customer->name }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">No. K/P / IC No:</span>
            <span class="info-value">{{ $renewal->pledge->customer->ic_number }}</span>
        </div>
    </div>

    <div class="summary-box">
        <div class="summary-row">
            <span>Jumlah Pinjaman / Loan Amount:</span>
            <span>RM {{ number_format($renewal->pledge->loan_amount, 2) }}</span>
        </div>
        <div class="summary-row">
            <span>Tarikh Tamat Asal / Previous Due Date:</span>
            <span>{{ $renewal->previous_due_date->format('d/m/Y') }}</span>
        </div>
        <div class="summary-row">
            <span>Tempoh Sambungan / Renewal Period:</span>
            <span>{{ $renewal->renewal_months }} bulan</span>
        </div>
        <div class="summary-row">
            <span>Tarikh Tamat Baru / New Due Date:</span>
            <span><strong>{{ $renewal->new_due_date->format('d/m/Y') }}</strong></span>
        </div>
        <div class="summary-row">
            <span>Bilangan Sambungan / Renewal Count:</span>
            <span>{{ $renewal->renewal_count }}</span>
        </div>
    </div>

    @if($renewal->interestBreakdown && $renewal->interestBreakdown->count() > 0)
    <table>
        <thead>
            <tr>
                <th>Bulan / Month</th>
                <th class="text-right">Kadar / Rate (%)</th>
                <th class="text-right">Faedah / Interest (RM)</th>
            </tr>
        </thead>
        <tbody>
            @foreach($renewal->interestBreakdown as $breakdown)
            <tr>
                <td class="text-center">{{ $breakdown->month_number }}</td>
                <td class="text-right">{{ number_format($breakdown->interest_rate, 2) }}%</td>
                <td class="text-right">{{ number_format($breakdown->interest_amount, 2) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    @endif

    <div class="summary-box">
        <div class="summary-row">
            <span>Jumlah Faedah / Interest Amount:</span>
            <span>RM {{ number_format($renewal->interest_amount, 2) }}</span>
        </div>
        <div class="summary-row">
            <span>Yuran Pengendalian / Handling Fee:</span>
            <span>RM {{ number_format($renewal->handling_fee, 2) }}</span>
        </div>
        <div class="summary-row total-row">
            <span>JUMLAH BAYARAN / TOTAL PAYMENT:</span>
            <span>RM {{ number_format($renewal->total_payable, 2) }}</span>
        </div>
    </div>

    <div class="info-section">
        <div class="info-row">
            <span class="info-label">Cara Bayaran / Payment Method:</span>
            <span class="info-value">
                @if($renewal->cash_amount > 0)Tunai: RM {{ number_format($renewal->cash_amount, 2) }}@endif
                @if($renewal->transfer_amount > 0) Pindahan: RM {{ number_format($renewal->transfer_amount, 2) }} ({{ $renewal->bank->name ?? '' }})@endif
            </span>
        </div>
    </div>

    <div class="signature-section">
        <div class="signature-box">
            <div class="signature-line">Tandatangan Penggadai / Customer</div>
        </div>
        <div class="signature-box">
            <div class="signature-line">Tandatangan Pegawai / Officer</div>
            <div style="font-size: 8px; margin-top: 3px;">{{ $renewal->createdBy->name ?? '' }}</div>
        </div>
    </div>

    <div class="footer">
        Dicetak pada / Printed: {{ $printed_at->format('d/m/Y H:i:s') }} oleh {{ $printed_by }}<br>
        Sila tebus atau sambung pajakan sebelum tarikh tamat untuk mengelakkan pelupusan.
    </div>
</body>
</html>
