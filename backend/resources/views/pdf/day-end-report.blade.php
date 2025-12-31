<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Laporan Akhir Hari / Day-End Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 10px;
            margin: 0;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        .company-name {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 3px;
        }
        .report-title {
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            margin: 15px 0;
            text-transform: uppercase;
        }
        .report-date {
            text-align: center;
            font-size: 14px;
            margin-bottom: 20px;
        }
        .section {
            margin-bottom: 20px;
        }
        .section-title {
            font-size: 12px;
            font-weight: bold;
            background-color: #333;
            color: #fff;
            padding: 5px 10px;
            margin-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        th, td {
            border: 1px solid #333;
            padding: 6px 8px;
            text-align: left;
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
        .summary-table {
            width: 50%;
            margin: 0 auto;
        }
        .summary-table td {
            padding: 8px;
        }
        .total-row {
            font-weight: bold;
            background-color: #e0e0e0;
        }
        .grand-total {
            font-size: 14px;
            font-weight: bold;
            background-color: #333;
            color: #fff;
        }
        .status-badge {
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: bold;
        }
        .status-verified {
            background-color: #d4edda;
            color: #155724;
        }
        .status-pending {
            background-color: #fff3cd;
            color: #856404;
        }
        .signature-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
        }
        .signature-box {
            width: 30%;
            text-align: center;
        }
        .signature-line {
            border-top: 1px solid #333;
            margin-top: 50px;
            padding-top: 5px;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 8px;
            color: #666;
            border-top: 1px solid #ccc;
            padding-top: 10px;
        }
        .verification-summary {
            background-color: #f9f9f9;
            border: 1px solid #333;
            padding: 15px;
            margin: 15px 0;
        }
        .verification-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">{{ $report->branch->name ?? 'PAWN SHOP' }}</div>
        <div>{{ $report->branch->address ?? '' }}</div>
    </div>

    <div class="report-title">LAPORAN AKHIR HARI / DAY-END REPORT</div>
    <div class="report-date">
        Tarikh / Date: <strong>{{ $report->report_date->format('d/m/Y') }}</strong> ({{ $report->report_date->format('l') }})
    </div>

    <!-- Transaction Summary -->
    <div class="section">
        <div class="section-title">RINGKASAN TRANSAKSI / TRANSACTION SUMMARY</div>
        <table>
            <thead>
                <tr>
                    <th>Jenis / Type</th>
                    <th class="text-center">Bil / Count</th>
                    <th class="text-right">Jumlah / Amount (RM)</th>
                    <th class="text-right">Tunai / Cash (RM)</th>
                    <th class="text-right">Pindahan / Transfer (RM)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Pajakan Baru / New Pledges</td>
                    <td class="text-center">{{ $report->new_pledges_count }}</td>
                    <td class="text-right">{{ number_format($report->new_pledges_amount, 2) }}</td>
                    <td class="text-right">{{ number_format($report->new_pledges_cash, 2) }}</td>
                    <td class="text-right">{{ number_format($report->new_pledges_transfer, 2) }}</td>
                </tr>
                <tr>
                    <td>Sambungan / Renewals</td>
                    <td class="text-center">{{ $report->renewals_count }}</td>
                    <td class="text-right">{{ number_format($report->renewals_amount, 2) }}</td>
                    <td class="text-right">{{ number_format($report->renewals_cash, 2) }}</td>
                    <td class="text-right">{{ number_format($report->renewals_transfer, 2) }}</td>
                </tr>
                <tr>
                    <td>Tebusan / Redemptions</td>
                    <td class="text-center">{{ $report->redemptions_count }}</td>
                    <td class="text-right">{{ number_format($report->redemptions_amount, 2) }}</td>
                    <td class="text-right">{{ number_format($report->redemptions_cash, 2) }}</td>
                    <td class="text-right">{{ number_format($report->redemptions_transfer, 2) }}</td>
                </tr>
                <tr class="total-row">
                    <td>JUMLAH / TOTAL</td>
                    <td class="text-center">{{ $report->new_pledges_count + $report->renewals_count + $report->redemptions_count }}</td>
                    <td class="text-right">{{ number_format($report->new_pledges_amount + $report->renewals_amount + $report->redemptions_amount, 2) }}</td>
                    <td class="text-right">{{ number_format($report->new_pledges_cash + $report->renewals_cash + $report->redemptions_cash, 2) }}</td>
                    <td class="text-right">{{ number_format($report->new_pledges_transfer + $report->renewals_transfer + $report->redemptions_transfer, 2) }}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Items Movement -->
    <div class="section">
        <div class="section-title">PERGERAKAN BARANG / ITEMS MOVEMENT</div>
        <table class="summary-table">
            <tr>
                <td>Barang Masuk / Items In:</td>
                <td class="text-right"><strong>{{ $report->items_in_count }}</strong></td>
            </tr>
            <tr>
                <td>Barang Keluar / Items Out:</td>
                <td class="text-right"><strong>{{ $report->items_out_count }}</strong></td>
            </tr>
            <tr class="total-row">
                <td>Baki Bersih / Net Movement:</td>
                <td class="text-right"><strong>{{ $report->items_in_count - $report->items_out_count }}</strong></td>
            </tr>
        </table>
    </div>

    <!-- Cash Summary -->
    <div class="section">
        <div class="section-title">RINGKASAN TUNAI / CASH SUMMARY</div>
        <table class="summary-table">
            <tr>
                <td>Baki Pembukaan / Opening Balance:</td>
                <td class="text-right">RM {{ number_format($report->opening_balance, 2) }}</td>
            </tr>
            <tr>
                <td>Masuk (Sambungan + Tebusan) / In (Renewals + Redemptions):</td>
                <td class="text-right">RM {{ number_format($report->renewals_cash + $report->redemptions_cash, 2) }}</td>
            </tr>
            <tr>
                <td>Keluar (Pajakan Baru) / Out (New Pledges):</td>
                <td class="text-right">RM {{ number_format($report->new_pledges_cash, 2) }}</td>
            </tr>
            <tr class="grand-total">
                <td>Baki Penutup / Closing Balance:</td>
                <td class="text-right">RM {{ number_format($report->opening_balance + $report->renewals_cash + $report->redemptions_cash - $report->new_pledges_cash, 2) }}</td>
            </tr>
        </table>
    </div>

    <!-- Verification Status -->
    <div class="section">
        <div class="section-title">STATUS PENGESAHAN / VERIFICATION STATUS</div>
        <div class="verification-summary">
            <div class="verification-row">
                <span>Semua Barang Disahkan / All Items Verified:</span>
                <span class="status-badge {{ $report->all_items_verified ? 'status-verified' : 'status-pending' }}">
                    {{ $report->all_items_verified ? 'YA / YES' : 'TIDAK / NO' }}
                </span>
            </div>
            <div class="verification-row">
                <span>Semua Jumlah Disahkan / All Amounts Verified:</span>
                <span class="status-badge {{ $report->all_amounts_verified ? 'status-verified' : 'status-pending' }}">
                    {{ $report->all_amounts_verified ? 'YA / YES' : 'TIDAK / NO' }}
                </span>
            </div>
            <div class="verification-row">
                <span>Status Laporan / Report Status:</span>
                <span class="status-badge {{ $report->status === 'closed' ? 'status-verified' : 'status-pending' }}">
                    {{ strtoupper($report->status) }}
                </span>
            </div>
        </div>
    </div>

    @if($report->notes)
    <div class="section">
        <div class="section-title">CATATAN / NOTES</div>
        <p>{{ $report->notes }}</p>
    </div>
    @endif

    <div class="signature-section">
        <div class="signature-box">
            <div class="signature-line">Disediakan Oleh / Prepared By</div>
        </div>
        <div class="signature-box">
            <div class="signature-line">Disemak Oleh / Verified By</div>
            @if($report->closedBy)
            <div style="font-size: 8px; margin-top: 3px;">{{ $report->closedBy->name }}</div>
            @endif
        </div>
        <div class="signature-box">
            <div class="signature-line">Diluluskan Oleh / Approved By</div>
        </div>
    </div>

    <div class="footer">
        Dicetak pada / Printed: {{ $printed_at->format('d/m/Y H:i:s') }} oleh {{ $printed_by }}<br>
        Laporan ini dijana secara automatik oleh sistem PawnSys.<br>
        This report is automatically generated by PawnSys.
    </div>
</body>
</html>
