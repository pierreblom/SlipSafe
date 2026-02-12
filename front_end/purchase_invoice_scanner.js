// --- PURCHASE INVOICE SCANNER ---

/**
 * Analyzes a purchase invoice image using AI
 * Extracts: vendor name, invoice number, date, due date, total, VAT, line items
 */
async function analyzePurchaseInvoice(fileObject) {
    loader.classList.remove('hidden');

    try {
        const formData = new FormData();
        formData.append('file', fileObject);

        // Validate user and get fresh session
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            throw new Error("Invalid session. Please sign out and sign in again.");
        }

        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !session || !session.access_token) {
            throw new Error("Invalid session. Please sign out and sign in again.");
        }

        // Call Edge Function for AI analysis
        const response = await fetch(`${supabaseUrl}/functions/v1/analyze-purchase-invoice`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': supabaseKey
            },
            body: formData
        });

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse response:", responseText);
            throw new Error(`Server returned invalid JSON: ${responseText.substring(0, 100)}`);
        }

        if (!response.ok) {
            console.error("Function Error:", data);
            throw new Error(data.error || data.message || `Server error (${response.status})`);
        }

        // Extract the purchase invoice data
        const invoiceData = data.data;

        // Save to database
        const purchaseInvoice = {
            user_id: user.id,
            vendor_name: invoiceData.vendor_name || 'Unknown Vendor',
            invoice_number: invoiceData.invoice_number || 'INV-' + Date.now().toString().slice(-6),
            invoice_date: invoiceData.invoice_date || new Date().toISOString().split('T')[0],
            due_date: invoiceData.due_date,
            subtotal: parseFloat(invoiceData.subtotal) || 0,
            vat: parseFloat(invoiceData.vat) || 0,
            total: parseFloat(invoiceData.total) || 0,
            image_url: invoiceData.image_url,
            line_items: invoiceData.line_items || [],
            status: 'unpaid',
            notes: invoiceData.notes || '',
            image_hash: invoiceData.image_hash
        };

        const { data: savedInvoice, error: saveError } = await supabaseClient
            .from('purchase_invoices')
            .insert([purchaseInvoice])
            .select()
            .single();

        if (saveError) {
            console.error("Save error:", saveError);
            throw new Error(saveError.message);
        }

        // Show success and refresh
        await showDialog("Success!", `Purchase Invoice from ${invoiceData.vendor_name || 'vendor'} has been saved successfully!`, "success");
        await fetchPurchaseInvoices();
        // location.reload(); // Removed to prevent redirecting to insights
        if (typeof switchScreen === 'function') {
            switchScreen('business');
        }

    } catch (err) {
        console.error("Purchase Invoice Analysis Failed:", err);

        // Check for duplicates
        if (err.message.includes('Duplicate') || err.message.includes('already been scanned')) {
            await showDialog("Duplicate Invoice", "You have already scanned this purchase invoice.", "warning");
            return;
        }

        const isQuotaError = err.message.toLowerCase().includes('quota') ||
            err.message.includes('429') ||
            err.message.toLowerCase().includes('limit');

        if (isQuotaError) {
            await showDialog("AI Quota Exceeded", "The AI is currently busy or has reached its daily limit. Please try again later.", "warning");
        } else {
            const msg = `${err.message}<br><br>This is often caused by an expired session.<br><br>Would you like to <b>SIGN OUT</b> and try again?`;
            if (await showDialog("Analysis Failed", msg, "error", true, "Sign Out")) {
                logout();
            }
        }
    } finally {
        loader.classList.add('hidden');
    }
}

/**
 * Fetches all purchase invoices for the current user
 */
async function fetchPurchaseInvoices() {
    if (!currentUser) return [];

    const { data, error } = await supabaseClient
        .from('purchase_invoices')
        .select('*')
        .order('invoice_date', { ascending: false });

    if (error) {
        console.error("Error fetching purchase invoices:", error);
        return [];
    }

    // Render in the quotes list
    renderPurchaseInvoicesUI(data || []);
    return data || [];
}

/**
 * Renders purchase invoices in the UI
 */
function renderPurchaseInvoicesUI(invoices) {
    const listContainer = document.getElementById('recent-quotes-list');
    if (!listContainer) return;

    if (invoices.length === 0) {
        listContainer.innerHTML = `
            <div class="py-10 text-center space-y-2">
                <p class="text-slate-400 text-sm">No purchase invoices yet. Create your first purchase invoice to get started.</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = invoices.slice(0, 5).map(inv => {
        const statusColors = {
            'paid': 'bg-green-100 text-green-700',
            'unpaid': 'bg-yellow-100 text-yellow-700',
            'overdue': 'bg-red-100 text-red-700'
        };
        const statusColor = statusColors[inv.status] || 'bg-slate-100 text-slate-700';

        return `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-blue-200 transition cursor-pointer" onclick="viewPurchaseInvoice('${inv.id}')">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-bold text-slate-800">${inv.vendor_name}</h4>
                        <p class="text-xs text-slate-500">#${inv.invoice_number}</p>
                    </div>
                    <span class="${statusColor} px-3 py-1 rounded-full text-xs font-bold uppercase">${inv.status}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                    <span class="text-slate-500">Date: ${new Date(inv.invoice_date).toLocaleDateString()}</span>
                    <span class="font-bold text-blue-600">R ${inv.total.toFixed(2)}</span>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Opens a purchase invoice for viewing
 */
async function viewPurchaseInvoice(invoiceId) {
    loader.classList.remove('hidden');

    try {
        const { data: invoice, error } = await supabaseClient
            .from('purchase_invoices')
            .select('*')
            .eq('id', invoiceId)
            .single();

        if (error) throw error;

        // Build scrollable content (without buttons)
        const modalContent = `
            <div class="space-y-6">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-2xl font-bold text-slate-800">${invoice.vendor_name}</h3>
                        <p class="text-sm text-slate-500">Invoice #${invoice.invoice_number}</p>
                    </div>
                    <span class="px-4 py-2 bg-${invoice.status === 'paid' ? 'green' : 'yellow'}-100 text-${invoice.status === 'paid' ? 'green' : 'yellow'}-700 rounded-full text-sm font-bold uppercase">${invoice.status}</span>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <p class="text-xs text-slate-500 font-bold uppercase">Invoice Date</p>
                        <p class="text-slate-800 font-bold">${new Date(invoice.invoice_date).toLocaleDateString()}</p>
                    </div>
                    ${invoice.due_date ? `
                    <div>
                        <p class="text-xs text-slate-500 font-bold uppercase">Due Date</p>
                        <p class="text-slate-800 font-bold">${new Date(invoice.due_date).toLocaleDateString()}</p>
                    </div>
                    ` : ''}
                </div>

                ${invoice.line_items && invoice.line_items.length > 0 ? `
                <div>
                    <h4 class="text-sm font-bold text-slate-700 uppercase mb-2">Line Items</h4>
                    <div class="space-y-2">
                        ${invoice.line_items.map(item => `
                            <div class="flex justify-between text-sm">
                                <span class="text-slate-600">${item.description} (x${item.quantity})</span>
                                <span class="font-bold text-slate-800">R ${item.total.toFixed(2)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="bg-slate-50 p-4 rounded-xl space-y-2">
                    <div class="flex justify-between text-sm">
                        <span class="text-slate-600">Subtotal</span>
                        <span class="font-bold">R ${invoice.subtotal.toFixed(2)}</span>
                    </div>
                    ${invoice.vat > 0 ? `
                    <div class="flex justify-between text-sm">
                        <span class="text-slate-600">VAT</span>
                        <span class="font-bold">R ${invoice.vat.toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="h-px bg-slate-200"></div>
                    <div class="flex justify-between">
                        <span class="font-bold text-slate-800">Total</span>
                        <span class="font-black text-xl text-blue-600">R ${invoice.total.toFixed(2)}</span>
                    </div>
                </div>

                ${invoice.notes ? `
                <div>
                    <p class="text-xs text-slate-500 font-bold uppercase mb-1">Notes</p>
                    <p class="text-sm text-slate-700">${invoice.notes}</p>
                </div>
                ` : ''}

                ${invoice.image_url ? `
                <div>
                    <p class="text-xs text-slate-500 font-bold uppercase mb-2">Invoice Image</p>
                    <img src="${await getSignedUrl(invoice.image_url)}" class="w-full rounded-xl border border-slate-200" alt="Invoice">
                </div>
                ` : ''}
            </div>
        `;

        // Build action buttons (fixed footer)
        const actionButtons = `
            <div class="flex gap-3 p-6 border-t border-slate-100 bg-slate-50">
                ${invoice.status === 'unpaid' ? `
                <button onclick="markPurchaseInvoiceAsPaid('${invoice.id}')" class="flex-1 bg-emerald-100 text-emerald-700 font-bold py-3 rounded-xl hover:bg-emerald-200 transition flex items-center justify-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    Mark as Paid
                </button>
                ` : ''}
                <button onclick="closeModal()" class="flex-1 bg-slate-100 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-200 transition">
                    Done
                </button>
                <button onclick="deletePurchaseInvoice('${invoice.id}')" class="flex-1 bg-red-100 text-red-600 font-bold py-3 rounded-xl hover:bg-red-200 transition flex items-center justify-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    Delete
                </button>
            </div>
        `;

        modal.querySelector('.premium-dialog').innerHTML = `
            <div class="px-6 pt-6 pb-2 flex items-center justify-between shrink-0">
                <h2 class="text-2xl font-bold text-slate-800">Purchase Invoice</h2>
                <button onclick="closeModal()" class="p-2 hover:bg-slate-100 rounded-full transition text-slate-400 hover:text-slate-600">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <div class="flex-1 overflow-y-auto px-6 py-4">
                ${modalContent}
            </div>
            ${actionButtons}
        `;
        modal.classList.remove('hidden');

    } catch (err) {
        console.error("Error viewing purchase invoice:", err);
        await showDialog("Error", "Failed to load purchase invoice: " + err.message, "error");
    } finally {
        loader.classList.add('hidden');
    }
}

async function markPurchaseInvoiceAsPaid(invoiceId) {
    const confirmed = await showDialog(
        "Confirm Payment",
        "Are you sure you want to mark this purchase invoice as PAID?",
        "warning",
        true,
        "Yes, Mark as Paid"
    );

    if (!confirmed) return;

    loader.classList.remove('hidden');

    try {
        const { data, error } = await supabaseClient
            .from('purchase_invoices')
            .update({ status: 'paid' })
            .eq('id', invoiceId)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error("Update failed - no rows affected. Check RLS policies.");
        }

        await showDialog("Success", "Purchase invoice marked as paid!", "success");
        closeModal();
        await fetchPurchaseInvoices();
    } catch (err) {
        await showDialog("Error", "Failed to update status: " + err.message, "error");
    } finally {
        loader.classList.add('hidden');
    }
}

async function deletePurchaseInvoice(invoiceId) {
    if (!await showDialog("Confirm Delete", "Are you sure you want to delete this purchase invoice?", "warning", true, "Yes, Delete")) {
        return;
    }

    loader.classList.remove('hidden');

    try {
        const { error } = await supabaseClient
            .from('purchase_invoices')
            .delete()
            .eq('id', invoiceId);

        if (error) throw error;

        await showDialog("Success", "Purchase invoice deleted!", "success");
        closeModal();
        await fetchPurchaseInvoices();
    } catch (err) {
        await showDialog("Error", "Failed to delete invoice: " + err.message, "error");
    } finally {
        loader.classList.add('hidden');
    }
}
