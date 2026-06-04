<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pledge;
use App\Models\Renewal;
use App\Models\Redemption;
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
        return Pledge::find($id) ? base64_encode("%PDF-1.4 stub") : null;
    }

    private function renewalPdf(int $id): ?string
    {
        return Renewal::find($id) ? base64_encode("%PDF-1.4 stub") : null;
    }

    private function redemptionPdf(int $id): ?string
    {
        return Redemption::find($id) ? base64_encode("%PDF-1.4 stub") : null;
    }
}
