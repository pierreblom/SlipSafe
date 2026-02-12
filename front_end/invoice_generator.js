
// --- INVOICE GENERATION ---

// Default Template
const defaultInvoiceTemplate = {
    id: "general-v1",
    name: "General Clean",
    styles: {
        fontFamily: "'Inter', 'Helvetica', 'Arial', sans-serif",
        primaryColor: "#1e293b",
        accentColor: "#0f172a",
        borderColor: "#cbd5e1",
        backgroundColor: "#ffffff",
        textColor: "#334155"
    },
    labels: {
        header: "SALES INVOICE",
        billTo: "Bill To",
        paymentDetails: "Payment Details",
        notes: "Notes",
        dateIssued: "Date Issued",
        dueDate: "Due Date",
        totalDue: "Total Due"
    },
    layout: {
        showLogo: false,
        showBankDetails: true
    }
};

/**
 * Generates the Invoice DOM element without attaching it to the document.
 * @returns {HTMLElement} The invoice container element
 */
function generateInvoiceDOM(invoice, client, items, template = defaultInvoiceTemplate) {
    // Get company details
    const company = currentUser?.user_metadata || {};
    const companyName = company.business_name || 'My Business';
    const companyAddress = company.address || 'Address Line 1\nCity, Country';
    const companyPhone = company.phone || '';
    const companyEmail = currentUser?.email || 'email@example.com';
    const vatNumber = company.vat_number || '';

    // Banking Details
    const bankName = company.bank_name || 'FNB';
    const accountHolder = company.account_holder || companyName;
    const accountNumber = company.account_number || '00000000000';
    const branchCode = company.branch_code || '000000';

    // Calculate totals (VAT Inclusive Logic)
    // The total of all items is the Grand Total. We back-calculate VAT from this.
    const grandTotal = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);

    let subtotal, tax, total;

    if (vatNumber) {
        // If registered for VAT, the item prices include VAT.
        // Total = Subtotal * 1.15
        // Subtotal = Total / 1.15
        total = grandTotal;
        subtotal = total / 1.15;
        tax = total - subtotal;
    } else {
        // No VAT, so Total = Subtotal
        total = grandTotal;
        subtotal = grandTotal;
        tax = 0;
    }

    // Helper: Date Formatting
    const formatDate = (dateStr) => {
        if (!dateStr) return new Date().toLocaleDateString('en-GB');
        return new Date(dateStr).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const { styles } = template;

    // Create container
    const invoiceElement = document.createElement('div');
    invoiceElement.className = 'invoice-container';

    // Apply styles to 
    Object.assign(invoiceElement.style, {
        width: '800px', // Fixed width for consistent rendering
        backgroundColor: styles.backgroundColor,
        fontFamily: styles.fontFamily,
        color: styles.textColor,
        lineHeight: '1.4', // Reduced line height slightly
        position: 'relative',
        boxSizing: 'border-box'
    });

    const isQuote = !!invoice.quote_number;
    const headerLabel = isQuote ? "PURCHASE INVOICE" : (template.labels.header || "SALES INVOICE");
    const documentNumber = isQuote ? invoice.quote_number : invoice.invoice_number;

    invoiceElement.innerHTML = `
        <div style="padding: 30px 40px; background: ${styles.backgroundColor};">
            <!-- Top Bar -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                 <div style="flex: 1;">
                    <h1 style="font-size: 32px; font-weight: 800; color: ${styles.primaryColor}; margin: 0; line-height: 1.2;">${headerLabel}</h1>
                    <p style="font-size: 14px; color: #64748b; margin: 4px 0 0 0;">#${documentNumber}</p>
                </div>
                <div style="text-align: right; flex: 1;">
                    <div style="font-size: 24px; font-weight: bold; color: ${styles.primaryColor}; margin-bottom: 5px;">${companyName}</div>
                    <div style="font-size: 13px; color: #64748b; white-space: pre-line; line-height: 1.4;">
                        ${companyAddress}
                        ${companyPhone ? `<br>${companyPhone}` : ''}
                        ${companyEmail ? `<br>${companyEmail}` : ''}
                        ${vatNumber ? `<br>VAT No: ${vatNumber}` : ''}
                    </div>
                </div>
            </div>

            <div style="height: 2px; background-color: ${styles.accentColor}; margin-bottom: 25px; width: 100%;"></div>

            <!-- Bill To & Details Grid -->
            <div style="display: flex; justify-content: space-between; margin-bottom: 30px; gap: 40px;">
                <div style="flex: 1;">
                    <h3 style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0;">${template.labels.billTo}</h3>
                    <h2 style="font-size: 16px; font-weight: 700; color: ${styles.accentColor}; margin: 0 0 4px 0;">${client.name}</h2>
                    <div style="font-size: 13px; color: #475569; white-space: pre-line;">
                        ${client.address || 'No address provided'}
                        ${client.vat_number ? `<br>VAT: ${client.vat_number}` : ''}
                    </div>
                </div>
                <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                     <div>
                        <h3 style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">${template.labels.dateIssued}</h3>
                        <p style="font-size: 14px; color: ${styles.accentColor}; font-weight: 500; margin: 0;">${formatDate(invoice.created_at)}</p>
                    </div>
                    <div>
                        <h3 style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px 0;">${template.labels.dueDate}</h3>
                        <p style="font-size: 14px; color: ${styles.accentColor}; font-weight: 500; margin: 0;">${formatDate(invoice.due_date)}</p>
                    </div>
                </div>
            </div>

            <!-- Items Table -->
            <div style="margin-bottom: 30px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #f8fafc;">
                            <th style="text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 6px 0 0 6px;">Description</th>
                            <th style="text-align: right; padding: 10px 16px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; width: 100px;">Price</th>
                            <th style="text-align: center; padding: 10px 16px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; width: 60px;">Qty</th>
                            <th style="text-align: right; padding: 10px 16px; font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 0 6px 6px 0; width: 120px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, i) => `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 12px 16px; font-size: 13px; color: #334155; font-weight: 500;">${item.description}</td>
                            <td style="padding: 12px 16px; text-align: right; font-size: 13px; color: #475569;">${parseFloat(item.unit_price).toFixed(2)}</td>
                            <td style="padding: 12px 16px; text-align: center; font-size: 13px; color: #475569;">${item.quantity}</td>
                            <td style="padding: 12px 16px; text-align: right; font-size: 13px; color: ${styles.accentColor}; font-weight: 600;">${parseFloat(item.total).toFixed(2)}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Totals Section -->
            <div style="display: flex; justify-content: flex-end;">
                <div style="width: 280px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-size: 13px; font-weight: 600; color: #64748b;">Subtotal (Excl)</span>
                        <span style="font-size: 13px; font-weight: 600; color: #334155;">R ${subtotal.toFixed(2)}</span>
                    </div>
                    ${tax > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="font-size: 13px; font-weight: 600; color: #64748b;">VAT (15%)</span>
                        <span style="font-size: 13px; font-weight: 600; color: #334155;">R ${tax.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div style="height: 1px; background-color: ${styles.borderColor}; margin: 10px 0;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 15px; font-weight: 700; color: ${styles.accentColor};">${template.labels.totalDue}</span>
                        <span style="font-size: 20px; font-weight: 800; color: ${styles.accentColor};">R ${total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <!-- Footer: Bank & Notes -->
            <div style="margin-top: 60px; padding-top: 30px; border-top: 1px dashed ${styles.borderColor}; color: #475569; font-size: 12px;">
                <div style="display: flex; gap: 40px;">
                    <div style="flex: 1;">
                        <h4 style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #334155; margin: 0 0 5px 0;">${template.labels.paymentDetails}</h4>
                        <p style="margin: 0; line-height: 1.6;">
                            Bank: ${bankName}<br>
                            Account: ${accountHolder}<br>
                            Acc No: ${accountNumber}<br>
                            Branch: ${branchCode}
                        </p>
                    </div>
                    <div style="flex: 1;">
                        <h4 style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #334155; margin: 0 0 5px 0;">${template.labels.notes}</h4>
                        <p style="margin: 0; line-height: 1.6;">
                            Please use #${documentNumber} as reference.<br>
                            Thank you for your business!
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Branding Footer -->
            <div style="margin-top: 40px; text-align: center; font-size: 10px; color: ${styles.borderColor};">
                Generated with SlipSafe
            </div>
        </div>
    `;

    return invoiceElement;
}

// Config for PDF generation
async function generateInvoicePDF(invoice, client, items, template = defaultInvoiceTemplate, elementToUse = null) {
    let invoiceElement = elementToUse;
    let isTemporary = false;

    if (!invoiceElement) {
        invoiceElement = generateInvoiceDOM(invoice, client, items, template);
        // Styles for invisible rendering
        Object.assign(invoiceElement.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            zIndex: '-1000',
            visibility: 'visible'
        });
        document.body.appendChild(invoiceElement);
        isTemporary = true;
        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Generate PDF
    const opt = {
        margin: 0,
        filename: `Invoice_${invoice.invoice_number}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 800
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        await html2pdf().set(opt).from(invoiceElement).save();
    } catch (e) {
        console.error("PDF Export Error:", e);
        alert("There was an error generating your PDF. Please try again.");
    } finally {
        // Clean up if we created it
        if (isTemporary && document.body.contains(invoiceElement)) {
            document.body.removeChild(invoiceElement);
        }
    }
}

// Preview Modal Logic
async function showInvoicePreview(invoice, client, items) {
    // 1. Generate the Invoice DOM
    const invoiceDom = generateInvoiceDOM(invoice, client, items);

    // 2. Create Modal Overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto';

    // 3. Create Modal Content
    // Scale wrapper to fit if needed
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-white rounded-2xl shadow-2xl max-w-[900px] w-full max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up transition-all';

    // Header
    const header = document.createElement('div');
    header.className = 'bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center';
    header.innerHTML = `
        <div class="flex items-center gap-2">
            <h3 class="text-lg font-bold text-slate-800">${invoice.quote_number ? 'Purchase Invoice' : 'Sales Invoice'} Preview</h3>
            <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold">READY</span>
        </div>
        <button id="close-preview-btn" class="text-slate-400 hover:text-slate-600 transition p-2 rounded-full hover:bg-slate-100">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
    `;

    // Body (Scrollable Invoice)
    const body = document.createElement('div');
    body.className = 'flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center';

    // Wrapper to ensure center and margin
    const invoiceWrapper = document.createElement('div');
    invoiceWrapper.className = 'shadow-lg bg-white transform-gpu';
    invoiceWrapper.appendChild(invoiceDom);
    body.appendChild(invoiceWrapper);

    // Footer (Actions)
    const footer = document.createElement('div');
    footer.className = 'bg-white border-t border-slate-100 p-4 flex justify-end gap-3';

    // Mark as Paid Button
    if (invoice.status !== 'paid') {
        const paidBtn = document.createElement('button');
        paidBtn.className = 'bg-emerald-100 text-emerald-700 font-bold py-2 px-6 rounded-xl hover:bg-emerald-200 transition flex items-center gap-2';
        paidBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            Mark as Paid
        `;
        paidBtn.onclick = async () => {
            console.log("Mark as Paid clicked for invoice:", invoice.id);
            if (typeof window.markInvoiceAsPaid === 'function') {
                try {
                    await window.markInvoiceAsPaid(invoice.id);
                } catch (e) {
                    console.error("Error invoking markInvoiceAsPaid:", e);
                    alert("Error: " + e.message);
                }
            } else {
                console.error("window.markInvoiceAsPaid is not defined!");
                alert("Functionality not fully loaded. Please refresh the page and try again.");
            }
        };
        footer.appendChild(paidBtn);
    }

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'bg-blue-600 text-white font-bold py-2 px-6 rounded-xl shadow hover:bg-blue-700 transition flex items-center gap-2';
    downloadBtn.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
        Download PDF
    `;

    const doneBtn = document.createElement('button');
    doneBtn.className = 'bg-slate-100 text-slate-600 font-bold py-2 px-6 rounded-xl hover:bg-slate-200 transition';
    doneBtn.innerText = 'Done';

    footer.appendChild(doneBtn);
    footer.appendChild(downloadBtn);

    modalContent.appendChild(header);
    modalContent.appendChild(body);
    modalContent.appendChild(footer);
    modalOverlay.appendChild(modalContent);

    document.body.appendChild(modalOverlay);

    // 4. Event Listeners
    const closePreview = () => {
        document.body.removeChild(modalOverlay);
        // if (window.location.reload) window.location.reload(); // Removed to prevent redirecting
    };

    modalOverlay.querySelector('#close-preview-btn').onclick = closePreview;
    doneBtn.onclick = closePreview;

    downloadBtn.onclick = async () => {
        // Change button state
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '<span class="animate-spin mr-2">⏳</span> Generating...';
        downloadBtn.disabled = true;

        // Generate a new, clean DOM for PDF generation to avoid preview styles/transforms issues
        await generateInvoicePDF(invoice, client, items, undefined, undefined);

        // Reset button
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;

        // Keep modal open so they can download again if they want, or close.
    };
}
