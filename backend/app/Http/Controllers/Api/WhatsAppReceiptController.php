<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pledge;
use App\Models\Renewal;
use App\Models\Redemption;
use App\Services\WhatsApp\ReceiptPdfBuilder;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class WhatsAppReceiptController extends Controller
{
    /**
     * Serve a receipt PDF over a signed, time-limited public URL (for AiSensy media fetch).
     * NOTE: PDF generation is stubbed here; a later task wires the real ReceiptPdfBuilder.
     */
    public function show(Request $request, string $type, int $id): Response
    {
        $pdfBase64 = match ($type) {
            'pledge' => $this->pledgePdf($id),
            'renewal' => $this->renewalPdf($id),
            'redemption' => $this->redemptionPdf($id),
            default => null,
        };

        if ($pdfBase64 === null) {
            abort(404);
        }

        return response(base64_decode($pdfBase64), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="receipt.pdf"',
        ]);
    }

    private function pledgePdf(int $id): ?string
    {
        $pledge = Pledge::with(['customer', 'items.category', 'items.purity', 'branch'])->find($id);
        return $pledge ? app(ReceiptPdfBuilder::class)->pledge($pledge) : null;
    }

    private function renewalPdf(int $id): ?string
    {
        $renewal = Renewal::with(['pledge.customer', 'pledge.items.category', 'pledge.branch'])->find($id);
        return $renewal ? app(ReceiptPdfBuilder::class)->renewal($renewal) : null;
    }

    private function redemptionPdf(int $id): ?string
    {
        $redemption = Redemption::with(['pledge.customer', 'pledge.items.category', 'pledge.items.purity', 'pledge.branch'])->find($id);
        return $redemption ? app(ReceiptPdfBuilder::class)->redemption($redemption) : null;
    }
}
