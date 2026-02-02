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
  const testDotMatrixPrint = async (copy = copyType, openWindow = true) => {
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
          openStyledPrintWindow(
            receiptContent,
            termsContent,
            selectedPledge.pledge_no,
          );
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

  // Open STYLED HTML print window - MANUAL DUPLEX for Epson LQ-310
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
          @page { size: A5 landscape; margin: 3mm; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .print-controls, .step-indicator, .flip-instructions { display: none !important; }
            .preview-container { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
            .page-label { display: none !important; }
            .preview-container.hidden-for-print { display: none !important; }
          }
          
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; background: #1f2937; font-family: Arial, sans-serif; min-height: 100vh; }
          
          .print-controls {
            background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
            padding: 20px; 
            margin: 10px;
            border-radius: 12px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          }
          .step-indicator {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-bottom: 15px;
          }
          .step {
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 13px;
            transition: all 0.3s;
          }
          .step.active { background: #f59e0b; color: #000; }
          .step.completed { background: #10b981; color: #fff; }
          .step.pending { background: #4b5563; color: #9ca3af; }
          
          .btn-row { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
          .print-btn {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: #000; border: none; padding: 14px 30px; font-size: 15px;
            cursor: pointer; border-radius: 8px; font-weight: bold;
            display: flex; align-items: center; gap: 8px;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .print-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(245,158,11,0.4); }
          .print-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
          .print-btn.green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; }
          .close-btn {
            background: #6b7280; color: white; border: none; padding: 14px 20px;
            font-size: 14px; cursor: pointer; border-radius: 8px;
          }
          
          .flip-instructions {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 2px solid #f59e0b;
            border-radius: 10px;
            padding: 15px 20px;
            margin: 15px 0;
            text-align: center;
          }
          .flip-instructions h3 { color: #92400e; margin: 0 0 8px 0; font-size: 16px; }
          .flip-instructions p { color: #78350f; margin: 5px 0; font-size: 13px; }
          .flip-instructions .icon { font-size: 28px; }
          
          .printer-note { font-size: 11px; color: #9ca3af; margin-top: 12px; text-align: center; }
          .printer-note strong { color: #fbbf24; }
          
          .preview-container {
            max-width: 210mm; margin: 15px auto; background: white;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden;
          }
          .preview-container.hidden-for-print { opacity: 0.3; pointer-events: none; }
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
          <div class="step-indicator">
            <div class="step active" id="step1-indicator">① DEPAN / FRONT</div>
            <div class="step pending" id="step2-indicator">② BELAKANG / BACK</div>
          </div>
          
          <div class="btn-row">
            <button class="print-btn" id="printFrontBtn" onclick="printFront()">
              🖨️ Cetak DEPAN / Print FRONT
            </button>
            <button class="print-btn green" id="printBackBtn" onclick="printBack()" disabled>
              🔄 Cetak BELAKANG / Print BACK
            </button>
            <button class="close-btn" onclick="window.close()">✕ Tutup / Close</button>
          </div>
          
          <div class="flip-instructions" id="flipInstructions" style="display: none;">
            <div class="icon">🔄📄</div>
            <h3>PUSING KERTAS / FLIP PAPER</h3>
            <p>1. Keluarkan kertas dari printer / Remove paper from printer</p>
            <p>2. <strong>Pusing kertas</strong> dan masukkan semula / <strong>Flip paper</strong> and reinsert</p>
            <p>3. Klik butang hijau untuk cetak belakang / Click green button to print back</p>
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
        
        ${
          termsHtml
            ? `
        <div class="preview-container hidden-for-print" id="backPage">
          <div class="page-label terms">
            <span>📋 HALAMAN BELAKANG / BACK - TERMA & SYARAT</span>
            <span class="badge">${copyLabel}</span>
          </div>
          ${termsHtml}
        </div>
        `
            : ""
        }
        
        <script>
          let currentStep = 1;
          
          function printFront() {
            document.getElementById('frontPage').classList.remove('hidden-for-print');
            if (document.getElementById('backPage')) {
              document.getElementById('backPage').classList.add('hidden-for-print');
            }
            
            window.print();
            
            setTimeout(function() {
              currentStep = 2;
              document.getElementById('step1-indicator').classList.remove('active');
              document.getElementById('step1-indicator').classList.add('completed');
              document.getElementById('step1-indicator').textContent = '✓ DEPAN / FRONT';
              document.getElementById('step2-indicator').classList.remove('pending');
              document.getElementById('step2-indicator').classList.add('active');
              document.getElementById('printFrontBtn').disabled = true;
              document.getElementById('printBackBtn').disabled = false;
              document.getElementById('flipInstructions').style.display = 'block';
              
              document.getElementById('frontPage').classList.add('hidden-for-print');
              if (document.getElementById('backPage')) {
                document.getElementById('backPage').classList.remove('hidden-for-print');
              }
            }, 1000);
          }
          
          function printBack() {
            document.getElementById('frontPage').classList.add('hidden-for-print');
            if (document.getElementById('backPage')) {
              document.getElementById('backPage').classList.remove('hidden-for-print');
            }
            
            window.print();
            
            setTimeout(function() {
              document.getElementById('step2-indicator').classList.remove('active');
              document.getElementById('step2-indicator').classList.add('completed');
              document.getElementById('step2-indicator').textContent = '✓ BELAKANG / BACK';
              document.getElementById('printBackBtn').disabled = true;
              document.getElementById('flipInstructions').innerHTML = '<div class="icon">✅</div><h3>SELESAI / COMPLETE</h3><p>Kedua-dua halaman telah dicetak / Both pages have been printed</p>';
            }, 1000);
          }
          
          window.onload = function() { 
            document.getElementById('printFrontBtn').focus(); 
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
          @page { size: A5 landscape; margin: 5mm 8mm; }
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
        <div class="footer-row">${item.purity || "916"} • ${item.net_weight ? parseFloat(item.net_weight).toFixed(3) + "g" : ""}</div>
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
          size: 50mm auto; 
          margin: 0; 
        }
        @media print {
          html, body {
            width: 50mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .controls { display: none !important; }
          .labels-wrapper { 
            width: 50mm !important; 
            margin: 0 !important;
            box-shadow: none !important;
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
          max-width: 350px;
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
          min-height: 30mm;
          padding: 2mm 3mm; 
          background: white; 
          display: flex; 
          flex-direction: column; 
          overflow: hidden; 
          border-bottom: 1px dashed #ccc;
          page-break-inside: avoid;
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
        .pledge-no { font-size: 9pt; font-weight: bold; }
        .category { font-size: 8pt; font-weight: 600; text-transform: uppercase; color: #333; }
        .barcode-section { 
          flex: 1; 
          text-align: center; 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: center;
          padding: 2mm 0;
        }
        .barcode-img { 
          width: 42mm; 
          height: 12mm; 
          object-fit: contain; 
        }
        .barcode-text { 
          font-family: 'Courier New', monospace; 
          font-size: 8pt; 
          margin-top: 1mm; 
          font-weight: bold; 
          letter-spacing: 0.5px; 
        }
        .footer-row { 
          border-top: 0.3mm solid #333; 
          padding-top: 1mm; 
          font-size: 9pt; 
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
        <p class="info">Printer: <strong>Thermal 58mm</strong> | Labels: <strong>${labelCount}</strong></p>
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
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={Printer}
                    onClick={() => testDotMatrixPrint(copyType)}
                    loading={printing && previewType.includes("Receipt")}
                    disabled={!selectedPledge || printing}
                    fullWidth
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Print
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={Eye}
                    onClick={() => testDotMatrixPrint(copyType, false)}
                    disabled={!selectedPledge || printing}
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
                    <p className="text-xs text-zinc-500">
                      50mm × Dynamic height
                    </p>
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
