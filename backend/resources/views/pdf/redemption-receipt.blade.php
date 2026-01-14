<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resit Tebusan / Redemption Receipt</title>
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
            color: #006600;
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
            background-color: #e6ffe6;
            border: 2px solid #006600;
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
        .items-released {
            background-color: #ffffcc;
            border: 1px solid #999;
            padding: 10px;
            margin: 10px 0;
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
        .completed-stamp {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            color: #006600;
            border: 3px solid #006600;
            padding: 5px 20px;
            display: inline-block;
            margin: 10px auto;
            transform: rotate(-5deg);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">{{ $redemption->pledge->branch->name ?? 'PAWN SHOP' }}</div>
        <div class="branch-info">
            {{ $redemption->pledge->branch->address ?? '' }}<br>
            Tel: {{ $redemption->pledge->branch->phone ?? '' }}
        </div>
    </div>

    <div class="receipt-title">RESIT TEBUSAN / REDEMPTION RECEIPT</div>

    <div style="text-align: center;">
        <div class="completed-stamp">DITEBUS / REDEEMED</div>
    </div>

    <div class="info-section">
        <div class="info-row">
            <span class="info-label">No. Tebusan / Redemption No:</span>
            <span class="info-value"><strong>{{ $redemption->redemption_no }}</strong></span>
        </div>
        <div class="info-row">
            <span class="info-label">No. Pajak / Pledge No:</span>
            <span class="info-value">{{ $redemption->pledge->pledge_no }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">No. Resit Asal / Original Receipt:</span>
            <span class="info-value">{{ $redemption->pledge->receipt_no }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Tarikh Tebusan / Redemption Date:</span>
            <span class="info-value">{{ $redemption->created_at->format('d/m/Y H:i') }}</span>
        </div>
    </div>

    <div class="info-section">
        <div class="info-row">
            <span class="info-label">Nama Penggadai / Customer:</span>
            <span class="info-value">{{ $redemption->pledge->customer->name }}</span>
        </div>
        <div class="info-row">
            <span class="info-label">No. K/P / IC No:</span>
            <span class="info-value">{{ $redemption->pledge->customer->ic_number }}</span>
        </div>
    </div>

    <div class="items-released">
        <strong>Barang Dilepaskan / Items Released:</strong>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Perkara / Item</th>
                    <th>Ketulenan</th>
                    <th class="text-right">Berat (g)</th>
                    <th>Lokasi/Storage</th>
                </tr>
            </thead>
            <tbody>
                @foreach($redemption->pledge->items as $index => $item)
                <tr>
                    <td class="text-center">{{ $index + 1 }}</td>
                    <td>{{ $item->category->name_en ?? 'Item' }} {{ $item->description ? '- ' . $item->description : '' }}</td>
                    <td class="text-center">{{ $item->purity->code ?? '' }}</td>
                    <td class="text-right">{{ number_format($item->net_weight, 3) }}</td>
                    <td style="font-size: 8px;">
                        @if($item->vault_id)
                            {{ $item->vault->code ?? '' }} / B{{ $item->box->box_number ?? '-' }} / S{{ $item->slot->slot_number ?? '-' }}
                        @else
                            -
                        @endif
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="summary-box">
        <div class="summary-row">
            <span>Jumlah Pinjaman / Principal Amount:</span>
            <span>RM {{ number_format($redemption->principal_amount, 2) }}</span>
        </div>
        <div class="summary-row">
            <span>Faedah Terkumpul / Accrued Interest:</span>
            <span>RM {{ number_format($redemption->interest_amount, 2) }}</span>
        </div>
        @if($redemption->overdue_interest > 0)
        <div class="summary-row">
            <span>Faedah Lewat / Overdue Interest:</span>
            <span>RM {{ number_format($redemption->overdue_interest, 2) }}</span>
        </div>
        @endif
        @if($redemption->handling_fee > 0)
        <div class="summary-row">
            <span>Yuran Pengendalian / Handling Fee:</span>
            <span>RM {{ number_format($redemption->handling_fee, 2) }}</span>
        </div>
        @endif
        <div class="summary-row total-row">
            <span>JUMLAH TEBUSAN / TOTAL REDEMPTION:</span>
            <span>RM {{ number_format($redemption->total_payable, 2) }}</span>
        </div>
    </div>

    <div class="info-section">
        <div class="info-row">
            <span class="info-label">Cara Bayaran / Payment:</span>
            <span class="info-value">
                @if($redemption->cash_amount > 0)Tunai: RM {{ number_format($redemption->cash_amount, 2) }}@endif
                @if($redemption->transfer_amount > 0) Pindahan: RM {{ number_format($redemption->transfer_amount, 2) }} ({{ $redemption->bank->name ?? '' }})@endif
            </span>
        </div>
    </div>

    <div class="signature-section">
        <div class="signature-box">
            <div class="signature-line">Tandatangan Penggadai / Customer</div>
            <div style="font-size: 8px; margin-top: 3px;">Saya mengaku telah menerima semua barang gadaian</div>
            <div style="font-size: 8px;">I acknowledge receipt of all pledged items</div>
        </div>
        <div class="signature-box">
            <div class="signature-line">Tandatangan Pegawai / Officer</div>
            <div style="font-size: 8px; margin-top: 3px;">{{ $redemption->createdBy->name ?? '' }}</div>
        </div>
    </div>

    <div class="footer">
        Dicetak pada / Printed: {{ $printed_at->format('d/m/Y H:i:s') }} oleh {{ $printed_by }}<br>
        Transaksi ini telah selesai. Terima kasih kerana berurusan dengan kami.<br>
        This transaction is complete. Thank you for your business.
    </div>
</body>
</html>
