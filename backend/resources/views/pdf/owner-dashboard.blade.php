@php
    /**
     * Daily Owner Dashboard
     * Data contract is built by App\Console\Commands\SendDailyOwnerDashboard@buildData
     * Available roots: $meta, $tx, $loans, $interest, $cash_flow, $inventory, $gold, $final
     */
    $rm = fn ($v) => 'RM ' . number_format((float) $v, 2);
    $rm0 = fn ($v) => 'RM ' . number_format((float) $v, 0);
@endphp
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Daily Owner Dashboard — {{ $meta['date_label'] }}</title>
<style>
    /* ─── Inter font family (registered for DomPDF) ─── */
    @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 400;
        src: url('{{ storage_path("fonts/Inter-Regular.ttf") }}') format('truetype');
    }
    @font-face {
        font-family: 'Inter';
        font-style: italic;
        font-weight: 400;
        src: url('{{ storage_path("fonts/Inter-Italic.ttf") }}') format('truetype');
    }
    @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 600;
        src: url('{{ storage_path("fonts/Inter-SemiBold.ttf") }}') format('truetype');
    }
    @font-face {
        font-family: 'Inter';
        font-style: normal;
        font-weight: 700;
        src: url('{{ storage_path("fonts/Inter-Bold.ttf") }}') format('truetype');
    }

    @page { size: A4 portrait; margin: 22pt 22pt 32pt 22pt; }

    body {
        font-family: 'Inter', 'DejaVu Sans', Arial, sans-serif;
        font-size: 8.5pt;
        color: #1e293b;
        margin: 0; padding: 0;
        line-height: 1.45;
    }

    /* ─── Header ─── */
    .hdr {
        width: 100%;
        border-collapse: collapse;
        border-bottom: 2pt solid #1e3a5f;
        margin-bottom: 14pt;
        padding-bottom: 10pt;
    }
    .hdr td { padding: 0; vertical-align: middle; border: none; }
    .hdr-logo {
        width: 56pt; height: 56pt;
        text-align: center;
    }
    .hdr-logo img {
        width: 56pt; height: 56pt;
        object-fit: contain;
    }
    .hdr-logo-fallback {
        width: 56pt; height: 56pt;
        background: #fef9ee;
        border: 1.5pt solid #c8973e;
        color: #92732a;
        font-size: 24pt;
        font-weight: bold;
        text-align: center;
        line-height: 56pt;
        -webkit-border-radius: 28pt;
        border-radius: 28pt;
    }
    .hdr-info {
        padding-left: 14pt !important;
    }
    .hdr-company {
        font-size: 17pt;
        font-weight: bold;
        color: #1e3a5f;
        letter-spacing: 0.3pt;
        line-height: 1.1;
    }
    .hdr-reg {
        font-size: 7.5pt;
        color: #c8973e;
        font-weight: bold;
        margin-top: 1pt;
        letter-spacing: 0.3pt;
    }
    .hdr-contact {
        font-size: 7.8pt;
        color: #334155;
        margin-top: 4pt;
        line-height: 1.55;
    }
    .hdr-contact .lbl {
        color: #c8973e;
        font-weight: bold;
        letter-spacing: 0.2pt;
    }
    .hdr-contact .val {
        color: #1e3a5f;
        font-weight: bold;
    }
    .hdr-contact .sep {
        color: #cbd5e1;
        margin: 0 4pt;
    }
    .hdr-right { text-align: right; vertical-align: top !important; }
    .hdr-date {
        font-size: 12pt; font-weight: bold; color: #1e3a5f;
        letter-spacing: 0.2pt;
    }
    .hdr-meta {
        font-size: 7.5pt;
        margin-top: 4pt;
        line-height: 1.55;
    }
    .hdr-meta .day {
        color: #c8973e;
        font-weight: bold;
    }
    .hdr-meta .branch {
        color: #1e3a5f;
        font-weight: bold;
    }
    .hdr-meta .label {
        color: #1e3a5f;
        font-weight: bold;
        letter-spacing: 0.3pt;
    }
    .hdr-meta .gen {
        color: #94a3b8;
        font-size: 6.8pt;
        font-style: italic;
    }
    .hdr-badge {
        display: inline-block;
        background: #c8973e;
        color: #ffffff;
        padding: 2pt 7pt;
        font-size: 7pt;
        font-weight: bold;
        letter-spacing: 0.5pt;
        margin-top: 4pt;
        text-transform: uppercase;
    }

    /* ─── Section ─── */
    .sec { margin-bottom: 14pt; page-break-inside: avoid; }
    .sec-title {
        padding-bottom: 4pt;
        border-bottom: 2pt solid #c8973e;
        margin-bottom: 8pt;
    }
    .sec-title table { width: 100%; border-collapse: collapse; }
    .sec-title td { border: none; padding: 0; vertical-align: top; }
    .sec-title .num {
        background: #c8973e;
        color: #ffffff;
        width: 16pt; height: 16pt;
        text-align: center;
        line-height: 12pt;
        font-size: 9pt;
        font-weight: bold;
        padding-top: 2pt;
    }
    .sec-title .label {
        padding: 2pt 0 0 8pt;
        font-size: 9.5pt;
        font-weight: bold;
        color: #1e3a5f;
        letter-spacing: 0.8pt;
        text-transform: uppercase;
    }

    /* ─── KPI cards ─── */
    .kpi { width: 100%; border-collapse: separate; border-spacing: 5pt 0; margin-bottom: 8pt; }
    .kpi td { vertical-align: top; padding: 0; border: none; }
    .card {
        background: #ffffff;
        border: 1pt solid #e2e8f0;
        border-top: 3pt solid #1e3a5f;
        padding: 8pt 10pt;
        text-align: left;
    }
    .card.gold    { border-top-color: #c8973e; }
    .card.green   { border-top-color: #10b981; }
    .card.red     { border-top-color: #ef4444; }
    .card.blue    { border-top-color: #3b82f6; }
    .card.warn    { border-top-color: #f59e0b; }
    .card.flat    { background: #f8fafc; }
    .card-label {
        font-size: 6.8pt;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.4pt;
        margin-bottom: 3pt;
    }
    .card-value {
        font-size: 14pt;
        font-weight: bold;
        color: #1e293b;
        line-height: 1.15;
    }
    .card-value.sm  { font-size: 12pt; }
    .card-value.green { color: #10b981; }
    .card-value.red   { color: #ef4444; }
    .card-value.gold  { color: #c8973e; }
    .card-value.navy  { color: #1e3a5f; }
    .card-sub {
        font-size: 7pt;
        color: #94a3b8;
        margin-top: 3pt;
    }

    /* ─── Tables ─── */
    .tbl { width: 100%; border-collapse: collapse; font-size: 8pt; }
    .tbl th {
        background: #f1f5f9;
        color: #334155;
        text-align: left;
        font-size: 7.2pt;
        font-weight: bold;
        letter-spacing: 0.3pt;
        text-transform: uppercase;
        padding: 5pt 7pt;
        border-bottom: 1pt solid #cbd5e1;
    }
    .tbl td {
        padding: 5pt 7pt;
        border-bottom: 0.5pt solid #e2e8f0;
    }
    .tbl tr.total td {
        background: #1e3a5f;
        color: #ffffff;
        font-weight: bold;
        border-bottom: none;
    }
    .right { text-align: right; }
    .center { text-align: center; }
    .mono { font-family: 'DejaVu Sans Mono', 'Courier New', monospace; }

    /* ─── Chart wrapper ─── */
    .chart-row { width: 100%; border-collapse: collapse; margin-top: 6pt; }
    .chart-row td { padding: 0 3pt; vertical-align: top; border: none; }
    .chart-box {
        background: #ffffff;
        border: 1pt solid #e2e8f0;
        padding: 8pt;
        text-align: center;
    }
    .chart-box img { max-width: 100%; height: auto; }
    .chart-caption {
        font-size: 7pt;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.4pt;
        font-weight: bold;
        margin-bottom: 2pt;
        text-align: left;
    }
    .chart-subcaption {
        font-size: 6.5pt;
        color: #94a3b8;
        font-style: italic;
        margin-bottom: 6pt;
        text-align: left;
    }

    /* ─── Gold price tiles ─── */
    .gold-strip { width: 100%; border-collapse: separate; border-spacing: 5pt 0; }
    .gold-strip td { padding: 0; border: none; }
    .gold-tile {
        background: #fef9ee;
        border: 1pt solid #c8973e;
        padding: 7pt;
        text-align: center;
    }
    .gold-tile-label {
        font-size: 6.5pt;
        color: #92732a;
        text-transform: uppercase;
        letter-spacing: 0.4pt;
        font-weight: bold;
    }
    .gold-tile-price {
        font-size: 13pt;
        font-weight: bold;
        color: #92732a;
        margin-top: 2pt;
    }
    .gold-tile-unit { font-size: 6.5pt; color: #b8963c; }

    /* ─── Footer ─── */
    .footer {
        position: fixed;
        bottom: -15pt; left: 0; right: 0;
        font-size: 6.5pt;
        color: #94a3b8;
        border-top: 0.5pt solid #e2e8f0;
        padding-top: 5pt;
    }
    .footer table { width: 100%; border-collapse: collapse; }
    .footer td { border: none; padding: 0; }
</style>
</head>
<body>

{{-- ═══════════════════════════════════════════════════════
     HEADER — logo + company details + report meta
═══════════════════════════════════════════════════════ --}}
<table class="hdr">
    <tr>
        <td class="hdr-logo" style="width:60pt;">
            @if($meta['logo'])
                <img src="{{ $meta['logo'] }}" alt="logo">
            @else
                <div class="hdr-logo-fallback">當</div>
            @endif
        </td>
        <td class="hdr-info">
            <div class="hdr-company">
                {{ $meta['company_name'] }}
                @if($meta['company_chinese'])
                    <span style="font-size:10pt; color:#c8973e;">· {{ $meta['company_chinese'] }}</span>
                @endif
            </div>
            @if($meta['registration_no'])
                <div class="hdr-reg">({{ $meta['registration_no'] }})</div>
            @endif
            <div class="hdr-contact">
                @if($meta['address'])<span class="val">{{ $meta['address'] }}</span><br>@endif
                @if($meta['email'])<span class="lbl">Email:</span> <span class="val">{{ $meta['email'] }}</span>@endif
                @if($meta['phone'])
                    @if($meta['email'])<span class="sep">·</span>@endif
                    <span class="lbl">Tel:</span> <span class="val">{{ $meta['phone'] }}</span>
                @endif
                @if($meta['license_no'])<span class="sep">·</span><span class="lbl">KPKT</span> <span class="val">{{ $meta['license_no'] }}</span>@endif
            </div>
        </td>
        <td class="hdr-right" style="width:140pt;">
            <div class="hdr-date">{{ $meta['date_label'] }}</div>
            <div class="hdr-meta">
                <span class="day">{{ $meta['day_name'] }}</span>
                <span style="color:#cbd5e1;"> · </span>
                <span class="branch">{{ $meta['branch_name'] }}</span><br>
                <span class="label">Daily Owner Dashboard</span><br>
                <span class="gen">Generated {{ $meta['generated_at']->format('d/m/Y H:i') }}</span>
            </div>
            @if($meta['status'])
                <div class="hdr-badge">{{ strtoupper($meta['status']) }}</div>
            @endif
        </td>
    </tr>
</table>


{{-- ═══════════════════════════════════════════════════════
     1. DAILY TRANSACTION SUMMARY
═══════════════════════════════════════════════════════ --}}
@if($tx['has_data'])
<div class="sec">
    <div class="sec-title">
        <table><tr>
            <td style="width:16pt;"><div class="num">1</div></td>
            <td class="label">Daily Transaction Summary</td>
        </tr></table>
    </div>

    <table class="kpi">
        <tr>
            @foreach($tx['rows'] as $row)
                @php
                    $cls = match($row['label']) {
                        'Pledges'           => 'navy',
                        'Renewals'          => 'warn',
                        'Redemptions'       => 'green',
                        'Interest Payments' => 'blue',
                        default             => '',
                    };
                    $vcls = match($row['label']) {
                        'Pledges'           => 'navy',
                        'Renewals'          => '',
                        'Redemptions'       => 'green',
                        'Interest Payments' => '',
                        default             => '',
                    };
                @endphp
                <td style="width:25%;">
                    <div class="card {{ $cls }}">
                        <div class="card-label">{{ $row['label'] }}</div>
                        <div class="card-value sm {{ $vcls }}">{{ $rm($row['amount']) }}</div>
                        <div class="card-sub"><strong>{{ $row['count'] }}</strong> transaction{{ $row['count'] === 1 ? '' : 's' }}</div>
                    </div>
                </td>
            @endforeach
        </tr>
    </table>

    <table class="chart-row">
        <tr>
            <td style="width:55%;">
                @if($tx['chart'])
                    <div class="chart-box">
                        <div class="chart-caption">Transaction Mix</div>
                        <div class="chart-subcaption">Share of today's activity by transaction type (count-based)</div>
                        <img src="{{ $tx['chart'] }}" alt="Transaction Mix">
                    </div>
                @endif
            </td>
            <td style="width:45%;">
                <div class="chart-box" style="text-align:left;">
                    <div class="chart-caption">Totals</div>
                    <table class="tbl">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th class="center">Count</th>
                                <th class="right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($tx['rows'] as $row)
                                @continue($row['count'] === 0)
                                <tr>
                                    <td>{{ $row['label'] }}</td>
                                    <td class="center">{{ $row['count'] }}</td>
                                    <td class="right mono">{{ $rm($row['amount']) }}</td>
                                </tr>
                            @endforeach
                            <tr class="total">
                                <td>TOTAL</td>
                                <td class="center">{{ $tx['total_count'] }}</td>
                                <td class="right mono">{{ $rm($tx['total_amount']) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </td>
        </tr>
    </table>
</div>
@endif


{{-- ═══════════════════════════════════════════════════════
     2. LOAN DISBURSEMENT SUMMARY
═══════════════════════════════════════════════════════ --}}
@if($loans['has_data'])
<div class="sec">
    <div class="sec-title">
        <table><tr>
            <td style="width:16pt;"><div class="num">2</div></td>
            <td class="label">Loan Disbursement Summary</td>
        </tr></table>
    </div>

    <table class="kpi">
        <tr>
            <td style="width:33%;">
                <div class="card navy">
                    <div class="card-label">Gross Pledged Value</div>
                    <div class="card-value navy">{{ $rm($loans['gross_pledged']) }}</div>
                    <div class="card-sub">Before deductions</div>
                </div>
            </td>
            <td style="width:33%;">
                <div class="card red">
                    <div class="card-label">Total Deductions</div>
                    <div class="card-value red">- {{ $rm($loans['total_deductions'] + $loans['handling_fees']) }}</div>
                    <div class="card-sub">Stone + handling fees</div>
                </div>
            </td>
            <td style="width:33%;">
                <div class="card gold">
                    <div class="card-label">Net Loan Released</div>
                    <div class="card-value gold">{{ $rm($loans['net_released']) }}</div>
                    <div class="card-sub">
                        Avg {{ number_format($loans['avg_rate'], 2) }}% ·
                        Avg ticket {{ $rm0($loans['avg_ticket']) }}
                    </div>
                </div>
            </td>
        </tr>
    </table>

    <table class="chart-row">
        <tr>
            <td style="width:55%;">
                @if($loans['payment_chart'])
                    <div class="chart-box">
                        <div class="chart-caption">Payment Method Breakdown</div>
                        <div class="chart-subcaption">How today's loan payouts were settled — cash vs bank transfer</div>
                        <img src="{{ $loans['payment_chart'] }}" alt="Payment Methods">
                    </div>
                @endif
            </td>
            <td style="width:45%;">
                <div class="chart-box" style="text-align:left;">
                    <div class="chart-caption">Disbursement Detail</div>
                    <table class="tbl">
                        <tr>
                            <td>Gross Pledged Value</td>
                            <td class="right mono">{{ $rm($loans['gross_pledged']) }}</td>
                        </tr>
                        <tr>
                            <td>Stone / Other Deductions</td>
                            <td class="right mono">- {{ $rm($loans['total_deductions']) }}</td>
                        </tr>
                        <tr>
                            <td>Handling Fees</td>
                            <td class="right mono">- {{ $rm($loans['handling_fees']) }}</td>
                        </tr>
                        <tr class="total">
                            <td>Net Released</td>
                            <td class="right mono">{{ $rm($loans['net_released']) }}</td>
                        </tr>
                        <tr>
                            <td>&nbsp; via Cash</td>
                            <td class="right mono">{{ $rm($loans['cash']) }}</td>
                        </tr>
                        <tr>
                            <td>&nbsp; via Bank Transfer</td>
                            <td class="right mono">{{ $rm($loans['transfer']) }}</td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
    </table>
</div>
@endif


{{-- ═══════════════════════════════════════════════════════
     3. INTEREST COLLECTION SUMMARY
═══════════════════════════════════════════════════════ --}}
@if($interest['has_data'])
<div class="sec">
    <div class="sec-title">
        <table><tr>
            <td style="width:16pt;"><div class="num">3</div></td>
            <td class="label">Interest Collection Summary</td>
        </tr></table>
    </div>

    <table class="kpi">
        <tr>
            <td style="width:34%;">
                <div class="card green">
                    <div class="card-label">Total Interest Collected</div>
                    <div class="card-value green">{{ $rm($interest['total']) }}</div>
                    <div class="card-sub">All sources combined</div>
                </div>
            </td>
            <td style="width:33%;">
                <div class="card warn">
                    <div class="card-label">From Renewals</div>
                    <div class="card-value sm">{{ $rm($interest['from_renewals']) }}</div>
                </div>
            </td>
            <td style="width:33%;">
                <div class="card blue">
                    <div class="card-label">Redemption + Interest Pay</div>
                    <div class="card-value sm">{{ $rm($interest['from_redemptions'] + $interest['from_interest_pay']) }}</div>
                </div>
            </td>
        </tr>
    </table>

    <table class="chart-row">
        <tr>
            <td style="width:60%;">
                @if($interest['chart'])
                    <div class="chart-box">
                        <div class="chart-caption">Interest by Source</div>
                        <div class="chart-subcaption">Where today's interest income came from — renewals, redemptions, or standalone interest payments</div>
                        <img src="{{ $interest['chart'] }}" alt="Interest Sources">
                    </div>
                @endif
            </td>
            <td style="width:40%;">
                <div class="chart-box" style="text-align:left;">
                    <div class="chart-caption">Breakdown</div>
                    <table class="tbl">
                        <tr>
                            <td>From Renewals</td>
                            <td class="right mono">{{ $rm($interest['from_renewals']) }}</td>
                        </tr>
                        <tr>
                            <td>From Redemptions</td>
                            <td class="right mono">{{ $rm($interest['from_redemptions']) }}</td>
                        </tr>
                        <tr>
                            <td>Interest Payments</td>
                            <td class="right mono">{{ $rm($interest['from_interest_pay']) }}</td>
                        </tr>
                        <tr class="total">
                            <td>TOTAL INTEREST</td>
                            <td class="right mono">{{ $rm($interest['total']) }}</td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
    </table>
</div>
@endif


{{-- ═══════════════════════════════════════════════════════
     4. DAILY CASH FLOW SUMMARY
═══════════════════════════════════════════════════════ --}}
@if($cash_flow['has_data'])
<div class="sec">
    <div class="sec-title">
        <table><tr>
            <td style="width:16pt;"><div class="num">4</div></td>
            <td class="label">Daily Cash Flow Summary</td>
        </tr></table>
    </div>

    <table class="kpi">
        <tr>
            <td style="width:25%;">
                <div class="card navy">
                    <div class="card-label">Opening Balance</div>
                    <div class="card-value sm navy">{{ $rm($cash_flow['opening']) }}</div>
                </div>
            </td>
            <td style="width:25%;">
                <div class="card green">
                    <div class="card-label">Cash In</div>
                    <div class="card-value sm green">+ {{ $rm($cash_flow['cash_in']) }}</div>
                    <div class="card-sub">Collections received</div>
                </div>
            </td>
            <td style="width:25%;">
                <div class="card red">
                    <div class="card-label">Cash Out</div>
                    <div class="card-value sm red">- {{ $rm($cash_flow['cash_out']) }}</div>
                    <div class="card-sub">Loans paid out</div>
                </div>
            </td>
            <td style="width:25%;">
                <div class="card gold">
                    <div class="card-label">{{ $cash_flow['has_actual'] ? 'Actual Closing' : 'Expected Closing' }}</div>
                    <div class="card-value sm gold">{{ $rm($cash_flow['actual_closing'] ?? $cash_flow['expected_closing']) }}</div>
                    @if($cash_flow['has_actual'])
                        @php $v = $cash_flow['variance']; @endphp
                        <div class="card-sub" style="color: {{ abs($v) < 1 ? '#10b981' : '#ef4444' }};">
                            Variance: {{ $v >= 0 ? '+' : '' }}{{ $rm($v) }}
                        </div>
                    @endif
                </div>
            </td>
        </tr>
    </table>

    @if($cash_flow['chart'])
        <div class="chart-box">
            <div class="chart-caption">Cash Flow Movement</div>
            <div class="chart-subcaption">Opening balance, money in / out, and the resulting closing position</div>
            <img src="{{ $cash_flow['chart'] }}" alt="Cash Flow">
        </div>
    @endif

    {{-- Cash flow detail table — shows Other Cash Income only when present --}}
    <table class="tbl" style="margin-top:8pt;">
        <thead>
            <tr>
                <th style="width:55%;">Line Item</th>
                <th class="right">Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Opening Cash Balance</td>
                <td class="right mono">{{ $rm($cash_flow['opening']) }}</td>
            </tr>
            <tr>
                <td>Cash Paid Out (Loans Disbursed)</td>
                <td class="right mono">- {{ $rm($cash_flow['cash_out']) }}</td>
            </tr>
            <tr>
                <td>Cash Collected (Interest &amp; Redemptions)</td>
                <td class="right mono">+ {{ $rm($cash_flow['cash_in']) }}</td>
            </tr>
            @if($cash_flow['other_income'] > 0)
                <tr>
                    <td>Other Cash Income</td>
                    <td class="right mono">+ {{ $rm($cash_flow['other_income']) }}</td>
                </tr>
            @endif
            <tr class="total">
                <td>{{ $cash_flow['has_actual'] ? 'Actual Closing Balance' : 'Expected Closing Balance' }}</td>
                <td class="right mono">{{ $rm($cash_flow['actual_closing'] ?? $cash_flow['expected_closing']) }}</td>
            </tr>
        </tbody>
    </table>
</div>
@endif


{{-- ═══════════════════════════════════════════════════════
     5. INVENTORY & GOLD SUMMARY
═══════════════════════════════════════════════════════ --}}
@if($inventory['has_data'] || $gold['has_data'])
<div class="sec">
    <div class="sec-title">
        <table><tr>
            <td style="width:16pt;"><div class="num">5</div></td>
            <td class="label">Inventory &amp; Gold Summary</td>
        </tr></table>
    </div>

    @if($gold['has_data'])
        <div class="chart-caption" style="margin-bottom:6pt;">Today's Gold Prices (RM / gram)</div>
        <table class="gold-strip" style="margin-bottom:10pt;">
            <tr>
                @foreach($gold['prices'] as $g)
                    <td style="width: {{ floor(100 / max(count($gold['prices']), 1)) }}%;">
                        <div class="gold-tile">
                            <div class="gold-tile-label">{{ $g['code'] }}</div>
                            <div class="gold-tile-price">{{ number_format($g['price'], 2) }}</div>
                            <div class="gold-tile-unit">RM / g</div>
                        </div>
                    </td>
                @endforeach
            </tr>
        </table>
        @if($gold['source'] || $gold['price_date'])
            <div style="font-size:6.5pt; color:#94a3b8; text-align:right; margin-bottom:8pt;">
                Source: {{ ucfirst($gold['source'] ?? 'manual') }}
                @if($gold['price_date']) · {{ $gold['price_date'] }} @endif
            </div>
        @endif
    @endif

    @if($inventory['has_data'])
        <table class="kpi">
            <tr>
                <td style="width:33%;">
                    <div class="card green">
                        <div class="card-label">Items Received</div>
                        <div class="card-value green">{{ $inventory['items_in'] }}</div>
                        <div class="card-sub">{{ number_format($inventory['total_weight'], 2) }} g total</div>
                    </div>
                </td>
                <td style="width:33%;">
                    <div class="card red">
                        <div class="card-label">Items Released</div>
                        <div class="card-value red">{{ $inventory['items_out'] }}</div>
                        <div class="card-sub">Redeemed today</div>
                    </div>
                </td>
                <td style="width:34%;">
                    <div class="card gold">
                        <div class="card-label">Net Items Movement</div>
                        <div class="card-value gold">{{ ($inventory['items_in'] - $inventory['items_out']) >= 0 ? '+' : '' }}{{ $inventory['items_in'] - $inventory['items_out'] }}</div>
                        <div class="card-sub">In − Out</div>
                    </div>
                </td>
            </tr>
        </table>

        @if(count($inventory['by_purity']) > 0)
            <table class="chart-row">
                <tr>
                    <td style="width:55%;">
                        @if($inventory['chart'])
                            <div class="chart-box">
                                <div class="chart-caption">Weight by Purity (Received)</div>
                                <div class="chart-subcaption">Total net weight (grams) of items received today, grouped by gold purity</div>
                                <img src="{{ $inventory['chart'] }}" alt="Purity Breakdown">
                            </div>
                        @endif
                    </td>
                    <td style="width:45%;">
                        <div class="chart-box" style="text-align:left;">
                            <div class="chart-caption">Inventory Detail</div>
                            <table class="tbl">
                                <thead>
                                    <tr>
                                        <th>Purity</th>
                                        <th class="center">Items</th>
                                        <th class="right">Weight (g)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach($inventory['by_purity'] as $p)
                                        <tr>
                                            <td><strong>{{ $p['code'] }}</strong></td>
                                            <td class="center">{{ $p['count'] }}</td>
                                            <td class="right mono">{{ number_format($p['weight'], 3) }}</td>
                                        </tr>
                                    @endforeach
                                    <tr class="total">
                                        <td>TOTAL</td>
                                        <td class="center">{{ $inventory['items_in'] }}</td>
                                        <td class="right mono">{{ number_format($inventory['total_weight'], 3) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            </table>
        @endif
    @endif
</div>
@endif


{{-- ═══════════════════════════════════════════════════════
     6. FINAL DAILY FINANCIAL SUMMARY
═══════════════════════════════════════════════════════ --}}
@if($final['has_data'])
<div class="sec">
    <div class="sec-title">
        <table><tr>
            <td style="width:16pt;"><div class="num">6</div></td>
            <td class="label">Final Daily Financial Summary</td>
        </tr></table>
    </div>

    <table class="kpi">
        <tr>
            <td style="width:33%;">
                <div class="card green">
                    <div class="card-label">Total Income</div>
                    <div class="card-value green">{{ $rm($final['income']) }}</div>
                    <div class="card-sub">Money received today</div>
                </div>
            </td>
            <td style="width:33%;">
                <div class="card red">
                    <div class="card-label">Total Outflow</div>
                    <div class="card-value red">{{ $rm($final['outflow']) }}</div>
                    <div class="card-sub">Money paid out today</div>
                </div>
            </td>
            <td style="width:34%;">
                <div class="card {{ $final['net_movement'] >= 0 ? 'green' : 'red' }}">
                    <div class="card-label">Net Daily Movement</div>
                    <div class="card-value {{ $final['net_movement'] >= 0 ? 'green' : 'red' }}">
                        {{ $final['net_movement'] >= 0 ? '+' : '' }}{{ $rm($final['net_movement']) }}
                    </div>
                    <div class="card-sub">{{ $final['net_movement'] >= 0 ? 'Positive flow' : 'Negative flow' }}</div>
                </div>
            </td>
        </tr>
    </table>

    @if(!empty($final['trend_chart']) && $final['trend_has_data'])
        <div class="chart-box" style="margin-bottom:8pt;">
            <div class="chart-caption">7-Day Income &amp; Outflow Trend</div>
            <div class="chart-subcaption">Daily totals over the last week — green is money received, red is money paid out</div>
            <img src="{{ $final['trend_chart'] }}" alt="7-Day Trend">
        </div>
    @endif

    @if($final['chart'])
        <div class="chart-box">
            <div class="chart-caption">Today: Income vs Outflow</div>
            <div class="chart-subcaption">Side-by-side comparison of money received vs money paid out today</div>
            <img src="{{ $final['chart'] }}" alt="Income vs Outflow">
        </div>
    @endif
</div>
@endif


{{-- ═══════════════════════════════════════════════════════
     EMPTY STATE
═══════════════════════════════════════════════════════ --}}
@if(!$tx['has_data'] && !$loans['has_data'] && !$interest['has_data']
    && !$cash_flow['has_data'] && !$inventory['has_data']
    && !$gold['has_data'] && !$final['has_data'])
    <div class="sec" style="text-align:center; padding: 40pt 20pt;">
        <div style="font-size: 11pt; color: #64748b; font-weight: bold;">
            No activity recorded for {{ $meta['date_label'] }}
        </div>
        <div style="font-size: 8pt; color: #94a3b8; margin-top: 6pt;">
            There were no transactions, cash flow events, or inventory changes at this branch today.
        </div>
    </div>
@endif


{{-- ═══════════════════════════════════════════════════════
     FOOTER
═══════════════════════════════════════════════════════ --}}
<div class="footer">
    <table>
        <tr>
            <td style="width:50%; text-align:left;">
                {{ $meta['company_name'] }} — {{ $meta['branch_name'] }} · Daily Owner Dashboard
            </td>
            <td style="width:50%; text-align:right;">
                Generated {{ $meta['generated_at']->format('d M Y H:i') }}
            </td>
        </tr>
    </table>
</div>

</body>
</html>
