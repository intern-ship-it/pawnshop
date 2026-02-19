import { useState, useEffect } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { getToken } from "@/services/api";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Badge } from "@/components/common";
import {
  Printer,
  FileText,
  Barcode,
  Search,
  RefreshCw,
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
  ExternalLink,
  TestTube,
  Receipt,
  RotateCcw,
  Layers,
} from "lucide-react";

export default function PrintTestPage() {
  const dispatch = useAppDispatch();
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

  // State
  const [pledges, setPledges] = useState([]);
  const [selectedPledge, setSelectedPledge] = useState(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [termsHtml, setTermsHtml] = useState("");
  const [previewType, setPreviewType] = useState("");
  const [previewFormat, setPreviewFormat] = useState("text");
  const [searchQuery, setSearchQuery] = useState("");
  const [copyType, setCopyType] = useState("customer");
  const [testResults, setTestResults] = useState([]);
  const [showTerms, setShowTerms] = useState(false);
  const [bulkTermsCount, setBulkTermsCount] = useState(10);
  const [prePrintedCount, setPrePrintedCount] = useState(5);
  const [prePrintedPage, setPrePrintedPage] = useState("both");
  const [prePrintedA4Count, setPrePrintedA4Count] = useState(5);
  const [prePrintedA4Page, setPrePrintedA4Page] = useState("both");

  useEffect(() => {
    fetchPledges();
  }, []);

  const fetchPledges = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const response = await fetch(
        `${apiUrl}/pledges?per_page=20&sort=-created_at`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch pledges");
      const data = await response.json();
      const pledgeList = data.data?.data || data.data || [];
      setPledges(pledgeList);
      if (pledgeList.length > 0 && !selectedPledge)
        setSelectedPledge(pledgeList[0]);
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Failed to load pledges",
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  const logResult = (type, success, message, duration) => {
    setTestResults((prev) => [
      {
        id: Date.now(),
        type,
        success,
        message,
        duration,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 9),
    ]);
  };

  // Test Dot Matrix Print - HANDLES BOTH HTML AND TEXT
  const testDotMatrixPrint = async (
    copy = copyType,
    openWindow = true,
    mode = "wizard",
  ) => {
    if (!selectedPledge) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please select a pledge first",
        }),
      );
      return;
    }

    setPrinting(true);
    setPreviewType(`Receipt - ${copy} copy`);
    const startTime = Date.now();

    try {
      const token = getToken();
      const response = await fetch(
        `${apiUrl}/print/dot-matrix/pledge-receipt/${selectedPledge.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ copy_type: copy }),
        },
      );

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to generate receipt");
      }

      const receiptContent = data.data?.receipt_text || "";
      const termsContent = data.data?.terms_text || "";
      const format = data.data?.format || "text";

      // Detect HTML format
      const isHtml =
        format === "html" ||
        receiptContent.includes("<!DOCTYPE") ||
        receiptContent.includes("<div class=");

      if (isHtml) {
        setPreviewHtml(receiptContent);
        setTermsHtml(termsContent);
        setPreviewFormat("html");
        setPreviewText("");
        logResult("Styled Receipt", true, `${copy} copy (HTML)`, duration);
      } else {
        setPreviewText(receiptContent);
        setPreviewHtml("");
        setTermsHtml("");
        setPreviewFormat("text");
        logResult("Plain Text", true, `${copy} copy`, duration);
      }

      if (openWindow && receiptContent) {
        if (isHtml) {
          if (mode === "standard") {
            openStandardPrintWindow(
              receiptContent,
              termsContent,
              selectedPledge.pledge_no,
            );
          } else {
            openStyledPrintWindow(
              receiptContent,
              termsContent,
              selectedPledge.pledge_no,
            );
          }
        } else {
          openPlainTextPrintWindow(
            receiptContent,
            `Dot Matrix - ${selectedPledge.pledge_no}`,
          );
        }
      }

      dispatch(
        addToast({
          type: "success",
          title: "Success",
          message: `Receipt generated (${duration}ms)`,
        }),
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      logResult("Receipt", false, error.message, duration);
      setPreviewText(`ERROR: ${error.message}`);
      setPreviewFormat("text");
      dispatch(
        addToast({
          type: "error",
          title: "Print Error",
          message: error.message,
        }),
      );
    } finally {
      setPrinting(false);
    }
  };

  // Open STANDARD HTML print window (Old/Direct Print behavior)
  const openStandardPrintWindow = (receiptHtml, termsHtml, pledgeNo) => {
    const printWindow = window.open("", "_blank", "width=950,height=800");
    if (!printWindow) {
      dispatch(
        addToast({
          type: "error",
          title: "Popup Blocked",
          message: "Please allow popups",
        }),
      );
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${pledgeNo}</title>
        <style>
          @page { size: A5; margin: 0; }
          @media print {
            .no-print { display: none !important; }
            .page-break { page-break-after: always; break-after: page; }
          }
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          .no-print { padding: 20px; text-align: center; background: #f0f0f0; border-bottom: 1px solid #ccc; }
          .print-btn { padding: 10px 20px; font-size: 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="no-print">
          <button class="print-btn" onclick="window.print()">🖨️ Print All Pages</button>
        </div>
        <div class="page-break">${receiptHtml}</div>
        <div>${termsHtml}</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  // Open STYLED HTML print window - FRONT PAGE ONLY (Terms are pre-printed)
  const openStyledPrintWindow = (receiptHtml, termsHtml, pledgeNo) => {
    const printWindow = window.open("", "_blank", "width=950,height=800");
    if (!printWindow) {
      dispatch(
        addToast({
          type: "error",
          title: "Popup Blocked",
          message: "Please allow popups",
        }),
      );
      return;
    }

    const copyLabel =
      copyType === "office" ? "SALINAN PEJABAT" : "SALINAN PELANGGAN";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Resit Pajak Gadai - ${pledgeNo}</title>
        <style>
          @page { size: A5; margin: 0; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-controls { display: none !important; }
            .preview-container.hidden-for-print { display: none !important; }
            .page-label { display: none !important; }
          }
          
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; background: #1f2937; font-family: Arial, sans-serif; min-height: 100vh; }
          
          .print-controls {
            background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
            padding: 20px; 
            margin: 10px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            text-align: center;
          }
          .print-controls h2 { color: white; margin: 0 0 10px 0; font-size: 16px; }
          .print-controls p { color: rgba(255,255,255,0.7); margin: 5px 0; font-size: 12px; }
          
          .btn-row { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; margin-top: 15px; }
          .print-btn {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #fff; border: none; padding: 14px 30px; font-size: 15px;
            cursor: pointer; border-radius: 8px; font-weight: bold;
            display: flex; align-items: center; gap: 8px;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .print-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16,185,129,0.4); }
          .print-btn.secondary {
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          }
          .close-btn {
            background: #6b7280; color: white; border: none; padding: 14px 20px;
            font-size: 14px; cursor: pointer; border-radius: 8px;
          }
          
          .info-note {
            background: rgba(16, 185, 129, 0.2);
            border: 1px solid rgba(16, 185, 129, 0.5);
            border-radius: 8px;
            padding: 10px 15px;
            margin-top: 12px;
            color: #a7f3d0;
            font-size: 12px;
          }
          
          .printer-note { font-size: 11px; color: #9ca3af; margin-top: 12px; text-align: center; }
          .printer-note strong { color: #fbbf24; }
          
          .preview-container {
            max-width: 210mm; margin: 15px auto; background: white;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden;
          }
          .preview-container.hidden-for-print { display: none; }
          .page-label {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white; padding: 10px 15px; font-size: 12px; font-weight: bold;
            display: flex; justify-content: space-between; align-items: center;
          }
          .page-label.terms { background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); }
          .page-label .badge { background: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 10px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="print-controls">
          <h2>📄 Cetak Resit DEPAN Sahaja / Print FRONT Only</h2>
          <p>Kertas dengan Terma & Syarat sudah dicetak sebelum ini</p>
          <p>Paper with Terms & Conditions already pre-printed</p>
          
          <div class="btn-row">
            <button class="print-btn" onclick="printFront()">
              🖨️ Cetak DEPAN / Print FRONT
            </button>
            ${termsHtml
        ? `
            <button class="print-btn secondary" onclick="toggleTerms()">
              📋 Tunjuk Terma / Show Terms
            </button>
            `
        : ""
      }
            <button class="close-btn" onclick="window.close()">✕ Tutup / Close</button>
          </div>
          
          <div class="info-note">
            💡 <strong>Tip:</strong> Gunakan kertas yang sudah dicetak Terma & Syarat di belakang.
            <br>Use paper already printed with Terms & Conditions on the back.
          </div>
          
          <p class="printer-note">
            Printer: <strong>Epson LQ-310</strong> | Kertas: <strong>A5 Landscape</strong> | Salinan: <strong>${copyLabel}</strong>
          </p>
        </div>
        
        <div class="preview-container" id="frontPage">
          <div class="page-label">
            <span>📄 HALAMAN DEPAN / FRONT - RESIT PAJAK GADAI</span>
            <span class="badge">${copyLabel}</span>
          </div>
          ${receiptHtml}
        </div>
        
        ${termsHtml
        ? `
        <div class="preview-container hidden-for-print" id="backPage">
          <div class="page-label terms">
            <span>📋 HALAMAN BELAKANG / BACK - TERMA & SYARAT (Tersembunyi / Hidden)</span>
            <span class="badge">${copyLabel}</span>
          </div>
          ${termsHtml}
        </div>
        `
        : ""
      }
        
        <script>
          function printFront() {
            document.getElementById('frontPage').classList.remove('hidden-for-print');
            if (document.getElementById('backPage')) {
              document.getElementById('backPage').classList.add('hidden-for-print');
            }
            window.print();
          }
          
          function toggleTerms() {
            const backPage = document.getElementById('backPage');
            if (backPage) {
              backPage.classList.toggle('hidden-for-print');
              const btn = event.target;
              if (backPage.classList.contains('hidden-for-print')) {
                btn.textContent = '📋 Tunjuk Terma / Show Terms';
              } else {
                btn.textContent = '📋 Sembunyi Terma / Hide Terms';
              }
            }
          }
          
          window.onload = function() { 
            document.querySelector('.print-btn').focus(); 
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  // Open PLAIN TEXT print window
  const openPlainTextPrintWindow = (text, title) => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      dispatch(
        addToast({
          type: "error",
          title: "Popup Blocked",
          message: "Please allow popups",
        }),
      );
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          @page { size: A5; margin: 0; }
          @media print { html, body { width: 210mm; height: 148mm; margin: 0; padding: 0; } .print-controls { display: none !important; } }
          @media screen { body { max-width: 210mm; margin: 20px auto; padding: 20px; background: #f0f0f0; } .receipt-container { background: white; padding: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border: 1px solid #ccc; } }
          body { font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.3; }
          .receipt-container { white-space: pre; font-size: 11px; }
          .print-controls { text-align: center; padding: 15px; margin-bottom: 15px; background: #1f2937; border-radius: 8px; }
          .print-btn { background: #d97706; color: white; border: none; padding: 12px 30px; font-size: 14px; cursor: pointer; border-radius: 5px; font-weight: bold; }
          .close-btn { background: #6b7280; color: white; border: none; padding: 12px 20px; font-size: 14px; cursor: pointer; border-radius: 5px; margin-left: 10px; }
          .printer-note { font-size: 12px; color: #9ca3af; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="print-controls">
          <button class="print-btn" onclick="window.print()">🖨️ Cetak / Print</button>
          <button class="close-btn" onclick="window.close()">✕ Tutup / Close</button>
          <p class="printer-note">Pilih printer: <strong>Epson LQ-310</strong> | Saiz kertas: <strong>A5 Landscape</strong></p>
        </div>
        <div class="receipt-container">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  // Test PDF Print
  const testPDFPrint = async () => {
    if (!selectedPledge) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please select a pledge first",
        }),
      );
      return;
    }

    setPrinting(true);
    setPreviewType("PDF Receipt");
    const startTime = Date.now();

    try {
      const token = getToken();
      const response = await fetch(
        `${apiUrl}/print/pledge-receipt/${selectedPledge.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/pdf",
          },
          body: JSON.stringify({ copy_type: copyType }),
        },
      );

      const duration = Date.now() - startTime;
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");

      logResult(
        "PDF",
        true,
        `PDF (${(blob.size / 1024).toFixed(1)}KB)`,
        duration,
      );
      setPreviewText(
        `PDF generated!\nSize: ${(blob.size / 1024).toFixed(1)} KB`,
      );
      setPreviewFormat("text");
      dispatch(
        addToast({
          type: "success",
          title: "Success",
          message: `PDF generated (${duration}ms)`,
        }),
      );
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      const duration = Date.now() - startTime;
      logResult("PDF", false, error.message, duration);
      dispatch(
        addToast({ type: "error", title: "PDF Error", message: error.message }),
      );
    } finally {
      setPrinting(false);
    }
  };

  // Test Barcode Print
  const testBarcodePrint = async () => {
    if (!selectedPledge) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please select a pledge first",
        }),
      );
      return;
    }

    setPrinting(true);
    setPreviewType("Barcode Labels");
    const startTime = Date.now();

    try {
      const token = getToken();
      const pledgeResponse = await fetch(
        `${apiUrl}/pledges/${selectedPledge.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (!pledgeResponse.ok) throw new Error("Failed to fetch pledge details");

      const pledgeData = await pledgeResponse.json();
      const items =
        pledgeData.data?.pledge?.items || pledgeData.data?.items || [];
      if (items.length === 0) throw new Error("No items found");

      const barcodeResponse = await fetch(`${apiUrl}/print/barcodes/batch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ item_ids: items.map((item) => item.id) }),
      });

      const duration = Date.now() - startTime;
      if (!barcodeResponse.ok) throw new Error("Failed to generate barcodes");

      const barcodeData = await barcodeResponse.json();
      const barcodes = barcodeData.data || [];

      logResult("Barcode", true, `${barcodes.length} label(s)`, duration);
      setPreviewText(
        `Barcodes: ${barcodes.length}\n\n${barcodes.map((b, i) => `${i + 1}. ${b.barcode}`).join("\n")}`,
      );
      setPreviewFormat("text");

      if (barcodes.length > 0)
        openBarcodeWindow(barcodes, selectedPledge.pledge_no);
      dispatch(
        addToast({
          type: "success",
          title: "Success",
          message: `${barcodes.length} barcode(s) (${duration}ms)`,
        }),
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      logResult("Barcode", false, error.message, duration);
      dispatch(
        addToast({
          type: "error",
          title: "Barcode Error",
          message: error.message,
        }),
      );
    } finally {
      setPrinting(false);
    }
  };

  // FIXED: Open barcode window with DYNAMIC paper sizing
  const openBarcodeWindow = (barcodeItems, pledgeNo) => {
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) {
      dispatch(
        addToast({
          type: "error",
          title: "Popup Blocked",
          message: "Please allow popups",
        }),
      );
      return;
    }

    const labelCount = barcodeItems.length;

    const barcodeLabels = barcodeItems
      .map(
        (item) => `
      <div class="label">
        <div class="header-row">
          <span class="pledge-no">${pledgeNo || item.pledge_no || ""}</span>
          <span class="category">${item.category || "Item"}</span>
        </div>
        <div class="barcode-section">
          ${item.image ? `<img class="barcode-img" src="${item.image}" alt="barcode" onerror="this.style.display='none'" />` : ""}
          <div class="barcode-text">${item.barcode || item.item_code || "N/A"}</div>
        </div>
        <div class="footer-row">${item.purity || "916"} • ${item.net_weight ? parseFloat(item.net_weight).toFixed(2) + "g" : ""}</div>
      </div>
    `,
      )
      .join("");

    printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Barcode Labels - ${pledgeNo || "Test"}</title>
      <style>
        @page { 
          size: 50mm 50mm; 
          margin: 0; 
        }
        @media print {
          html, body {
            width: 50mm !important;
            height: 50mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .controls { display: none !important; }
          .labels-wrapper { 
            width: 50mm !important; 
            margin: 0 !important;
            box-shadow: none !important;
          }
          .label {
            page-break-after: always;
            page-break-inside: avoid;
          }
          .label:last-child {
            page-break-after: avoid;
          }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: Arial, sans-serif; 
          margin: 0; 
          padding: 0; 
          background: #f5f5f5;
        }
        .controls { 
          text-align: center; 
          padding: 15px; 
          background: linear-gradient(135deg, #1f2937 0%, #374151 100%); 
          margin-bottom: 15px;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
          border-radius: 8px;
        }
        .controls button { 
          background: linear-gradient(135deg, #d97706 0%, #b45309 100%); 
          color: white; 
          border: none; 
          padding: 12px 25px; 
          cursor: pointer; 
          border-radius: 8px; 
          margin: 0 5px; 
          font-weight: bold;
          font-size: 14px;
        }
        .controls button.close { background: #6b7280; }
        .controls .info { color: #9ca3af; font-size: 11px; margin-top: 10px; }
        .controls .info strong { color: #fbbf24; }
        .labels-wrapper { 
          width: 50mm; 
          margin: 0 auto; 
          background: white; 
          box-shadow: 0 2px 10px rgba(0,0,0,0.2); 
        }
        .label { 
          width: 50mm; 
          height: 50mm;
          padding: 4mm 3mm; 
          background: white; 
          display: flex; 
          flex-direction: column; 
          overflow: hidden; 
          border-bottom: 1px dashed #ccc;
        }
        .label:last-child { border-bottom: none; }
        .header-row { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          border-bottom: 0.3mm solid #333; 
          padding-bottom: 1mm; 
          margin-bottom: 1mm; 
        }
        .pledge-no { font-size: 8pt; font-weight: bold; }
        .category { font-size: 7pt; font-weight: 600; text-transform: uppercase; color: #333; }
        .barcode-section { 
          flex: 1; 
          text-align: center; 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: center;
          padding: 1mm 0;
        }
        .barcode-img { 
          width: 44mm; 
          height: 18mm; 
          object-fit: contain; 
        }
        .barcode-text { 
          font-family: 'Courier New', monospace; 
          font-size: 9pt; 
          margin-top: 1mm; 
          font-weight: bold; 
          letter-spacing: 0.5px; 
        }
        .footer-row { 
          border-top: 0.3mm solid #333; 
          padding-top: 1mm; 
          font-size: 8pt; 
          font-weight: bold; 
          text-align: center; 
        }
        @media screen { 
          body { padding: 20px; } 
        }
      </style>
    </head>
    <body>
      <div class="controls">
        <button onclick="window.print()">🏷️ Print ${labelCount} Label${labelCount > 1 ? "s" : ""}</button>
        <button class="close" onclick="window.close()">✕ Close</button>
        <p class="info">Label Size: <strong>50mm × 50mm</strong> | Labels: <strong>${labelCount}</strong></p>
        <p class="info" style="margin-top:5px;">⚠️ Set Scale to <strong>100%</strong> (not Fit to Page)</p>
      </div>
      <div class="labels-wrapper">${barcodeLabels}</div>
      <script>window.onload = function() { document.querySelector('button').focus(); }</script>
    </body>
    </html>
  `);

    printWindow.document.close();
    printWindow.focus();
  };

  // Print bulk Terms & Conditions pages
  const printBulkTerms = async () => {
    setPrinting(true);
    setPreviewType("Bulk Terms Pages");
    const startTime = Date.now();

    try {
      const token = getToken();
      const response = await fetch(`${apiUrl}/print/dot-matrix/bulk-terms`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ count: bulkTermsCount }),
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to generate terms pages");
      }

      const termsContent = data.data?.terms_html || "";
      const count = data.data?.count || bulkTermsCount;

      logResult("Bulk Terms", true, `${count} page(s)`, duration);

      // Open print window with bulk terms
      openBulkTermsPrintWindow(termsContent, count);

      dispatch(
        addToast({
          type: "success",
          title: "Success",
          message: `${count} terms pages ready to print (${duration}ms)`,
        }),
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      logResult("Bulk Terms", false, error.message, duration);
      dispatch(
        addToast({
          type: "error",
          title: "Print Error",
          message: error.message,
        }),
      );
    } finally {
      setPrinting(false);
    }
  };

  // Open bulk terms print window
  const openBulkTermsPrintWindow = (termsHtml, count) => {
    const printWindow = window.open("", "_blank", "width=950,height=800");
    if (!printWindow) {
      dispatch(
        addToast({
          type: "error",
          title: "Popup Blocked",
          message: "Please allow popups",
        }),
      );
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Bulk Terms & Conditions - ${count} Pages</title>
        <style>
          @page { size: A5; margin: 0; }
          @media print {
            body { margin: 0; padding: 0; }
            .print-controls, .preview-label { display: none !important; }
            .preview-container { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; background: transparent !important; }
          }
          
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; background: #1f2937; font-family: Arial, sans-serif; }
          
          .print-controls {
            background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
            padding: 20px; 
            margin: 10px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            text-align: center;
          }
          .print-controls h2 { color: white; margin: 0 0 10px 0; font-size: 18px; }
          .print-controls p { color: rgba(255,255,255,0.8); margin: 5px 0; font-size: 13px; }
          
          .btn-row { display: flex; justify-content: center; gap: 10px; margin-top: 15px; }
          .print-btn {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: #fff; border: none; padding: 14px 30px; font-size: 15px;
            cursor: pointer; border-radius: 8px; font-weight: bold;
            display: flex; align-items: center; gap: 8px;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .print-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16,185,129,0.4); }
          .close-btn {
            background: #6b7280; color: white; border: none; padding: 14px 20px;
            font-size: 14px; cursor: pointer; border-radius: 8px;
          }
          
          .info-box {
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 12px;
            margin-top: 15px;
          }
          .info-box p { color: #fde68a; margin: 3px 0; font-size: 12px; }
          .info-box strong { color: #fbbf24; }
          
          .preview-container {
            max-width: 210mm; margin: 15px auto; background: white;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden;
          }
          .preview-label {
            background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
            color: white; padding: 10px 15px; font-size: 12px; font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="print-controls">
          <h2>📋 Bulk Terms & Conditions</h2>
          <p>${count} pages ready to print</p>
          <p>Pre-print these pages, then use them as receipt paper (front side only)</p>
          
          <div class="btn-row">
            <button class="print-btn" onclick="window.print()">
              🖨️ Print All ${count} Pages
            </button>
            <button class="close-btn" onclick="window.close()">✕ Close</button>
          </div>
          
          <div class="info-box">
            <p>📌 <strong>Workflow:</strong></p>
            <p>1. Print these ${count} Terms & Conditions pages</p>
            <p>2. Use as pre-printed paper stock</p>
            <p>3. When creating pledges, print only the FRONT (receipt) page</p>
            <p>4. No flipping required - saves time!</p>
          </div>
        </div>
        
        <div class="preview-container">
          <div class="preview-label">📋 PREVIEW - ${count} TERMA & SYARAT PAGES</div>
          ${termsHtml}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  // Print Pre-Printed Form (Blank Template)
  const printPrePrintedForm = async () => {
    setPrinting(true);
    setPreviewType("Pre-Printed Form");
    const startTime = Date.now();

    try {
      const token = getToken();
      const response = await fetch(
        `${apiUrl}/print/dot-matrix/pre-printed-form`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            count: prePrintedCount,
            page: prePrintedPage,
          }),
        },
      );

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to generate pre-printed form");
      }

      const frontHtml = data.data?.front_html || "";
      const backHtml = data.data?.back_html || "";
      const count = data.data?.count || prePrintedCount;
      const page = data.data?.page || prePrintedPage;

      logResult(
        "Pre-Printed Form",
        true,
        `${count} page(s) - ${page}`,
        duration,
      );

      // Open print window with pre-printed form
      openPrePrintedFormWindow(frontHtml, backHtml, count, page);

      dispatch(
        addToast({
          type: "success",
          title: "Success",
          message: `${count} pre-printed form(s) ready (${duration}ms)`,
        }),
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      logResult("Pre-Printed Form", false, error.message, duration);
      dispatch(
        addToast({
          type: "error",
          title: "Print Error",
          message: error.message,
        }),
      );
    } finally {
      setPrinting(false);
    }
  };

  // Open pre-printed form print window
  const openPrePrintedFormWindow = (frontHtml, backHtml, count, page) => {
    const printWindow = window.open("", "_blank", "width=950,height=800");
    if (!printWindow) {
      dispatch(
        addToast({
          type: "error",
          title: "Popup Blocked",
          message: "Please allow popups",
        }),
      );
      return;
    }

    const hasFront = frontHtml && frontHtml.length > 0;
    const hasBack = backHtml && backHtml.length > 0;
    const pageLabel =
      page === "front"
        ? "FRONT Only"
        : page === "back"
          ? "BACK Only"
          : "FRONT + BACK";

    // Count total pages for display
    const frontPages = hasFront ? count : 0;
    const backPages = hasBack ? count : 0;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ms">
      <head>
        <meta charset="UTF-8">
        <title>Pre-Printed Form - ${count} sets (${pageLabel})</title>
        <style>
          /* Control Panel Styles */
          body { background: #c8c8c8; margin: 0; padding: 20px; font-family: Arial, sans-serif; }
          .ctrl {
            text-align: center; padding: 16px 20px; background: #1a1a2e; margin-bottom: 20px;
            border-radius: 10px; position: sticky; top: 0; z-index: 100;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          }
          .ctrl h2 { color: #10b981; margin: 0 0 8px 0; font-size: 18px; }
          .ctrl p { color: #9ca3af; margin: 4px 0; font-size: 13px; }
          .ctrl .highlight { color: #fbbf24; font-weight: bold; }
          
          .btn-row { display: flex; justify-content: center; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
          .ctrl button {
            padding: 12px 24px; font-size: 14px; cursor: pointer; border: none;
            border-radius: 8px; font-weight: bold; transition: all 0.2s;
          }
          .ctrl .pr { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #000; }
          .ctrl .pr:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(245,158,11,0.4); }
          .ctrl .front-btn { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: #fff; }
          .ctrl .back-btn { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: #fff; }
          .ctrl .cl { background: #4b5563; color: #fff; }
          
          .plabel {
            text-align: center; font-size: 12px; color: #374151;
            margin: 20px 0 8px; font-weight: bold; letter-spacing: 1px;
          }
          .pw {
            max-width: 210mm; margin: 0 auto 25px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            border-radius: 4px; overflow: hidden;
          }

          /* Print Styles */
          @page { size: 210mm 148mm; margin: 0; }
          @media print {
            body { background: #fff !important; padding: 0 !important; margin: 0 !important; }
            .ctrl, .plabel { display: none !important; }
            .pw { box-shadow: none !important; max-width: none !important; margin: 0 !important; border-radius: 0 !important; }
          }
        </style>
      </head>
      <body>
        <div class="ctrl">
          <h2>📝 Pre-Printed Blank Form / Borang Kosong Pra-Cetak</h2>
          <p><span class="highlight">${count} set(s)</span> — ${pageLabel}</p>
          <p>Print these blank forms on white A5 paper for future use</p>
          
          <div class="btn-row">
            ${hasFront && hasBack ? `<button class="pr" onclick="printAll()">🖨️ Print All (${frontPages + backPages} pages)</button>` : ""}
            ${hasFront ? `<button class="front-btn" onclick="printFront()">📄 Print FRONT (${frontPages} pages)</button>` : ""}
            ${hasBack ? `<button class="back-btn" onclick="printBack()">📋 Print BACK (${backPages} pages)</button>` : ""}
            <button class="cl" onclick="window.close()">✕ Close</button>
          </div>
        </div>

        ${hasFront
        ? `
        <div class="plabel">📄 PREVIEW - FRONT / DEPAN (${frontPages} pages)</div>
        <div class="pw" id="frontSection">${frontHtml}</div>
        `
        : ""
      }
        
        ${hasBack
        ? `
        <div class="plabel" id="backLabel">📋 PREVIEW - BACK / BELAKANG (${backPages} pages)</div>
        <div class="pw" id="backSection">${backHtml}</div>
        `
        : ""
      }

        <script>
          function printAll() {
            document.querySelectorAll('#frontSection, #backSection').forEach(el => { if(el) el.style.display = 'block'; });
            window.print();
          }
          function printFront() {
            const front = document.getElementById('frontSection');
            const back = document.getElementById('backSection');
            const backLbl = document.getElementById('backLabel');
            if(front) front.style.display = 'block';
            if(back) back.style.display = 'none';
            if(backLbl) backLbl.style.display = 'none';
            window.print();
            if(back) back.style.display = 'block';
            if(backLbl) backLbl.style.display = 'block';
          }
          function printBack() {
            const front = document.getElementById('frontSection');
            const back = document.getElementById('backSection');
            const frontLabels = document.querySelectorAll('.plabel');
            if(front) front.style.display = 'none';
            if(back) back.style.display = 'block';
            window.print();
            if(front) front.style.display = 'block';
          }
          window.onload = function() {
            const btn = document.querySelector('.pr') || document.querySelector('.front-btn') || document.querySelector('.back-btn');
            if(btn) btn.focus();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  // Print Pre-Printed Form A4 (Blank Template)
  const printPrePrintedFormA4 = async () => {
    setPrinting(true);
    setPreviewType("Pre-Printed Form A4");
    const startTime = Date.now();

    try {
      const token = getToken();
      const response = await fetch(
        `${apiUrl}/print/dot-matrix/pre-printed-form-a4`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            count: prePrintedA4Count,
            page: prePrintedA4Page,
          }),
        },
      );

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to generate A4 pre-printed form");
      }

      const frontHtml = data.data?.front_html || "";
      const backHtml = data.data?.back_html || "";
      const count = data.data?.count || prePrintedA4Count;
      const page = data.data?.page || prePrintedA4Page;

      logResult(
        "Pre-Printed Form A4",
        true,
        `${count} page(s) - ${page}`,
        duration,
      );

      // Open print window with A4 pre-printed form
      openPrePrintedFormWindowA4(frontHtml, backHtml, count, page);

      dispatch(
        addToast({
          type: "success",
          title: "Success",
          message: `${count} A4 pre-printed form(s) ready (${duration}ms)`,
        }),
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      logResult("Pre-Printed Form A4", false, error.message, duration);
      dispatch(
        addToast({
          type: "error",
          title: "Print Error",
          message: error.message,
        }),
      );
    } finally {
      setPrinting(false);
    }
  };

  // Open A4 pre-printed form print window
  const openPrePrintedFormWindowA4 = (frontHtml, backHtml, count, page) => {
    const printWindow = window.open("", "_blank", "width=1050,height=900");
    if (!printWindow) {
      dispatch(
        addToast({
          type: "error",
          title: "Popup Blocked",
          message: "Please allow popups",
        }),
      );
      return;
    }

    const hasFront = frontHtml && frontHtml.length > 0;
    const hasBack = backHtml && backHtml.length > 0;
    const pageLabel =
      page === "front"
        ? "FRONT Only"
        : page === "back"
          ? "BACK Only"
          : "FRONT + BACK";

    const frontPages = hasFront ? count : 0;
    const backPages = hasBack ? count : 0;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ms">
      <head>
        <meta charset="UTF-8">
        <title>Pre-Printed Form A4 - ${count} sets (${pageLabel})</title>
        <style>
          /* Control Panel Styles */
          body { background: #c8c8c8; margin: 0; padding: 20px; font-family: Arial, sans-serif; }
          .ctrl {
            text-align: center; padding: 16px 20px; background: #1a1a2e; margin-bottom: 20px;
            border-radius: 10px; position: sticky; top: 0; z-index: 100;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          }
          .ctrl h2 { color: #f59e0b; margin: 0 0 8px 0; font-size: 18px; }
          .ctrl p { color: #9ca3af; margin: 4px 0; font-size: 13px; }
          .ctrl .highlight { color: #fbbf24; font-weight: bold; }
          
          .btn-row { display: flex; justify-content: center; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
          .ctrl button {
            padding: 12px 24px; font-size: 14px; cursor: pointer; border: none;
            border-radius: 8px; font-weight: bold; transition: all 0.2s;
          }
          .ctrl .pr { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #000; }
          .ctrl .pr:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(245,158,11,0.4); }
          .ctrl .front-btn { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: #fff; }
          .ctrl .back-btn { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: #fff; }
          .ctrl .cl { background: #4b5563; color: #fff; }
          
          .plabel {
            text-align: center; font-size: 12px; color: #374151;
            margin: 20px 0 8px; font-weight: bold; letter-spacing: 1px;
          }
          .pw {
            max-width: 241.3mm; margin: 0 auto 25px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            border-radius: 4px; overflow: hidden;
          }

          /* Print Styles - 9.5in x 11in */
          @page { size: 241.3mm 279.4mm; margin: 0; }
          @media print {
            body { background: #fff !important; padding: 0 !important; margin: 0 !important; }
            .ctrl, .plabel { display: none !important; }
            .pw { box-shadow: none !important; max-width: none !important; margin: 0 !important; border-radius: 0 !important; }
          }
        </style>
      </head>
      <body>
        <div class="ctrl">
          <h2>📝 Pre-Printed Blank Form (9½" × 11") / Borang Kosong Pra-Cetak</h2>
          <p><span class="highlight">${count} set(s)</span> — ${pageLabel}</p>
          <p>Print these blank forms on 9½" × 11" paper for future use</p>
          
          <div class="btn-row">
            ${hasFront && hasBack ? `<button class="pr" onclick="printAll()">🖨️ Print All (${frontPages + backPages} pages)</button>` : ""}
            ${hasFront ? `<button class="front-btn" onclick="printFront()">📄 Print FRONT (${frontPages} pages)</button>` : ""}
            ${hasBack ? `<button class="back-btn" onclick="printBack()">📋 Print BACK (${backPages} pages)</button>` : ""}
            <button class="cl" onclick="window.close()">✕ Close</button>
          </div>
        </div>

        ${hasFront
        ? `
        <div class="plabel">📄 PREVIEW - FRONT / DEPAN (${frontPages} pages)</div>
        <div class="pw" id="frontSection">${frontHtml}</div>
        `
        : ""
      }
        
        ${hasBack
        ? `
        <div class="plabel" id="backLabel">📋 PREVIEW - BACK / BELAKANG (${backPages} pages)</div>
        <div class="pw" id="backSection">${backHtml}</div>
        `
        : ""
      }

        <script>
          function printAll() {
            document.querySelectorAll('#frontSection, #backSection').forEach(el => { if(el) el.style.display = 'block'; });
            window.print();
          }
          function printFront() {
            const front = document.getElementById('frontSection');
            const back = document.getElementById('backSection');
            const backLbl = document.getElementById('backLabel');
            if(front) front.style.display = 'block';
            if(back) back.style.display = 'none';
            if(backLbl) backLbl.style.display = 'none';
            window.print();
            if(back) back.style.display = 'block';
            if(backLbl) backLbl.style.display = 'block';
          }
          function printBack() {
            const front = document.getElementById('frontSection');
            const back = document.getElementById('backSection');
            if(front) front.style.display = 'none';
            if(back) back.style.display = 'block';
            window.print();
            if(front) front.style.display = 'block';
          }
          window.onload = function() {
            const btn = document.querySelector('.pr') || document.querySelector('.front-btn') || document.querySelector('.back-btn');
            if(btn) btn.focus();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  // Test Data Overlay - Preview data alignment on pre-printed form
  const testDataOverlay = async () => {
    if (!selectedPledge) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please select a pledge first",
        }),
      );
      return;
    }

    setPrinting(true);
    const startTime = Date.now();

    try {
      const token = getToken();

      // Fetch BOTH blank form AND data overlay
      const [formResponse, dataResponse] = await Promise.all([
        fetch(`${apiUrl}/print/dot-matrix/pre-printed-form`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ count: 1, page: "front" }),
        }),
        fetch(
          `${apiUrl}/print/dot-matrix/pre-printed/pledge/${selectedPledge.id}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          },
        ),
      ]);

      const formData = await formResponse.json();
      const dataData = await dataResponse.json();
      const duration = Date.now() - startTime;

      if (!formResponse.ok || !formData.success) {
        throw new Error(formData.message || "Failed to load blank form");
      }
      if (!dataResponse.ok || !dataData.success) {
        throw new Error(dataData.message || "Failed to generate overlay");
      }

      const formHtml = formData.data?.front_html || "";
      const dataHtml = dataData.data?.front_html || "";

      // Open preview with BOTH layers
      const previewWindow = window.open("", "_blank", "width=1000,height=800");
      if (!previewWindow) {
        dispatch(
          addToast({
            type: "error",
            title: "Popup Blocked",
            message: "Please allow popups",
          }),
        );
        return;
      }

      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Data Overlay Alignment Test - ${selectedPledge.pledge_no}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: #1a1a2e; padding: 20px; font-family: Arial, sans-serif; }
            h1 { color: #fff; text-align: center; margin-bottom: 15px; font-size: 20px; }
            h1 span { color: #4ade80; }
            .controls { text-align: center; margin-bottom: 15px; display: flex; justify-content: center; gap: 10px; }
            .controls button { padding: 10px 20px; cursor: pointer; border: none; border-radius: 6px; font-weight: bold; font-size: 14px; }
            .btn-form { background: #3b82f6; color: white; }
            .btn-data { background: #f59e0b; color: white; }
            .btn-print { background: #ef4444; color: white; }
            .btn-close { background: #6b7280; color: white; }
            .container { position: relative; width: 210mm; height: 148mm; margin: 0 auto; background: white; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
            .form-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; opacity: 0.5; pointer-events: none; }
            .form-layer.hidden { display: none; }
            .data-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10; }
            .data-layer.hidden { display: none; }
            .status { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 10px; }
            .status span { display: inline-block; padding: 3px 8px; border-radius: 4px; margin: 0 5px; }
            .status .on { background: #22c55e; color: white; }
            .status .off { background: #ef4444; color: white; }
            @media print {
              body { background: white !important; padding: 0 !important; }
              .controls, h1, .status { display: none !important; }
              .container { box-shadow: none !important; }
              .form-layer { display: none !important; }
              .data-layer { position: relative !important; }
            }
          </style>
        </head>
        <body>
          <h1>📊 <span>Data Overlay</span> Alignment Test</h1>
          <div class="controls">
            <button class="btn-form" onclick="toggleForm()">Toggle Form Background</button>
            <button class="btn-data" onclick="toggleData()">Toggle Data Layer</button>
            <button class="btn-print" onclick="window.print()">Print Data Only</button>
            <button class="btn-close" onclick="window.close()">Close</button>
          </div>
          <div class="status">
            Form: <span id="formStatus" class="on">ON</span>
            Data: <span id="dataStatus" class="on">ON</span>
          </div>
          <div class="container">
            <div id="formLayer" class="form-layer">${formHtml}</div>
            <div id="dataLayer" class="data-layer">${dataHtml}</div>
          </div>
          <script>
            let formVisible = true;
            let dataVisible = true;
            
            function toggleForm() {
              formVisible = !formVisible;
              document.getElementById('formLayer').classList.toggle('hidden');
              document.getElementById('formStatus').className = formVisible ? 'on' : 'off';
              document.getElementById('formStatus').textContent = formVisible ? 'ON' : 'OFF';
            }
            
            function toggleData() {
              dataVisible = !dataVisible;
              document.getElementById('dataLayer').classList.toggle('hidden');
              document.getElementById('dataStatus').className = dataVisible ? 'on' : 'off';
              document.getElementById('dataStatus').textContent = dataVisible ? 'ON' : 'OFF';
            }
          </script>
        </body>
        </html>
      `);
      previewWindow.document.close();

      logResult(
        "Data Overlay",
        true,
        `Alignment test for ${selectedPledge.pledge_no}`,
        duration,
      );

      dispatch(
        addToast({
          type: "success",
          title: "Success",
          message: `Overlay test ready (${duration}ms)`,
        }),
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      logResult("Data Overlay", false, error.message, duration);
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.message,
        }),
      );
    } finally {
      setPrinting(false);
    }
  };

  // Print Pre-Printed Data Overlay (prints ONLY data on pre-printed carbonless forms)
  const printPrePrintedOverlay = async () => {
    if (!selectedPledge) {
      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: "Please select a pledge first",
        }),
      );
      return;
    }

    setPrinting(true);
    setPreviewType("Pre-Printed Overlay");
    const startTime = Date.now();

    try {
      const token = getToken();
      const response = await fetch(
        `${apiUrl}/print/dot-matrix/pre-printed/pledge/${selectedPledge.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to generate overlay");
      }

      const frontHtml = data.data?.front_html || "";
      const pledgeNo = data.data?.pledge_no || selectedPledge.pledge_no;

      logResult(
        "Pre-Printed Overlay",
        true,
        `Data overlay for ${pledgeNo}`,
        duration,
      );

      // Open overlay test window
      openPrePrintedOverlayWindow(frontHtml, pledgeNo);

      dispatch(
        addToast({
          type: "success",
          title: "Success",
          message: `Overlay ready (${duration}ms)`,
        }),
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      logResult("Pre-Printed Overlay", false, error.message, duration);
      dispatch(
        addToast({
          type: "error",
          title: "Print Error",
          message: error.message,
        }),
      );
    } finally {
      setPrinting(false);
    }
  };

  // Open Pre-Printed Overlay Test Window (shows data over form for alignment check)
  const openPrePrintedOverlayWindow = (dataHtml, pledgeNo) => {
    const printWindow = window.open("", "_blank", "width=950,height=800");
    if (!printWindow) {
      dispatch(
        addToast({
          type: "error",
          title: "Popup Blocked",
          message: "Please allow popups",
        }),
      );
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Pre-Printed Overlay Test - ${pledgeNo}</title>
        <style>
          body { background: #444; padding: 20px; margin: 0; font-family: Arial, sans-serif; }
          .ctrl {
            text-align: center; padding: 16px 20px; background: #1a1a2e; margin-bottom: 20px;
            border-radius: 10px; position: sticky; top: 0; z-index: 100;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          }
          .ctrl h2 { color: #10b981; margin: 0 0 8px 0; font-size: 18px; }
          .ctrl p { color: #9ca3af; margin: 4px 0; font-size: 13px; }
          .ctrl .highlight { color: #fbbf24; font-weight: bold; }
          .btn-row { display: flex; justify-content: center; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
          .ctrl button {
            padding: 12px 24px; font-size: 14px; cursor: pointer; border: none;
            border-radius: 8px; font-weight: bold; transition: all 0.2s;
          }
          .btn-form { background: #3b82f6; color: #fff; }
          .btn-data { background: #ef4444; color: #fff; }
          .btn-both { background: #10b981; color: #fff; }
          .btn-print { background: #f59e0b; color: #000; }
          .btn-close { background: #6b7280; color: #fff; }
          .ctrl button:hover { transform: translateY(-2px); }
          .preview-container {
            position: relative; width: 210mm; margin: 20px auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5); background: #fff;
          }
          .form-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
          .form-layer.semi { opacity: 0.3; }
          .data-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; }
          .hidden { display: none !important; }
          /* Pre-printed form styles */
          .pp-front { width: 210mm; padding: 3mm 5mm; font-family: Arial, sans-serif; color: #1a4a7a; background: #fff !important; overflow: hidden; box-sizing: border-box; }
          .pp-front * { box-sizing: border-box; margin: 0; padding: 0; }
          .pp-hdr { display: flex; align-items: flex-start; padding-bottom: 1.5mm; border-bottom: 1px solid #1a4a7a; }
          .pp-hdr-left { flex: 1; display: flex; align-items: flex-start; gap: 2mm; }
          .pp-co-info { flex: 1; }
          .pp-co-name { font-size: 26px; font-weight: bold; color: #1a4a7a; line-height: 1.1; }
          .pp-co-multi { font-size: 1.5rem; font-weight: bold; color: #1a4a7a; margin-top: 0.5mm; }
          .pp-co-addr { font-size: 8px; color: #1a4a7a; margin-top: 0.5mm; }
          .pp-hdr-right { display: flex; flex-direction: column; align-items: flex-end; min-width: 50mm; }
          .pp-top-row { display: flex; align-items: center; gap: 1.5mm; margin-bottom: 0.5mm; }
          .pp-phone-box { background: #d42027; color: #fff; padding: 1.5mm 2.5mm; border-radius: 3px; display: flex; align-items: center; gap: 1mm; }
          .pp-phone-icon { font-size: 11px; color: #d42027; background: #fff; border-radius: 50%; width: 4.5mm; height: 4.5mm; display: flex; align-items: center; justify-content: center; }
          .pp-phone-nums { font-size: 9px; font-weight: bold; line-height: 1.3; }
          .pp-sejak { background: #d42027; color: #fff; width: 11mm; height: 11mm; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
          .pp-sejak-lbl { font-size: 5px; font-weight: bold; }
          .pp-sejak-yr { font-size: 9px; font-weight: bold; }
          .pp-hrs-box { background: #f5c518; color: #000; padding: 1mm 2mm; width: 50mm; }
          .pp-hrs-title { font-size: 10px; font-weight: bold; text-align: center; }
          .pp-hrs-line { font-size: 6.5px; font-weight: bold; line-height: 1.3; }
          .pp-mid { display: flex; border: 1px solid #1a4a7a; }
          .pp-items-sec { flex: 1; padding: 1.5mm 2mm; border-right: 1px solid #1a4a7a; }
          .pp-items-title { font-size: 8px; font-weight: bold; text-decoration: underline; margin-bottom: 1mm; }
          .pp-items-area { min-height: 28mm; padding-left: 2mm; }
          .pp-rcol { width: 50mm; min-width: 50mm; }
          .pp-tkt-box { background: #f5c518; padding: 1.5mm; border-bottom: 1px solid #1a4a7a; }
          .pp-tkt-lbl { font-size: 8px; font-weight: bold; color: #000; }
          .pp-tkt-space { min-height: 10mm; }
          .pp-rate-row { display: flex; border-bottom: 1px solid #1a4a7a; }
          .pp-rate-cell { flex: 1; padding: 1.5mm; text-align: center; }
          .pp-rate-cell:first-child { border-right: 1px solid #1a4a7a; }
          .pp-rate-lbl { font-size: 6px; font-weight: bold; color: #1a4a7a; }
          .pp-rate-val { font-size: 10px; font-weight: bold; color: #1a4a7a; }
          .pp-rate-big { font-size: 13px; }
          .pp-kadar { padding: 1.5mm 2mm; }
          .pp-kadar-title { font-size: 7px; font-weight: bold; color: #1a4a7a; text-align: center; }
          .pp-kadar-ln { font-size: 6px; color: #1a4a7a; line-height: 1.5; }
          .pp-cust-title-row { display: flex; font-size: 8px; font-weight: bold; padding: 1mm 0; margin-top: 1mm; }
          .pp-cust-title-left { flex: 1; text-decoration: underline; }
          .pp-cust-title-divider { width: 1px; background: #1a4a7a; margin: 0 2mm; }
          .pp-cust-title-right { width: 50mm; }
          .pp-cust-box { border: 1px solid #d42027; padding: 2mm 3mm; min-height: 32mm; }
          .pp-cust-row { display: flex; align-items: baseline; margin-bottom: 3mm; font-size: 10px; font-weight: bold; }
          .pp-cust-row:last-child { margin-bottom: 0; }
          .pp-cust-lbl { white-space: nowrap; min-width: 20mm; }
          .pp-cust-lbl-s { white-space: nowrap; margin-left: 3mm; }
          .pp-cust-sp { flex: 1; min-height: 5mm; }
          .pp-cust-sp-s { width: 18mm; min-height: 5mm; }
          .pp-amt-row { border: 1px solid #d42027; border-bottom: none; padding: 1.5mm 3mm; display: flex; align-items: baseline; gap: 2mm; }
          .pp-amt-lbl { font-size: 10px; font-weight: bold; }
          .pp-bot { display: flex; border: 2px solid #d42027; }
          .pp-pin-cell { flex: 1; padding: 1.5mm 3mm; display: flex; align-items: baseline; gap: 1.5mm; border-right: 2px solid #d42027; }
          .pp-pin-lbl { font-size: 9px; }
          .pp-pin-rm { font-size: 12px; font-weight: bold; }
          .pp-pin-sp { flex: 1; min-height: 6mm; }
          .pp-pin-stars { font-size: 12px; font-weight: bold; }
          .pp-dt-cell { width: 27mm; text-align: center; padding: 1.5mm; border-right: 2px solid #d42027; }
          .pp-dt-cell:last-child { border-right: none; }
          .pp-dt-lbl { font-size: 7px; font-weight: bold; }
          .pp-dt-sp { min-height: 6mm; }
          .pp-dt-yel { background: #f5c518; }
          .pp-ftr { font-size: 6px; line-height: 1.4; margin-top: 1mm; display: flex; justify-content: space-between; align-items: flex-end; }
          .pp-ftr-left { flex: 1; }
          .pp-ftr-right { text-align: right; font-size: 5px; }
          .pp-gm-box { display: inline-block; text-align: center; font-size: 6px; line-height: 1.2; min-width: 8mm; vertical-align: top; }
          @page { size: 210mm 74mm; margin: 0; }
          @media print {
            html, body { width: 210mm; height: 74mm; margin: 0 !important; padding: 0 !important; overflow: hidden !important; }
            .ctrl { display: none !important; }
            .preview-container { width: 210mm !important; height: 74mm !important; margin: 0 !important; box-shadow: none !important; overflow: hidden !important; }
            .form-layer { display: none !important; }
            .data-layer { position: absolute; top: 0; left: 0; width: 100%; height: 74mm; }
          }
        </style>
      </head>
      <body>
        <div class="ctrl">
          <h2>🔀 Pre-Printed Overlay Test - ${pledgeNo}</h2>
          <p>Check if data aligns with pre-printed form fields</p>
          <p class="highlight">⚠️ Adjust CSS positions in controller if misaligned</p>
          <div class="btn-row">
            <button class="btn-form" onclick="showForm()">📄 Form Only</button>
            <button class="btn-data" onclick="showData()">📝 Data Only</button>
            <button class="btn-both" onclick="showBoth()">🔀 Both Layers</button>
            <button class="btn-print" onclick="window.print()">🖨️ Print Data Only</button>
            <button class="btn-close" onclick="window.close()">✕ Close</button>
          </div>
        </div>
        <div class="preview-container">
          <div class="form-layer semi" id="formLayer">
            <div class="pp-front">
              <div class="pp-hdr">
                <div class="pp-hdr-left">
                  <div class="pp-co-info">
                    <div class="pp-co-name">PAJAK GADAI SDN BHD</div>
                    <div class="pp-co-multi">新泰當 அடகு கடை</div>
                    <div class="pp-co-addr">123 Jalan Utama, 55100 Kuala Lumpur.</div>
                  </div>
                </div>
                <div class="pp-hdr-right">
                  <div class="pp-top-row">
                    <div class="pp-phone-box"><span class="pp-phone-icon">☎</span><div class="pp-phone-nums">03-12345678</div></div>
                    <div class="pp-sejak"><span class="pp-sejak-lbl">SEJAK</span><span class="pp-sejak-yr">1966</span></div>
                  </div>
                  <div class="pp-hrs-box"><div class="pp-hrs-title">BUKA 7 HARI</div><div class="pp-hrs-line">ISNIN - AHAD : 8.30AM - 6.00PM</div></div>
                </div>
              </div>
              <div class="pp-mid">
                <div class="pp-items-sec"><div class="pp-items-title">Perihal terperinci artikel yang digadai:-</div><div class="pp-items-area"></div></div>
                <div class="pp-rcol">
                  <div class="pp-tkt-box"><div class="pp-tkt-lbl">NO. TIKET:</div><div class="pp-tkt-space"></div></div>
                  <div class="pp-rate-row">
                    <div class="pp-rate-cell"><div class="pp-rate-lbl">CAJ PENGENDALIAN</div><div class="pp-rate-val">50 SEN</div></div>
                    <div class="pp-rate-cell"><div class="pp-rate-lbl">TEMPOH TAMAT</div><div class="pp-rate-val pp-rate-big">6 BULAN</div></div>
                  </div>
                  <div class="pp-kadar"><div class="pp-kadar-title">KADAR KEUNTUNGAN BULANAN</div><div class="pp-kadar-ln">1.5% Sebulan : Dalam tempoh 6 bulan</div><div class="pp-kadar-ln">2.0% Sebulan : Lepas tempoh 6 bulan</div></div>
                </div>
              </div>
              <div class="pp-cust-title-row"><span class="pp-cust-title-left">Butir-butir terperinci mengenai pemajak gadai:-</span><span class="pp-cust-title-divider"></span><span class="pp-cust-title-right">Catatan :</span></div>
              <div class="pp-cust-box">
                <div class="pp-cust-row"><span class="pp-cust-lbl">No. Kad :<br>Pengenalan</span><span class="pp-cust-sp"></span></div>
                <div class="pp-cust-row"><span class="pp-cust-lbl">Nama :</span><span class="pp-cust-sp"></span></div>
                <div class="pp-cust-row"><span class="pp-cust-lbl">Kerakyatan :</span><span class="pp-cust-sp-s"></span><span class="pp-cust-lbl-s">Tahun Lahir :</span><span class="pp-cust-sp-s"></span><span class="pp-cust-lbl-s">Jantina :</span><span class="pp-cust-sp-s"></span></div>
                <div class="pp-cust-row"><span class="pp-cust-lbl">Alamat :</span><span class="pp-cust-sp"></span></div>
              </div>
              <div class="pp-amt-row"><span class="pp-amt-lbl">Amaun</span></div>
              <div class="pp-bot">
                <div class="pp-pin-cell"><span class="pp-pin-lbl">Pinjaman</span><span class="pp-pin-rm">RM</span><span class="pp-pin-sp"></span><span class="pp-pin-stars">***</span></div>
                <div class="pp-dt-cell"><div class="pp-dt-lbl">Tarikh Dipajak</div><div class="pp-dt-sp"></div></div>
                <div class="pp-dt-cell pp-dt-yel"><div class="pp-dt-lbl">Tarikh Cukup Tempoh</div><div class="pp-dt-sp"></div></div>
              </div>
              <div class="pp-ftr"><div class="pp-ftr-left"><div>Anda diminta memeriksa barang gadaian dan butir-butir di atas dengan teliti.</div></div><div class="pp-ftr-right">Berat : <div class="pp-gm-box">(gm)</div></div></div>
            </div>
          </div>
          <div class="data-layer" id="dataLayer">${dataHtml}</div>
        </div>
        <script>
          function showForm() {
            document.getElementById('formLayer').classList.remove('hidden', 'semi');
            document.getElementById('dataLayer').classList.add('hidden');
          }
          function showData() {
            document.getElementById('formLayer').classList.add('hidden');
            document.getElementById('dataLayer').classList.remove('hidden');
          }
          function showBoth() {
            document.getElementById('formLayer').classList.remove('hidden');
            document.getElementById('formLayer').classList.add('semi');
            document.getElementById('dataLayer').classList.remove('hidden');
          }
          showBoth();
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  // Test Renewal Document View - fetches latest renewal and shows data on form
  const testRenewalDocument = async () => {
    setPrinting(true);
    setPreviewType("Renewal Document");
    const startTime = Date.now();

    try {
      const token = getToken();

      // Step 1: Fetch latest renewals
      const renewalsRes = await fetch(
        `${apiUrl}/renewals?per_page=10&sort=-created_at`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (!renewalsRes.ok) throw new Error("Failed to fetch renewals");
      const renewalsData = await renewalsRes.json();
      const renewalsList = renewalsData.data?.data || renewalsData.data || [];

      if (renewalsList.length === 0) {
        throw new Error("No renewals found. Create a renewal first to test.");
      }

      const renewal = renewalsList[0];
      const renewalId = renewal.id;

      // Step 2: Call the pre-printed with-form renewal endpoint
      const docRes = await fetch(
        `${apiUrl}/print/dot-matrix/pre-printed-with-form/renewal/${renewalId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      const data = await docRes.json();
      const duration = Date.now() - startTime;

      if (!docRes.ok || !data.success) {
        throw new Error(data.message || "Failed to generate renewal document");
      }

      const frontHtml = data.data?.front_html || "";
      const renewalNo =
        data.data?.renewal_no || renewal.renewal_no || "Unknown";

      logResult(
        "Renewal Document",
        true,
        `Document for ${renewalNo}`,
        duration,
      );

      // Open in document view window (same as pledge document view)
      const printWindow = window.open("", "_blank");
      if (!printWindow) throw new Error("Popup blocked");

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Renewal Document - ${renewalNo}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', Courier, monospace; background: #f5f5f5; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 20px; }
            .print-container { width: 210mm; max-width: 210mm; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); margin: 0; padding: 0; overflow: hidden; }
            .print-actions { width: 100%; max-width: 210mm; text-align: center; padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; }
            .print-btn { background: #28a745; color: white; border: none; padding: 10px 30px; font-size: 16px; border-radius: 4px; cursor: pointer; margin: 0 5px; }
            .print-btn:hover { background: #218838; }
            .close-btn { background: #dc3545; }
            .close-btn:hover { background: #c82333; }
            @media print {
              body { background: white; padding: 0; display: block; }
              .print-container { box-shadow: none; margin: 0; }
              .print-actions { display: none; }
            }
            @page { size: A5; margin: 0; }
          </style>
        </head>
        <body>
          <div class="print-actions">
            <p style="margin-bottom: 10px; font-weight: bold; color: #856404;">
              📄 Renewal Document View - ${renewalNo}
            </p>
            <p style="margin-bottom: 15px; font-size: 14px; color: #856404;">
              Data overlay on pre-printed form template (★ SAMBUNGAN banner)
            </p>
            <button class="print-btn" onclick="window.print()">🖨️ Print</button>
            <button class="print-btn close-btn" onclick="window.close()">✖ Close</button>
          </div>
          <div class="print-container">
            ${frontHtml}
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();

      dispatch(
        addToast({
          type: "success",
          title: "Success",
          message: `Renewal document ready (${duration}ms)`,
        }),
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      logResult("Renewal Document", false, error.message, duration);
      dispatch(
        addToast({
          type: "error",
          title: "Renewal Document Error",
          message: error.message,
        }),
      );
    } finally {
      setPrinting(false);
    }
  };

  // Test Redemption Document View - fetches latest redemption and shows data on form
  const testRedemptionDocument = async () => {
    setPrinting(true);
    setPreviewType("Redemption Document");
    const startTime = Date.now();

    try {
      const token = getToken();

      // Step 1: Fetch latest redemptions
      const redemptionsRes = await fetch(
        `${apiUrl}/redemptions?per_page=10&sort=-created_at`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );
      if (!redemptionsRes.ok) throw new Error("Failed to fetch redemptions");
      const redemptionsData = await redemptionsRes.json();
      const redemptionsList =
        redemptionsData.data?.data || redemptionsData.data || [];

      if (redemptionsList.length === 0) {
        throw new Error(
          "No redemptions found. Create a redemption first to test.",
        );
      }

      const redemption = redemptionsList[0];
      const redemptionId = redemption.id;

      // Step 2: Call the pre-printed with-form redemption endpoint
      const docRes = await fetch(
        `${apiUrl}/print/dot-matrix/pre-printed-with-form/redemption/${redemptionId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      const data = await docRes.json();
      const duration = Date.now() - startTime;

      if (!docRes.ok || !data.success) {
        throw new Error(
          data.message || "Failed to generate redemption document",
        );
      }

      const frontHtml = data.data?.front_html || "";
      const redemptionNo =
        data.data?.redemption_no || redemption.redemption_no || "Unknown";

      logResult(
        "Redemption Document",
        true,
        `Document for ${redemptionNo}`,
        duration,
      );

      // Open in document view window (same as pledge document view)
      const printWindow = window.open("", "_blank");
      if (!printWindow) throw new Error("Popup blocked");

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Redemption Document - ${redemptionNo}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', Courier, monospace; background: #f5f5f5; padding: 20px; display: flex; flex-direction: column; align-items: center; gap: 20px; }
            .print-container { width: 210mm; max-width: 210mm; background: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); margin: 0; padding: 0; overflow: hidden; }
            .print-actions { width: 100%; max-width: 210mm; text-align: center; padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; }
            .print-btn { background: #28a745; color: white; border: none; padding: 10px 30px; font-size: 16px; border-radius: 4px; cursor: pointer; margin: 0 5px; }
            .print-btn:hover { background: #218838; }
            .close-btn { background: #dc3545; }
            .close-btn:hover { background: #c82333; }
            @media print {
              body { background: white; padding: 0; display: block; }
              .print-container { box-shadow: none; margin: 0; }
              .print-actions { display: none; }
            }
            @page { size: A5; margin: 0; }
          </style>
        </head>
        <body>
          <div class="print-actions">
            <p style="margin-bottom: 10px; font-weight: bold; color: #856404;">
              📄 Redemption Document View - ${redemptionNo}
            </p>
            <p style="margin-bottom: 15px; font-size: 14px; color: #856404;">
              Data overlay on pre-printed form template (★ TEBUS banner)
            </p>
            <button class="print-btn" onclick="window.print()">🖨️ Print</button>
            <button class="print-btn close-btn" onclick="window.close()">✖ Close</button>
          </div>
          <div class="print-container">
            ${frontHtml}
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();

      dispatch(
        addToast({
          type: "success",
          title: "Success",
          message: `Redemption document ready (${duration}ms)`,
        }),
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      logResult("Redemption Document", false, error.message, duration);
      dispatch(
        addToast({
          type: "error",
          title: "Redemption Document Error",
          message: error.message,
        }),
      );
    } finally {
      setPrinting(false);
    }
  };

  const filteredPledges = pledges.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.pledge_no?.toLowerCase().includes(q) ||
      p.customer?.name?.toLowerCase().includes(q) ||
      p.customer?.ic_number?.includes(q)
    );
  });

  const runAllTests = async () => {
    setTestResults([]);
    dispatch(
      addToast({
        type: "info",
        title: "Running Tests",
        message: "Testing all print functions...",
      }),
    );
    await testDotMatrixPrint("office", false);
    await new Promise((r) => setTimeout(r, 500));
    await testDotMatrixPrint("customer", false);
    await new Promise((r) => setTimeout(r, 500));
    await testPDFPrint();
    await new Promise((r) => setTimeout(r, 500));
    await testBarcodePrint();
    dispatch(
      addToast({
        type: "success",
        title: "Tests Complete",
        message: "All tests finished!",
      }),
    );
  };

  return (
    <PageWrapper
      title="Print Test Center"
      subtitle="Test all print functions with existing pledges"
      icon={TestTube}
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            leftIcon={RefreshCw}
            onClick={fetchPledges}
            loading={loading}
          >
            Refresh
          </Button>
          <Button
            variant="accent"
            leftIcon={TestTube}
            onClick={runAllTests}
            disabled={!selectedPledge || printing}
          >
            Run All Tests
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pledge Selection */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold text-zinc-800 mb-3 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-500" />
              Select Pledge
            </h3>
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={Search}
              className="mb-3"
            />
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                </div>
              ) : filteredPledges.length === 0 ? (
                <p className="text-center text-zinc-500 py-4">
                  No pledges found
                </p>
              ) : (
                filteredPledges.map((pledge) => (
                  <button
                    key={pledge.id}
                    onClick={() => setSelectedPledge(pledge)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left border transition-all",
                      selectedPledge?.id === pledge.id
                        ? "bg-amber-50 border-amber-300 ring-2 ring-amber-200"
                        : "bg-white border-zinc-200 hover:border-zinc-300",
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-zinc-800 text-sm">
                          {pledge.pledge_no}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {pledge.customer?.name || "Unknown"}
                        </p>
                      </div>
                      <Badge
                        variant={
                          pledge.status === "active"
                            ? "success"
                            : pledge.status === "overdue"
                              ? "danger"
                              : "secondary"
                        }
                      >
                        {pledge.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between mt-2 text-xs">
                      <span className="text-zinc-400">
                        {pledge.items_count ?? pledge.items?.length ?? 0}{" "}
                        item(s)
                      </span>
                      <span className="font-medium text-emerald-600">
                        {formatCurrency(pledge.loan_amount)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          {selectedPledge && (
            <Card className="p-4 bg-amber-50 border-amber-200">
              <h4 className="font-semibold text-amber-800 mb-2">
                Selected Pledge
              </h4>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-amber-700">ID:</span>{" "}
                  <span className="font-mono font-bold">
                    {selectedPledge.pledge_no}
                  </span>
                </p>
                <p>
                  <span className="text-amber-700">Customer:</span>{" "}
                  {selectedPledge.customer?.name}
                </p>
                <p>
                  <span className="text-amber-700">Amount:</span>{" "}
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(selectedPledge.loan_amount)}
                  </span>
                </p>
              </div>
            </Card>
          )}
        </div>

        {/* Middle: Print Actions */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
              <Printer className="w-4 h-4 text-amber-500" />
              Print Actions
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                Copy Type
              </label>
              <div className="flex gap-2">
                {["office", "customer"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setCopyType(type)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                      copyType === type
                        ? "bg-amber-500 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                    )}
                  >
                    {type === "office" ? "Office Copy" : "Customer Copy"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {/* Styled Receipt */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-blue-800">Styled Receipt</p>
                    <p className="text-xs text-blue-600">
                      Blue form + Terms page
                    </p>
                  </div>
                  <Badge variant="info">HTML</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* New Manual Duplex Print */}
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={Printer}
                    onClick={() => testDotMatrixPrint(copyType, true, "wizard")}
                    loading={printing && previewType.includes("Receipt")}
                    disabled={!selectedPledge || printing}
                    className="bg-blue-600 hover:bg-blue-700 col-span-2"
                  >
                    Print (Manual Duplex)
                  </Button>

                  {/* Old Standard Print */}
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={Printer}
                    onClick={() =>
                      testDotMatrixPrint(copyType, true, "standard")
                    }
                    disabled={!selectedPledge || printing}
                    className="col-span-1"
                  >
                    Old Print
                  </Button>

                  {/* Preview */}
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={Eye}
                    onClick={() => testDotMatrixPrint(copyType, false)}
                    disabled={!selectedPledge || printing}
                    className="col-span-1"
                  >
                    Preview
                  </Button>
                </div>
              </div>

              {/* PDF */}
              <div className="p-3 bg-zinc-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-zinc-800">PDF Receipt</p>
                    <p className="text-xs text-zinc-500">A5 Portrait</p>
                  </div>
                  <Badge variant="success">PDF</Badge>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={FileText}
                  onClick={testPDFPrint}
                  loading={printing && previewType === "PDF Receipt"}
                  disabled={!selectedPledge || printing}
                  fullWidth
                  className="bg-red-600 hover:bg-red-700"
                >
                  Generate PDF
                </Button>
              </div>

              {/* Barcode */}
              <div className="p-3 bg-zinc-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-zinc-800">Barcode Labels</p>
                    <p className="text-xs text-zinc-500">50mm × 50mm</p>
                  </div>
                  <Badge variant="warning">Labels</Badge>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={Barcode}
                  onClick={testBarcodePrint}
                  loading={printing && previewType === "Barcode Labels"}
                  disabled={!selectedPledge || printing}
                  fullWidth
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Print Barcodes
                </Button>
              </div>

              {/* Both Copies */}
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-amber-800">
                      Print Both Copies
                    </p>
                    <p className="text-xs text-amber-600">Office + Customer</p>
                  </div>
                  <Badge variant="accent">2x</Badge>
                </div>
                <Button
                  variant="accent"
                  size="sm"
                  leftIcon={Copy}
                  onClick={async () => {
                    await testDotMatrixPrint("office");
                    setTimeout(() => testDotMatrixPrint("customer"), 1000);
                  }}
                  disabled={!selectedPledge || printing}
                  fullWidth
                >
                  Print Both
                </Button>
              </div>

              {/* Bulk Terms - NEW */}
              <div className="p-3 bg-violet-50 rounded-lg border border-violet-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-violet-800">
                      Bulk Print Terms
                    </p>
                    <p className="text-xs text-violet-600">
                      Pre-print back pages
                    </p>
                  </div>
                  <Badge className="bg-violet-500 text-white">Bulk</Badge>
                </div>
                <div className="flex gap-2 mb-2">
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={bulkTermsCount}
                    onChange={(e) =>
                      setBulkTermsCount(
                        Math.min(
                          50,
                          Math.max(1, parseInt(e.target.value) || 10),
                        ),
                      )
                    }
                    className="w-20 text-center"
                  />
                  <span className="text-sm text-violet-600 self-center">
                    pages
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={FileText}
                  onClick={printBulkTerms}
                  loading={printing && previewType === "Bulk Terms Pages"}
                  disabled={printing}
                  fullWidth
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  Print {bulkTermsCount} Terms Pages
                </Button>
                <p className="text-xs text-violet-500 mt-2">
                  💡 Pre-print terms, then print only front page when creating
                  pledges
                </p>
              </div>

              {/* Pre-Printed Form - NEW */}
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-emerald-800">
                      Pre-Printed Blank Form A5
                    </p>
                    <p className="text-xs text-emerald-600">
                      A5 blank form template
                    </p>
                  </div>
                  <Badge className="bg-emerald-500 text-white">New</Badge>
                </div>
                <div className="flex gap-2 mb-2">
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={prePrintedCount}
                    onChange={(e) =>
                      setPrePrintedCount(
                        Math.min(
                          50,
                          Math.max(1, parseInt(e.target.value) || 5),
                        ),
                      )
                    }
                    className="w-16 text-center"
                  />
                  <select
                    value={prePrintedPage}
                    onChange={(e) => setPrePrintedPage(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-emerald-300 rounded-lg bg-white text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="both">Front + Back</option>
                    <option value="front">Front Only</option>
                    <option value="back">Back Only</option>
                  </select>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={FileText}
                  onClick={printPrePrintedForm}
                  loading={printing && previewType === "Pre-Printed Form"}
                  disabled={printing}
                  fullWidth
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Print {prePrintedCount} Blank Form(s)
                </Button>
                <p className="text-xs text-emerald-500 mt-2">
                  📝 Blank forms with all labels, borders & styling - no
                  customer data
                </p>
              </div>

              {/* Pre-Printed Form A4 - NEW */}
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-300">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-amber-800">
                      Pre-Printed Blank Form A4
                    </p>
                    <p className="text-xs text-amber-600">
                      A4 blank form template
                    </p>
                  </div>
                  <Badge className="bg-amber-500 text-white">A4</Badge>
                </div>
                <div className="flex gap-2 mb-2">
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={prePrintedA4Count}
                    onChange={(e) =>
                      setPrePrintedA4Count(
                        Math.min(
                          50,
                          Math.max(1, parseInt(e.target.value) || 5),
                        ),
                      )
                    }
                    className="w-16 text-center"
                  />
                  <select
                    value={prePrintedA4Page}
                    onChange={(e) => setPrePrintedA4Page(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border border-amber-300 rounded-lg bg-white text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="both">Front + Back</option>
                    <option value="front">Front Only</option>
                    <option value="back">Back Only</option>
                  </select>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={FileText}
                  onClick={printPrePrintedFormA4}
                  loading={printing && previewType === "Pre-Printed Form A4"}
                  disabled={printing}
                  fullWidth
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  Print {prePrintedA4Count} A4 Blank Form(s)
                </Button>
                <p className="text-xs text-amber-500 mt-2">
                  📄 A4 blank forms with all labels, borders & styling - no
                  customer data
                </p>
              </div>

              {/* Pre-Printed Data Overlay Test */}
              <div className="p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-cyan-800">
                      Data Overlay Test
                    </p>
                    <p className="text-xs text-cyan-600">
                      Test data alignment on pre-printed form
                    </p>
                  </div>
                  <Badge className="bg-cyan-500 text-white">Test</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={Layers}
                  onClick={() => testDataOverlay()}
                  disabled={!selectedPledge}
                  loading={printing && previewType === "Data Overlay"}
                  fullWidth
                  className="border-cyan-500 text-cyan-700 hover:bg-cyan-100"
                >
                  Preview Data Overlay
                </Button>
                <p className="text-xs text-cyan-500 mt-2">
                  🔍 Toggle layers to check data positioning accuracy
                </p>
              </div>

              {/* Renewal Document View Test */}
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-orange-800">
                      Renewal Document
                    </p>
                    <p className="text-xs text-orange-600">
                      Check renewal data on form
                    </p>
                  </div>
                  <Badge className="bg-orange-500 text-white">Renewal</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={Eye}
                  onClick={testRenewalDocument}
                  loading={printing && previewType === "Renewal Document"}
                  disabled={printing}
                  fullWidth
                  className="border-orange-500 text-orange-700 hover:bg-orange-100"
                >
                  View Renewal on Form
                </Button>
                <p className="text-xs text-orange-500 mt-2">
                  � Shows data on form template — check alignment
                </p>
              </div>

              {/* Redemption Document View Test */}
              <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-rose-800">
                      Redemption Document
                    </p>
                    <p className="text-xs text-rose-600">
                      Check redemption data on form
                    </p>
                  </div>
                  <Badge className="bg-rose-500 text-white">Redeem</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={Eye}
                  onClick={testRedemptionDocument}
                  loading={printing && previewType === "Redemption Document"}
                  disabled={printing}
                  fullWidth
                  className="border-rose-500 text-rose-700 hover:bg-rose-100"
                >
                  View Redemption on Form
                </Button>
                <p className="text-xs text-rose-500 mt-2">
                  📄 Shows data on form template — check alignment
                </p>
              </div>
            </div>
          </Card>

          {/* Test Results */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                Test Results
              </h3>
              {testResults.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={RotateCcw}
                  onClick={() => setTestResults([])}
                >
                  Clear
                </Button>
              )}
            </div>
            {testResults.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-4">
                No tests run yet
              </p>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {testResults.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      "p-2 rounded-lg text-xs flex justify-between",
                      r.success
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {r.success ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <AlertCircle className="w-3 h-3" />
                      )}
                      <span className="font-medium">{r.type}</span>
                      <span className="text-zinc-500">{r.message}</span>
                    </div>
                    <span className="text-zinc-400">{r.duration}ms</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-1">
          <Card className="p-4 h-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-zinc-800 flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-500" />
                Preview
              </h3>
              <div className="flex items-center gap-2">
                {previewFormat === "html" && termsHtml && (
                  <button
                    onClick={() => setShowTerms(!showTerms)}
                    className={cn(
                      "text-xs px-2 py-1 rounded",
                      showTerms
                        ? "bg-purple-100 text-purple-700"
                        : "bg-zinc-100 text-zinc-600",
                    )}
                  >
                    {showTerms ? "📄 Receipt" : "📋 Terms"}
                  </button>
                )}
                {previewType && (
                  <Badge
                    variant={previewFormat === "html" ? "info" : "secondary"}
                  >
                    {previewFormat === "html" ? "HTML" : "Text"}
                  </Badge>
                )}
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg min-h-[500px] max-h-[600px] overflow-auto">
              {previewFormat === "html" && previewHtml ? (
                <div
                  className="p-2 transform scale-[0.45] origin-top-left w-[220%]"
                  dangerouslySetInnerHTML={{
                    __html: showTerms && termsHtml ? termsHtml : previewHtml,
                  }}
                />
              ) : previewText ? (
                <pre className="p-4 text-[10px] font-mono whitespace-pre-wrap text-zinc-700">
                  {previewText}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-400 p-8">
                  <FileText className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Click a print button to preview</p>
                </div>
              )}
            </div>

            {(previewText || previewHtml) && (
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={Copy}
                  onClick={() => {
                    navigator.clipboard.writeText(
                      previewFormat === "html" ? previewHtml : previewText,
                    );
                    dispatch(addToast({ type: "success", title: "Copied" }));
                  }}
                  fullWidth
                >
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={ExternalLink}
                  onClick={() => {
                    previewFormat === "html"
                      ? openStyledPrintWindow(
                        previewHtml,
                        termsHtml,
                        selectedPledge?.pledge_no,
                      )
                      : openPlainTextPrintWindow(previewText, previewType);
                  }}
                  fullWidth
                >
                  Open Window
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
