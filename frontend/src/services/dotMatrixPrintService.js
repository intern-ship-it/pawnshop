/**
 * Dot Matrix Print Service
 * 
 * For Epson LQ-310 and similar 24-pin dot matrix printers
 * Generates plain text receipts optimized for A5 continuous paper
 */

import api from './api';

const dotMatrixPrintService = {
    /**
     * Print pledge receipt to dot matrix printer
     * @param {number} pledgeId - Pledge ID
     * @param {string} copyType - 'office', 'customer', or 'both'
     * @returns {Promise}
     */
    async printPledgeReceipt(pledgeId, copyType = 'customer') {
        try {
            const response = await api.post(`/print/dot-matrix/pledge-receipt/${pledgeId}`, {
                copy_type: copyType,
            });

            if (response.data.success) {
                this.sendToPrinter(response.data.data.receipt_text, `Pledge-${response.data.data.pledge_no}`);
                return { success: true, data: response.data.data };
            }

            return { success: false, error: response.data.message || 'Failed to generate receipt' };
        } catch (error) {
            console.error('Dot matrix print error:', error);
            return {
                success: false,
                error: error.response?.data?.message || error.message || 'Print failed'
            };
        }
    },

    /**
     * Print renewal receipt
     * @param {number} renewalId - Renewal ID
     * @returns {Promise}
     */
    async printRenewalReceipt(renewalId) {
        try {
            const response = await api.post(`/print/dot-matrix/renewal-receipt/${renewalId}`);

            if (response.data.success) {
                this.sendToPrinter(response.data.data.receipt_text, `Renewal-${response.data.data.renewal_no}`);
                return { success: true, data: response.data.data };
            }

            return { success: false, error: response.data.message || 'Failed to generate receipt' };
        } catch (error) {
            console.error('Dot matrix print error:', error);
            return {
                success: false,
                error: error.response?.data?.message || error.message || 'Print failed'
            };
        }
    },

    /**
     * Print redemption receipt
     * @param {number} redemptionId - Redemption ID
     * @returns {Promise}
     */
    async printRedemptionReceipt(redemptionId) {
        try {
            const response = await api.post(`/print/dot-matrix/redemption-receipt/${redemptionId}`);

            if (response.data.success) {
                this.sendToPrinter(response.data.data.receipt_text, `Redemption-${response.data.data.redemption_no}`);
                return { success: true, data: response.data.data };
            }

            return { success: false, error: response.data.message || 'Failed to generate receipt' };
        } catch (error) {
            console.error('Dot matrix print error:', error);
            return {
                success: false,
                error: error.response?.data?.message || error.message || 'Print failed'
            };
        }
    },

    /**
     * Send plain text to printer via browser print dialog
     * Opens a new window with monospace font, optimized for dot matrix
     * 
     * @param {string} text - Plain text receipt content
     * @param {string} title - Document title
     */
    sendToPrinter(text, title = 'Receipt') {
        const printWindow = window.open('', '_blank', 'width=450,height=600');

        if (!printWindow) {
            alert('Popup blocked! Please allow popups for printing.');
            return;
        }

        // A5 paper: 148mm x 210mm
        // At 10 CPI (characters per inch), ~42 characters fit across A5 width
        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: A5 portrait;
            margin: 10mm;
          }
          
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
          }
          
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            line-height: 1.3;
            white-space: pre;
            margin: 10mm;
            padding: 0;
            background: #fff;
            color: #000;
          }
          
          /* Ensure consistent character width */
          pre {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            line-height: 1.3;
            margin: 0;
            padding: 0;
          }
        </style>
      </head>
      <body>
        <pre>${this.escapeHtml(text)}</pre>
        <script>
          // Auto-print after content loads
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
          
          // Close window after printing (optional)
          window.onafterprint = function() {
            // window.close(); // Uncomment to auto-close
          };
        </script>
      </body>
      </html>
    `);

        printWindow.document.close();
    },

    /**
     * Print multiple copies (office + customer)
     * @param {number} pledgeId - Pledge ID
     * @returns {Promise}
     */
    async printBothCopies(pledgeId) {
        // First print office copy
        const officeResult = await this.printPledgeReceipt(pledgeId, 'office');
        if (!officeResult.success) {
            return officeResult;
        }

        // Wait a bit then print customer copy
        return new Promise((resolve) => {
            setTimeout(async () => {
                const customerResult = await this.printPledgeReceipt(pledgeId, 'customer');
                resolve(customerResult);
            }, 2000); // 2 second delay between prints
        });
    },

    /**
     * Escape HTML special characters
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Preview receipt without printing (for testing)
     * @param {string} text - Receipt text
     * @param {string} title - Window title
     */
    preview(text, title = 'Receipt Preview') {
        const previewWindow = window.open('', '_blank', 'width=500,height=700');

        if (!previewWindow) {
            alert('Popup blocked!');
            return;
        }

        previewWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            line-height: 1.4;
            white-space: pre;
            padding: 20px;
            background: #f5f5f5;
            margin: 0;
          }
          .receipt-paper {
            background: #fff;
            padding: 20px;
            max-width: 400px;
            margin: 0 auto;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border: 1px solid #ddd;
          }
          .actions {
            text-align: center;
            padding: 15px;
            background: #333;
            margin-bottom: 20px;
          }
          .actions button {
            background: #f59e0b;
            color: #fff;
            border: none;
            padding: 10px 25px;
            font-size: 14px;
            cursor: pointer;
            border-radius: 5px;
            margin: 0 5px;
          }
          .actions button:hover {
            background: #d97706;
          }
        </style>
      </head>
      <body>
        <div class="actions">
          <button onclick="window.print()">🖨️ Print</button>
          <button onclick="window.close()">✕ Close</button>
        </div>
        <div class="receipt-paper">
          <pre>${this.escapeHtml(text)}</pre>
        </div>
      </body>
      </html>
    `);

        previewWindow.document.close();
    },
};

export default dotMatrixPrintService;