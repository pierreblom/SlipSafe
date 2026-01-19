// --- CONFIGURATION ---
// Version: 1.0.1 (SARS 2025/26 Optimized)
const supabaseUrl = 'https://fezppgnxhbxacuwcejma.supabase.co';
const supabaseKey = 'sb_publishable_ZOns1RnJ9eCQijgcBe_aRg_09u0sYH2';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- STATE ---
let savedSlips = [];
let currentProcess = null;
let currentUser = null;
let currentScreen = 'insights';
let categoryChart = null;
let authMode = 'login'; // 'login' or 'signup'

const fileInput = document.getElementById('file-input');
const loader = document.getElementById('loader');
const modal = document.getElementById('modal');
const lunchWarning = document.getElementById('lunch-warning');
const authOverlay = document.getElementById('auth-overlay');

// --- AUTHENTICATION ---
async function checkUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    currentUser = user;
    if (user) {
        authOverlay.classList.add('hidden');
        updateProfileUI();
        fetchSlips();
    } else {
        authOverlay.classList.remove('hidden');
    }
}

function toggleAuthMode() {
    authMode = authMode === 'login' ? 'signup' : 'login';
    const primaryBtn = document.getElementById('auth-primary-btn');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleLink = document.getElementById('auth-toggle-link');

    if (authMode === 'login') {
        primaryBtn.innerText = 'Sign In';
        toggleText.innerText = "Don't have an account?";
        toggleLink.innerText = 'Sign Up';
    } else {
        primaryBtn.innerText = 'Create Account';
        toggleText.innerText = "Already have an account?";
        toggleLink.innerText = 'Sign In';
    }
}

async function handleEmailAuth() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    loader.classList.remove('hidden');
    try {
        if (authMode === 'login') {
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.auth.signUp({ email, password });
            if (error) throw error;
            alert("Signup successful! Please check your email for verification (if enabled) or sign in.");
            toggleAuthMode();
        }
    } catch (err) {
        alert("Auth failed: " + err.message);
    } finally {
        loader.classList.add('hidden');
    }
}

async function loginWithGoogle() {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });
    if (error) alert("Login failed: " + error.message);
}

async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) alert("Logout failed: " + error.message);
    else window.location.reload();
}

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
        currentUser = session.user;
        authOverlay.classList.add('hidden');
        updateProfileUI();
        fetchSlips();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        authOverlay.classList.remove('hidden');
        savedSlips = [];
        await renderSlips();
    }
});

function updateProfileUI() {
    if (!currentUser) return;
    const name = currentUser.user_metadata.full_name || currentUser.email.split('@')[0];
    const initial = (name[0] || '?').toUpperCase();

    // Update greeting on home screen
    updateGreeting(name);

    // Header & Large Pic
    const picLarge = document.getElementById('profile-pic-large');
    if (picLarge) picLarge.innerText = initial;

    const nameHeader = document.getElementById('profile-display-name-header');
    if (nameHeader) nameHeader.innerText = name;

    // Fields
    const usernameEl = document.getElementById('profile-username');
    if (usernameEl) usernameEl.innerText = name.toLowerCase().replace(/\s/g, '');

    const displayNameEl = document.getElementById('profile-display-name');
    if (displayNameEl) displayNameEl.innerText = currentUser.user_metadata.display_name || 'Not set';

    const emailDisplayEl = document.getElementById('profile-email-display');
    if (emailDisplayEl) emailDisplayEl.innerText = currentUser.email;

    const phoneEl = document.getElementById('profile-phone');
    if (phoneEl) phoneEl.innerText = currentUser.user_metadata.phone || 'Not set';

    // Business Type - Set dropdown value
    const businessTypeSelect = document.getElementById('profile-business-type-select');
    if (businessTypeSelect) {
        const businessType = currentUser.user_metadata.business_type;
        if (businessType) {
            businessTypeSelect.value = businessType;
        } else {
            businessTypeSelect.value = '';
        }
    }

    // Business Type
    const businessTypeEl = document.getElementById('profile-business-type');
    if (businessTypeEl) {
        const businessTypes = {
            'accommodation': 'Accommodation',
            'catering': 'Catering & Food',
            'professional': 'Professional Services',
            'tech': 'Tech & Info',
            'education': 'Education',
            'construction': 'Construction',
            'retail': 'Retail & Trade',
            'manufacturing': 'Manufacturing',
            'personal_services': 'Personal Services',
            'transport': 'Transport'
        };

        const businessType = currentUser.user_metadata.business_type;
        if (businessType && businessTypes[businessType]) {
            businessTypeEl.innerText = businessTypes[businessType];
            businessTypeEl.classList.remove('text-slate-400');
            businessTypeEl.classList.add('text-slate-800');
        } else {
            businessTypeEl.innerText = 'Not set';
            businessTypeEl.classList.remove('text-slate-800');
            businessTypeEl.classList.add('text-slate-400');
        }
    }
}

function updateGreeting(name) {
    const greetingEl = document.getElementById('greeting-text');
    if (!greetingEl) return;

    const hour = new Date().getHours();
    let timeOfDay = 'afternoon';
    if (hour < 12) timeOfDay = 'morning';
    else if (hour >= 18) timeOfDay = 'evening';

    greetingEl.innerText = `Good ${timeOfDay}, ${name}!`;
}

// --- NAVIGATION ---
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('nav-active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.add('nav-inactive'));
    const navEl = document.getElementById(`nav-${screenId}`);
    if (navEl) {
        navEl.classList.add('nav-active');
        navEl.classList.remove('nav-inactive');
    }

    currentScreen = screenId;
    if (screenId === 'insights') updateInsightsDashboard();
    if (screenId === 'ai') generateAIInsights();
    if (screenId === 'home') renderSlips(); // Refresh home screen stats when switching back
}

// --- HOME TAB SWITCHING ---
let currentHomeTab = 'receipts';
let needsReviewFilter = false;
let bulkSelectMode = false;

function switchHomeTab(tab) {
    currentHomeTab = tab;
    const analyticsTab = document.getElementById('tab-analytics');
    const receiptsTab = document.getElementById('tab-receipts');
    const analyticsSection = document.getElementById('analytics-section');
    const receiptsSection = document.getElementById('receipts-section');
    const quickActionsReceipts = document.getElementById('quick-actions-receipts');
    const slipList = document.getElementById('slip-list');

    if (tab === 'analytics') {
        analyticsTab.classList.add('text-[#0077b6]', 'border-[#0077b6]');
        analyticsTab.classList.remove('text-slate-600', 'border-transparent');
        receiptsTab.classList.remove('text-[#0077b6]', 'border-[#0077b6]');
        receiptsTab.classList.add('text-slate-600', 'border-transparent');
        if (analyticsSection) {
            analyticsSection.classList.remove('hidden');
            // updateAnalyticsDashboard(); // Removed as per new design
        }
        if (receiptsSection) receiptsSection.classList.add('hidden');
        if (quickActionsReceipts) quickActionsReceipts.classList.add('hidden');
        if (slipList) slipList.classList.add('hidden');
    } else {
        receiptsTab.classList.add('text-[#0077b6]', 'border-[#0077b6]');
        receiptsTab.classList.remove('text-slate-600', 'border-transparent');
        analyticsTab.classList.remove('text-[#0077b6]', 'border-[#0077b6]');
        analyticsTab.classList.add('text-slate-600', 'border-transparent');
        if (receiptsSection) receiptsSection.classList.remove('hidden');
        if (analyticsSection) analyticsSection.classList.add('hidden');
        if (quickActionsReceipts) quickActionsReceipts.classList.remove('hidden');
        if (slipList) slipList.classList.remove('hidden');
    }
}

function toggleNeedsReview() {
    needsReviewFilter = !needsReviewFilter;
    const btn = document.getElementById('needs-review-btn');
    if (btn) {
        if (needsReviewFilter) {
            btn.classList.add('bg-[#0077b6]', 'text-white');
            btn.classList.remove('bg-slate-100', 'text-slate-700');
        } else {
            btn.classList.remove('bg-[#0077b6]', 'text-white');
            btn.classList.add('bg-slate-100', 'text-slate-700');
        }
    }
    filterSlips();
}

function toggleBulkSelect() {
    bulkSelectMode = !bulkSelectMode;
    const btn = document.getElementById('bulk-select-btn');
    if (btn) {
        if (bulkSelectMode) {
            btn.classList.add('bg-[#0077b6]', 'text-white');
            btn.classList.remove('bg-slate-100', 'text-slate-700');
        } else {
            btn.classList.remove('bg-[#0077b6]', 'text-white');
            btn.classList.add('bg-slate-100', 'text-slate-700');
        }
    }
    // TODO: Implement bulk select UI
}

function toggleSmartFilters() {
    alert('Smart Filters coming soon!');
}

function filterSlips() {
    // Filter and re-render slips based on current filters
    renderSlips();
}

function openTaxInfo() {
    alert('Tax Information and guidance coming soon! Check the docs folder for tax guides.');
}

// Budget setup (placeholder - can be enhanced later)
document.addEventListener('DOMContentLoaded', () => {
    const budgetCta = document.getElementById('budget-cta');
    if (budgetCta) {
        budgetCta.addEventListener('click', () => {
            const budgetAmount = prompt('Enter your monthly budget (R):');
            if (budgetAmount && !isNaN(budgetAmount)) {
                // Store budget in localStorage (can be moved to database later)
                localStorage.setItem('monthlyBudget', budgetAmount);
                updateBudgetDisplay(parseFloat(budgetAmount));
            }
        });
    }
});

function updateBudgetDisplay(budgetAmount) {
    const budgetStatus = document.getElementById('budget-status');
    const budgetProgress = document.getElementById('budget-progress');
    const budgetCta = document.getElementById('budget-cta');

    if (!budgetAmount) {
        const stored = localStorage.getItem('monthlyBudget');
        budgetAmount = stored ? parseFloat(stored) : 0;
    }

    if (budgetAmount > 0) {
        if (budgetStatus) budgetStatus.innerText = 'R ' + budgetAmount.toFixed(2);
        if (budgetCta) budgetCta.innerText = 'Click to update budget';

        // Calculate current month spending for progress
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        let monthlyTotal = 0;

        savedSlips.forEach(slip => {
            const slipDate = new Date(slip.date);
            if (slipDate.getMonth() === currentMonth && slipDate.getFullYear() === currentYear) {
                monthlyTotal += (slip.total || 0);
            }
        });

        if (budgetProgress) {
            const progress = Math.min((monthlyTotal / budgetAmount) * 100, 100);
            budgetProgress.style.width = progress + '%';
        }
    } else {
        if (budgetStatus) budgetStatus.innerText = 'No budgets set';
        if (budgetCta) budgetCta.innerText = 'Click to set up budgets';
        if (budgetProgress) budgetProgress.style.width = '0%';
    }
}

// --- CORE FUNCTIONS ---
async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Max dimensions 1200px
                const maxDim = 1200;
                if (width > height && width > maxDim) {
                    height *= maxDim / width;
                    width = maxDim;
                } else if (height > maxDim) {
                    width *= maxDim / height;
                    height = maxDim;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
                }, 'image/jpeg', 0.7); // 70% quality
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        loader.classList.remove('hidden');
        try {
            const compressedFile = await compressImage(file);
            await analyzeSlip(compressedFile);
        } catch (err) {
            console.error("Processing error:", err);
            alert("Error processing image. You can try manual entry.");
            loader.classList.add('hidden');
        }
    });
}



async function analyzeSlip(fileObject) {
    try {
        const formData = new FormData();
        formData.append('file', fileObject);

        // Validate user first - this will automatically refresh the token if needed
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            console.error("User validation failed:", userError);
            throw new Error("Invalid JWT: Your session has expired. Please sign out and sign in again.");
        }

        // Get a fresh session after user validation
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

        if (sessionError || !session || !session.access_token) {
            throw new Error("Invalid session. Please sign out and sign in again.");
        }

        console.log("Token valid, making request...");

        // Use fetch directly to get better error visibility
        const response = await fetch(`${supabaseUrl}/functions/v1/analyze-slip`, {
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
            console.error("Failed to parse response JSON:", responseText);
            throw new Error(`Server returned invalid JSON: ${responseText.substring(0, 100)}`);
        }

        if (!response.ok) {
            console.error("Function Error Response:", data);
            throw new Error(data.error || data.message || `Server error (${response.status})`);
        }

        currentProcess = {
            ...data.data,
            imageData: data.data.image_url,
            notes: [], // Ensure notes is always an empty array initially for AI analysis
            reason: data.data.reason || "", // Populate reason from AI response
            isNew: true // Mark as new scan
        };
        await openModal();
        await fetchSlips();
    } catch (err) {
        console.error("Analysis Failed:", err);
        const msg = `AI Analysis Failed: ${err.message}\n\nThis is often caused by an expired session.\n\nWould you like to SIGN OUT and try again? (Recommended)`;
        if (confirm(msg)) {
            logout();
        } else if (confirm("Would you like to enter the details manually instead?")) {
            openManualEntry(fileObject);
        }
    } finally {
        loader.classList.add('hidden');
    }
}

async function openManualEntry(fileObject) {
    // Upload the image first so we have a URL
    loader.classList.remove('hidden');
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const fileName = `${user.id}/${Date.now()}_manual_upload.jpg`;

        const { data: uploadData, error: uploadError } = await supabaseClient.storage
            .from('receipt-proofs')
            .upload(fileName, fileObject);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabaseClient.storage
            .from('receipt-proofs')
            .getPublicUrl(fileName);

        currentProcess = {
            imageData: uploadData.path, // Store the path
            merchant: "New Merchant",
            total: 0,
            vat: 0,
            date: new Date().toISOString().split('T')[0],
            is_tax_invoice: false,
            is_tax_deductible: true,
            id: null,
            notes: [], // Initialize notes for manual entry
            reason: "" // Initialize reason for manual entry
        };
        await openModal();
    } catch (err) {
        alert("Failed to upload image: " + err.message);
    } finally {
        loader.classList.add('hidden');
    }
}

async function fetchSlips() {
    if (!currentUser) return;
    const { data, error } = await supabaseClient
        .from('slips')
        .select('*')
        .order('date', { ascending: false });

    if (!error) {
        savedSlips = data;
        await renderSlips();
        if (currentScreen === 'insights') updateInsightsDashboard();
    }
}

const urlCache = new Map();

async function getSignedUrl(path) {
    if (!path) return '';
    if (urlCache.has(path)) return urlCache.get(path);

    // Extract path from full URL if needed
    const cleanPath = path.includes('receipt-proofs/')
        ? path.split('receipt-proofs/').pop()
        : path;

    const { data, error } = await supabaseClient.storage
        .from('receipt-proofs')
        .createSignedUrl(cleanPath, 3600); // 1 hour expiry

    if (error) {
        console.error("Error signing URL:", error);
        return path; // Fallback to original
    }

    urlCache.set(path, data.signedUrl);
    return data.signedUrl;
}

async function renderSlips() {
    const list = document.getElementById('slip-list');
    const fullList = document.getElementById('full-slip-list');
    let claimTotal = 0;
    let deductionTotal = 0;

    // Apply filters
    let filteredSlips = savedSlips;

    // Category filter
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter && categoryFilter.value) {
        filteredSlips = filteredSlips.filter(s => s.category === categoryFilter.value);
    }

    // Needs review filter
    if (needsReviewFilter) {
        // Filter for slips that might need review (e.g., incomplete compliance)
        filteredSlips = filteredSlips.filter(s =>
            !s.is_tax_invoice ||
            (s.compliance_status && s.compliance_status !== 'Valid' && s.compliance_status !== 'Sufficient')
        );
    }

    // Search filter
    const receiptSearch = document.getElementById('receipt-search');
    if (receiptSearch && receiptSearch.value.trim()) {
        const searchTerm = receiptSearch.value.toLowerCase();
        filteredSlips = filteredSlips.filter(s =>
            s.merchant.toLowerCase().includes(searchTerm) ||
            (s.category && s.category.toLowerCase().includes(searchTerm))
        );
    }

    // Sort filter
    const sortFilter = document.getElementById('sort-filter');
    if (sortFilter) {
        const sortBy = sortFilter.value;
        filteredSlips = [...filteredSlips].sort((a, b) => {
            if (sortBy === 'date') {
                return new Date(b.date) - new Date(a.date);
            } else if (sortBy === 'amount') {
                return (b.total || 0) - (a.total || 0);
            } else if (sortBy === 'merchant') {
                return (a.merchant || '').localeCompare(b.merchant || '');
            }
            return 0;
        });
    }

    // Fetch signed URLs for all slips in parallel
    const slipsWithUrls = await Promise.all(filteredSlips.map(async s => {
        const signedUrl = await getSignedUrl(s.image_url);
        return { ...s, displayUrl: signedUrl };
    }));

    const html = slipsWithUrls.map(s => {
        const vat = s.vat || 0;
        const total = s.total || 0;
        if (s.category !== 'Entertainment') claimTotal += vat;
        if (s.is_tax_deductible) deductionTotal += total;

        return `
            <div class="card p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition" onclick="editSlip('${s.id}')">
                <img src="${s.displayUrl}" class="w-14 h-14 rounded-2xl object-cover border border-slate-50 shadow-sm">
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-slate-800 truncate">${s.merchant}</h4>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${s.date} • <span class="${s.category === 'Entertainment' ? 'text-orange-500' : 'text-blue-600'}">${s.category}</span></p>
                </div>
                <div class="text-right">
                    <p class="font-black text-slate-900 text-lg">R${total.toFixed(2)}</p>
                    <p class="text-[9px] text-slate-400 uppercase font-bold">VAT: R${vat.toFixed(2)}</p>
                </div>
            </div>
        `;
    });

    // Update receipt count display
    const receiptCountEl = document.getElementById('receipt-count');
    const receiptCountText = document.getElementById('receipt-count-text');
    const emptyState = document.getElementById('empty-state');

    if (receiptCountEl) receiptCountEl.innerText = savedSlips.length;

    // Update receipt count text ("Showing X of Y receipts")
    if (receiptCountText) {
        receiptCountText.innerText = `Showing ${slipsWithUrls.length} of ${savedSlips.length} receipts`;
    }

    // Show/hide empty state and quick actions
    const quickActionsReceipts = document.getElementById('quick-actions-receipts');
    if (emptyState) {
        if (slipsWithUrls.length === 0) {
            emptyState.classList.remove('hidden');
            if (list) list.classList.add('hidden');
            if (quickActionsReceipts) quickActionsReceipts.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            if (list) list.classList.remove('hidden');
            if (quickActionsReceipts && currentHomeTab === 'receipts') {
                quickActionsReceipts.classList.remove('hidden');
            }
        }
    }

    if (list) {
        if (slipsWithUrls.length === 0) {
            list.innerHTML = '';
        } else {
            list.innerHTML = html.join('');
            list.classList.remove('hidden');
        }
    }
    if (fullList) fullList.innerHTML = html.join('') || '<p class="text-center py-10 text-slate-300 text-sm">No slips found.</p>';

    const claimableEl = document.getElementById('stat-claimable');
    const deductionsEl = document.getElementById('stat-deductions');
    const totalReceiptsEl = document.getElementById('stat-total-receipts');
    const thisMonthEl = document.getElementById('stat-this-month');

    if (claimableEl) claimableEl.innerText = "R " + claimTotal.toFixed(2);
    if (deductionsEl) deductionsEl.innerText = "R " + deductionTotal.toFixed(2);
    if (totalReceiptsEl) totalReceiptsEl.innerText = savedSlips.length;

    if (thisMonthEl) {
        const now = new Date();
        const monthlyTotal = savedSlips.reduce((sum, slip) => {
            const slipDate = new Date(slip.date);
            const isSameMonth = slipDate.getMonth() === now.getMonth() && slipDate.getFullYear() === now.getFullYear();
            return isSameMonth ? sum + (slip.total || 0) : sum;
        }, 0);
        thisMonthEl.innerText = "R " + monthlyTotal.toFixed(2);
    }
}




async function deleteSlip(id) {
    try {
        const { error } = await supabaseClient
            .from('slips')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting slip:', error);
        return false;
    }
}

async function cancelUpload() {
    // If it's a new scan (automatically saved by AI), delete it on cancel
    if (currentProcess && currentProcess.isNew && currentProcess.id) {
        const cancelBtn = document.querySelector('#modal button[onclick="cancelUpload()"]');
        const originalText = cancelBtn ? cancelBtn.innerText : 'Cancel';

        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.innerHTML = '<span class="animate-spin inline-block mr-1">⏳</span> Discarding...';
        }

        await deleteSlip(currentProcess.id);

        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.innerText = originalText;
        }

        closeModal();
        fetchSlips();
    } else {
        closeModal();
    }
}

function editSlip(id) {
    const slip = savedSlips.find(s => s.id == id);
    if (!slip) return;

    currentProcess = {
        id: slip.id,
        merchant: slip.merchant,
        total: slip.total,
        vat: slip.vat,
        category: slip.category,
        is_tax_deductible: slip.is_tax_deductible,
        imageData: slip.image_url,
        vat_number: slip.vat_number,
        is_tax_invoice: slip.is_tax_invoice,
        date: slip.date,
        notes: slip.notes || [],
        reason: "", // No reason for existing slips
        isNew: false // Not a new scan
    };
    openModal();
}

async function openModal() {
    const previewImg = document.getElementById('m-preview');
    previewImg.src = ''; // Clear old preview

    const signedUrl = await getSignedUrl(currentProcess.imageData);
    previewImg.src = signedUrl;

    document.getElementById('m-merchant').value = currentProcess.merchant;
    document.getElementById('m-total').value = currentProcess.total;
    document.getElementById('m-vat').value = currentProcess.vat;
    document.getElementById('m-vatno').value = currentProcess.vat_number || "";
    document.getElementById('m-category').value = currentProcess.category || "General Business";
    document.getElementById('m-deductible').checked = currentProcess.is_tax_deductible;

    // New fields
    document.getElementById('m-date').value = currentProcess.date || new Date().toISOString().split('T')[0];
    document.getElementById('m-notes').value = Array.isArray(currentProcess.notes) ? currentProcess.notes.join('\n') : (currentProcess.notes || '');
    document.getElementById('m-recurring').checked = currentProcess.is_recurring || false;

    // Clear and display notes (legacy display, can be removed or kept for history if needed, but we use textarea now)
    // Clear and display notes (legacy display, can be removed or kept for history if needed, but we use textarea now)
    // const notesDisplayEl = document.getElementById('notes-display');
    // if (notesDisplayEl) {
    //    notesDisplayEl.innerHTML = '';
    //    if (currentProcess.notes && currentProcess.notes.length > 0) {
    //        currentProcess.notes.forEach(note => {
    //            const noteEl = document.createElement('p');
    //            // Keep notes simple without extra background styling
    //            noteEl.className = "text-xs text-slate-600 leading-relaxed font-medium";
    //            noteEl.innerText = note;
    //            notesDisplayEl.appendChild(noteEl);
    //        });
    //    }
    // }

    const badge = document.getElementById('compliance-badge');
    const status = currentProcess.compliance_status || (currentProcess.is_tax_invoice ? "Valid" : "Receipt Only");
    if (badge) badge.innerText = status;

    if (badge && (status === 'Valid' || status === 'Sufficient')) {
        badge.className = "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700";
    } else if (status === 'Incomplete') {
        badge.className = "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-orange-100 text-orange-700";
    } else {
        badge.className = "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-700";
    }

    // Show reasoning if available
    const reasoningEl = document.getElementById('m-reasoning');
    if (reasoningEl) {
        reasoningEl.innerText = currentProcess.reason || "";
        reasoningEl.parentElement.classList.toggle('hidden', !currentProcess.reason);
    }

    toggleWarning();
    modal.classList.remove('hidden');
}

function toggleWarning() {
    const cat = document.getElementById('m-category').value;
    if (lunchWarning) lunchWarning.classList.toggle('hidden', cat !== 'Entertainment');
}

function closeModal() {
    modal.classList.add('hidden');
    if (fileInput) fileInput.value = '';
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Save Slip';
    }
}


async function handleSave(scanNext = false) {
    const saveBtn = document.getElementById('save-btn');
    const merchant = document.getElementById('m-merchant').value;
    const total = parseFloat(document.getElementById('m-total').value);
    const vat = parseFloat(document.getElementById('m-vat').value) || 0;
    const category = document.getElementById('m-category').value;
    const is_tax_deductible = document.getElementById('m-deductible').checked;
    const is_recurring = document.getElementById('m-recurring').checked;
    const vat_number = document.getElementById('m-vatno').value;
    const badgeEl = document.getElementById('compliance-badge');
    const is_tax_invoice = badgeEl ? (badgeEl.innerText === "Valid" || badgeEl.innerText === "Sufficient") : false;
    const date = document.getElementById('m-date').value;
    const notesVal = document.getElementById('m-notes').value;
    const notes = notesVal ? notesVal.split('\n').filter(n => n.trim()) : [];

    // If recurring is checked, append it to notes for now since schema doesn't support it
    if (is_recurring) {
        notes.push("Recurring Expense");
    }

    const slipData = {
        merchant,
        total,
        vat,
        category,
        is_tax_deductible,
        // is_recurring, // Removed: Column does not exist in DB
        vat_number,
        is_tax_invoice,
        date,
        notes
    };

    // Disable button and show loading
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="animate-spin mr-2">⏳</span> Saving...';
    }

    let error;
    try {
        if (currentProcess.id) {
            // Update existing
            const { error: updateError } = await supabaseClient.from('slips').update(slipData).eq('id', currentProcess.id);
            error = updateError;
        } else {
            // Insert new manual entry
            const { data: { user } } = await supabaseClient.auth.getUser();
            const normalizedMerchant = merchant.trim().toLowerCase();
            const fingerprint = `${user.id}|${normalizedMerchant}|${date}|${total}`;

            const { error: insertError } = await supabaseClient.from('slips').insert([{
                ...slipData,
                user_id: user.id,
                image_url: currentProcess.imageData,
                fingerprint: fingerprint
            }]);
            error = insertError;
        }

        if (!error) {
            closeModal();
            fetchSlips(); // Refresh list

            if (scanNext) {
                // Trigger file input click after a short delay
                setTimeout(() => {
                    document.getElementById('file-input').click();
                }, 500);
            }
        } else {
            if (error.code === '23505') {
                alert("Duplicate Slip! You have already saved this receipt.");
            } else {
                alert("Error saving: " + error.message);
            }
        }
    } catch (err) {
        console.error('Save error:', err);
        alert('An unexpected error occurred.');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Save Receipt
            `;
        }
    }
}

// Expose for HTML onclick
window.saveAndScanNext = () => handleSave(true);

const saveBtn = document.getElementById('save-btn');
if (saveBtn) {
    saveBtn.onclick = () => handleSave(false);
}

const addNoteBtn = document.getElementById('add-note-btn');
if (addNoteBtn) {
    addNoteBtn.onclick = () => {
        const noteTextarea = document.getElementById('m-notes');
        const noteContent = noteTextarea.value.trim();
        if (noteContent) {
            if (!currentProcess.notes) {
                currentProcess.notes = [];
            }
            currentProcess.notes.push(noteContent);
            noteTextarea.value = ''; // Clear the textarea
            openModal(); // Re-render modal to display new note
        }
    };
}

// --- REPORTS & CHARTS ---
let monthlyTrendsChart = null;

function renderCharts() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    const categories = {};
    savedSlips.forEach(s => {
        categories[s.category] = (categories[s.category] || 0) + (s.total || 0);
    });

    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categories),
            datasets: [{
                data: Object.values(categories),
                backgroundColor: ['#0077b6', '#00b4d8', '#90e0ef', '#caf0f8', '#03045e'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Outfit', weight: 'bold' } } } },
            cutout: '70%'
        }
    });
}

function renderMonthlyTrendsChart() {
    const ctx = document.getElementById('monthlyTrendsChart');
    if (!ctx) return;

    const monthlyTotals = {};
    savedSlips.forEach(slip => {
        const date = new Date(slip.date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyTotals[monthYear] = (monthlyTotals[monthYear] || 0) + (slip.total || 0);
    });

    const sortedMonths = Object.keys(monthlyTotals).sort();
    const data = sortedMonths.map(month => monthlyTotals[month]);

    if (monthlyTrendsChart) monthlyTrendsChart.destroy();
    monthlyTrendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedMonths,
            datasets: [{
                label: 'Monthly Spending',
                data: data,
                borderColor: '#0077b6',
                backgroundColor: 'rgba(0, 119, 182, 0.2)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return 'R' + value.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

function updateInsightsDashboard() {
    let totalSpending = 0;
    let totalReceipts = savedSlips.length;
    const categoryTotals = {};
    const monthlyTotals = {};

    savedSlips.forEach(slip => {
        totalSpending += (slip.total || 0);
        categoryTotals[slip.category] = (categoryTotals[slip.category] || 0) + (slip.total || 0);

        const date = new Date(slip.date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyTotals[monthYear] = (monthlyTotals[monthYear] || 0) + (slip.total || 0);
    });

    const averagePerReceipt = totalReceipts > 0 ? totalSpending / totalReceipts : 0;

    // Update Financial Overview
    const totalSpendingEl = document.getElementById('total-spending');
    const avgPerReceiptEl = document.getElementById('average-per-receipt');
    const totalReceiptsCountEl = document.getElementById('total-receipts-count');

    if (totalSpendingEl) totalSpendingEl.innerText = `R ${totalSpending.toFixed(2)}`;
    if (avgPerReceiptEl) avgPerReceiptEl.innerText = `R ${averagePerReceipt.toFixed(2)}`;
    if (totalReceiptsCountEl) totalReceiptsCountEl.innerText = totalReceipts;

    // Update Top Category
    let topCategory = 'N/A';
    let topCategoryAmount = 0;
    if (Object.keys(categoryTotals).length > 0) {
        topCategory = Object.keys(categoryTotals).reduce((a, b) => categoryTotals[a] > categoryTotals[b] ? a : b);
        topCategoryAmount = categoryTotals[topCategory];
    }

    const topCategoryEl = document.getElementById('top-category');
    const topCategoryAmountEl = document.getElementById('top-category-amount');

    if (topCategoryEl) topCategoryEl.innerText = topCategory;
    if (topCategoryAmountEl) topCategoryAmountEl.innerText = `R ${topCategoryAmount.toFixed(2)}`;

    // Render charts
    renderCharts(); // For Spending by Category (Doughnut)
    renderMonthlyTrendsChart(); // For Monthly Spending Trends (Line)

    // Update Category Breakdown List
    const categoryBreakdownList = document.getElementById('category-breakdown-list');
    if (categoryBreakdownList) {
        if (Object.keys(categoryTotals).length === 0) {
            categoryBreakdownList.innerHTML = '<p class="text-slate-500 text-sm">No spending data yet.</p>';
        } else {
            const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
            categoryBreakdownList.innerHTML = sortedCategories.map(([category, amount]) => `
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span class="text-sm font-medium text-slate-800">${category}</span>
                    <span class="text-xs text-slate-500 font-bold">R ${amount.toFixed(2)}</span>
                </div>
            `).join('');
        }
    }
}

// --- AI INSIGHTS ---
function generateAIInsights() {
    if (savedSlips.length === 0) return;

    // Average monthly spend (current month)
    const now = new Date();
    const monthlyTotal = savedSlips.reduce((sum, slip) => {
        const slipDate = new Date(slip.date);
        const isSameMonth = slipDate.getMonth() === now.getMonth() && slipDate.getFullYear() === now.getFullYear();
        return isSameMonth ? sum + (slip.total || 0) : sum;
    }, 0);
    const avgSpendEl = document.getElementById('ai-average-spend');
    if (avgSpendEl) avgSpendEl.innerText = `R${monthlyTotal.toFixed(2)}`;

    const stores = {};
    savedSlips.forEach(s => stores[s.merchant] = (stores[s.merchant] || 0) + 1);
    const topStore = Object.entries(stores).sort((a, b) => b[1] - a[1])[0][0];
}

// --- BUSINESS HUB ---
function openBusinessModal(type) {
    const featureNames = {
        'client': 'Client Management',
        'quote': 'Quotation System',
        'invoice': 'Invoicing System',
        'tax-dashboard': 'Tax Dashboard',
        'business-profile': 'Business Profile',
        'pnl-report': 'P&L Report',
        'invoice-list': 'All Invoices',
        'quote-list': 'All Quotations'
    };

    const name = featureNames[type] || type;
    alert(`${name} feature coming soon! We are setting up your premium Business Hub.`);
}

// --- EXPORT ---
async function exportToExcel() {
    if (savedSlips.length === 0) return alert("Add some slips first!");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tax Records');

    sheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Merchant', key: 'merchant', width: 25 },
        { header: 'VAT Number', key: 'vatNo', width: 20 },
        { header: 'Category', key: 'cat', width: 20 },
        { header: 'Total (ZAR)', key: 'total', width: 15 },
        { header: 'VAT (ZAR)', key: 'vat', width: 15 },
        { header: 'Tax Deductible', key: 'deductible', width: 15 },
        { header: 'Image Proof', key: 'img', width: 30 }
    ];

    alert("Generating Excel... This might take a moment to download images.");

    for (let i = 0; i < savedSlips.length; i++) {
        const s = savedSlips[i];
        const row = sheet.addRow({
            date: s.date,
            merchant: s.merchant,
            vatNo: s.vat_number || 'N/A',
            cat: s.category,
            total: s.total,
            vat: s.vat,
            deductible: s.is_tax_deductible ? 'YES' : 'NO'
        });
        row.height = 100;

        try {
            const response = await fetch(s.image_url);
            const blob = await response.blob();
            const buffer = await blob.arrayBuffer();

            const imgId = workbook.addImage({
                buffer: buffer,
                extension: 'png',
            });
            sheet.addImage(imgId, {
                tl: { col: 7, row: i + 1 },
                ext: { width: 120, height: 120 }
            });
        } catch (e) {
            console.error("Could not embed image for " + s.merchant, e);
            row.getCell(8).value = "Image Error";
        }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SARS_Tax_Proof_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
}

// Initialize search and filter handlers
document.addEventListener('DOMContentLoaded', () => {
    const receiptSearch = document.getElementById('receipt-search');
    const categoryFilter = document.getElementById('category-filter');
    const sortFilter = document.getElementById('sort-filter');

    if (receiptSearch) {
        receiptSearch.addEventListener('input', () => filterSlips());
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => filterSlips());
    }
    if (sortFilter) {
        sortFilter.addEventListener('change', () => filterSlips());
    }

    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
        globalSearch.addEventListener('input', () => {
            const searchTerm = globalSearch.value.toLowerCase();
            if (searchTerm) {
                // Switch to receipts tab and apply search
                switchHomeTab('receipts');
                if (receiptSearch) {
                    receiptSearch.value = searchTerm;
                }
                filterSlips();
            }
        });
    }
});

// Initialize
checkUser();
switchScreen('insights');

// --- PROFILE ACTIONS ---
async function updateBusinessType(value) {
    if (!value) return; // User selected the placeholder option

    try {
        const { error } = await supabaseClient.auth.updateUser({
            data: { business_type: value }
        });

        if (error) throw error;

        // Refresh user data
        const { data: { user } } = await supabaseClient.auth.getUser();
        currentUser = user;

        // Show success message
        const businessTypes = {
            'accommodation': 'Accommodation',
            'catering': 'Catering & Food',
            'professional': 'Professional Services',
            'tech': 'Tech & Info',
            'education': 'Education',
            'construction': 'Construction',
            'retail': 'Retail & Trade',
            'manufacturing': 'Manufacturing',
            'personal_services': 'Personal Services',
            'transport': 'Transport'
        };

        alert(`Business type updated to: ${businessTypes[value]}`);
    } catch (err) {
        alert('Error updating business type: ' + err.message);
    }
}

async function editProfileField(field) {
    if (field === 'business_type') {
        const businessTypes = [
            { value: 'accommodation', label: 'Accommodation', examples: 'Airbnb, Guest Houses, Hotels, B&Bs' },
            { value: 'catering', label: 'Catering & Food', examples: 'Restaurants, Coffee Shops, Spas' },
            { value: 'professional', label: 'Professional Services', examples: 'Lawyers, Accountants, Consultants' },
            { value: 'tech', label: 'Tech & Info', examples: 'IT Support, Web Design, Software' },
            { value: 'education', label: 'Education', examples: 'Tutors, Preschools, Training Centers' },
            { value: 'construction', label: 'Construction', examples: 'Builders, Plumbers, Electricians' },
            { value: 'retail', label: 'Retail & Trade', examples: 'Spaza Shops, Online Stores, Boutiques' },
            { value: 'manufacturing', label: 'Manufacturing', examples: 'Furniture Making, Clothing Factories' },
            { value: 'personal_services', label: 'Personal Services', examples: 'Hairdressers, Spas, Garden Services' },
            { value: 'transport', label: 'Transport', examples: 'Uber/Bolt, Logistics, Deliveries' }
        ];

        const options = businessTypes.map(bt =>
            `<option value="${bt.value}">${bt.label} - ${bt.examples}</option>`
        ).join('');

        const currentValue = currentUser?.user_metadata?.business_type || '';

        const selected = prompt(
            `Select your business type:\n\n${businessTypes.map((bt, i) => `${i + 1}. ${bt.label}\n   (${bt.examples})`).join('\n\n')}\n\nEnter the number (1-10):`,
            ''
        );

        if (selected) {
            const index = parseInt(selected) - 1;
            if (index >= 0 && index < businessTypes.length) {
                const selectedType = businessTypes[index];

                try {
                    const { error } = await supabaseClient.auth.updateUser({
                        data: { business_type: selectedType.value }
                    });

                    if (error) throw error;

                    // Update UI
                    document.getElementById('profile-business-type').innerText = selectedType.label;
                    document.getElementById('profile-business-type').classList.remove('text-slate-400');
                    document.getElementById('profile-business-type').classList.add('text-slate-800');

                    alert(`Business type updated to: ${selectedType.label}`);

                    // Refresh user data
                    const { data: { user } } = await supabaseClient.auth.getUser();
                    currentUser = user;
                } catch (err) {
                    alert('Error updating business type: ' + err.message);
                }
            } else {
                alert('Invalid selection. Please enter a number between 1 and 10.');
            }
        }
    } else {
        alert(`Editing ${field} coming soon! We are building a secure profile editor.`);
    }
}

function copyEmailToReceipt() {
    const email = document.getElementById('receipt-email-address').innerText;
    navigator.clipboard.writeText(email.trim()).then(() => {
        alert("Email address copied to clipboard!");
    });
}

function regenerateEmailToReceipt() {
    if (confirm("Are you sure you want to regenerate your receipt email? The old one will stop working.")) {
        alert("Regenerating... Your new address will be ready in a moment.");
    }
}

function signOutAllDevices() {
    if (confirm("This will sign you out of all active sessions. Continue?")) {
        logout();
    }
}

function clearAllData() {
    const confirmText = prompt("To confirm, type 'CLEAR ALL DATA' below. This cannot be undone.");
    if (confirmText === 'CLEAR ALL DATA') {
        alert("Clearing all data... Your account will be fresh in a few seconds.");
    }
}

function deleteAccount() {
    const confirmText = prompt("To confirm deletion, type your email address below. This is permanent.");
    if (confirmText === currentUser.email) {
        alert("Account deletion initiated. We're sorry to see you go.");
    }
}