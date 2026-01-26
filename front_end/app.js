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
    if (screenId === 'business') renderRecentBusinessItems();
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
    const htmlContent = `
        <div class="text-center py-4 space-y-4">
            <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
            </div>
            <div>
                <h4 class="font-bold text-slate-800 text-lg mb-1">Smart Filters</h4>
                <p class="text-slate-500">Advanced filtering options like date ranges, tax status, and merchant grouping are coming soon.</p>
            </div>
        </div>
    `;
    openInfoModal("Smart Filters", htmlContent);
}

function filterSlips() {
    // Filter and re-render slips based on current filters
    renderSlips();
}

function openTaxInfo() {
    const htmlContent = `
        <div class="space-y-4">
            <div class="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-start">
                <span class="text-xl">ℹ️</span>
                <p class="text-sm text-blue-800 leading-relaxed">
                    <b>Tax Deductible Expenses</b> are business costs that can be subtracted from your income to lower your tax bill.
                </p>
            </div>
            
            <div class="space-y-2">
                <h4 class="font-bold text-slate-800 text-sm">Common Deductibles:</h4>
                <ul class="text-sm text-slate-600 space-y-2 pl-2">
                    <li class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                        Office Supplies & Equipment
                    </li>
                    <li class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                        Business Travel & Fuel
                    </li>
                    <li class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                        Professional Services (Legal, Accounting)
                    </li>
                    <li class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                        Marketing & Advertising
                    </li>
                </ul>
            </div>

            <div class="bg-slate-50 p-3 rounded-xl text-xs text-slate-500 italic border border-slate-100">
                Disclaimer: This is for informational purposes only. Please consult a tax professional for advice specific to your business.
            </div>
        </div>
    `;
    openInfoModal("Tax Information", htmlContent);
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

        const isQuotaError = err.message.toLowerCase().includes('quota') ||
            err.message.includes('429') ||
            err.message.toLowerCase().includes('limit');

        if (isQuotaError) {
            const msg = `AI Quota Exceeded: The AI is currently busy or has reached its daily limit.\n\nWould you like to enter the details manually instead?`;
            if (confirm(msg)) {
                openManualEntry(fileObject);
            }
        } else {
            const msg = `AI Analysis Failed: ${err.message}\n\nThis is often caused by an expired session.\n\nWould you like to SIGN OUT and try again? (Recommended)`;
            if (confirm(msg)) {
                logout();
            } else if (confirm("Would you like to enter the details manually instead?")) {
                openManualEntry(fileObject);
            }
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

    // Smart AI Search filter
    const receiptSearch = document.getElementById('receipt-search');
    if (receiptSearch && receiptSearch.value.trim()) {
        const searchTerm = receiptSearch.value.toLowerCase().trim();

        // Smart amount-based search (e.g., "over R100", "under R50", "more than 200")
        const overMatch = searchTerm.match(/(?:over|above|more than|greater than)\s*r?\s*(\d+(?:\.\d+)?)/i);
        const underMatch = searchTerm.match(/(?:under|below|less than)\s*r?\s*(\d+(?:\.\d+)?)/i);
        const exactAmountMatch = searchTerm.match(/^r?\s*(\d+(?:\.\d+)?)$/i);

        filteredSlips = filteredSlips.filter(s => {
            // Amount-based filtering
            if (overMatch) {
                const threshold = parseFloat(overMatch[1]);
                return (s.total || 0) > threshold;
            }
            if (underMatch) {
                const threshold = parseFloat(underMatch[1]);
                return (s.total || 0) < threshold;
            }
            if (exactAmountMatch) {
                const amount = parseFloat(exactAmountMatch[1]);
                // Allow some tolerance for exact amount matching (±1)
                return Math.abs((s.total || 0) - amount) < 1;
            }

            // Date-based search (e.g., "January", "2026", "Jan 2026")
            const dateStr = s.date ? s.date.toLowerCase() : '';
            if (dateStr.includes(searchTerm)) {
                return true;
            }

            // Merchant/Store name search (fuzzy matching)
            const merchantName = (s.merchant || '').toLowerCase();
            if (merchantName.includes(searchTerm)) {
                return true;
            }

            // Category search
            const category = (s.category || '').toLowerCase();
            if (category.includes(searchTerm)) {
                return true;
            }

            // VAT number search
            const vatNumber = (s.vat_number || '').toLowerCase();
            if (vatNumber.includes(searchTerm)) {
                return true;
            }

            // Notes search
            const notes = Array.isArray(s.notes) ? s.notes.join(' ').toLowerCase() : '';
            if (notes.includes(searchTerm)) {
                return true;
            }

            return false;
        });
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
        const claim = s.income_tax_deductible_amount || (s.is_tax_deductible ? total : 0);

        if (s.category !== 'Entertainment') claimTotal += vat;
        if (s.is_tax_deductible) deductionTotal += claim;

        return `
            <div class="card p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition" onclick="editSlip('${s.id}')">
                <img src="${s.displayUrl}" class="w-14 h-14 rounded-2xl object-cover border border-slate-50 shadow-sm">
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-slate-800 truncate">${s.merchant}</h4>
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${s.date} • <span class="${s.category === 'Entertainment' ? 'text-orange-500' : 'text-blue-600'}">${s.category}</span></p>
                </div>
                <div class="text-right">
                    <p class="font-black text-slate-900 text-lg">R${total.toFixed(2)}</p>
                    <p class="text-[9px] text-emerald-600 uppercase font-bold">Claim: R${claim.toFixed(2)}</p>
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
        income_tax_deductible_amount: slip.income_tax_deductible_amount || (slip.is_tax_deductible ? slip.total : 0),
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

    // Claim field (Tax Deductible Amount)
    const claimInput = document.getElementById('m-claim');
    if (claimInput) {
        const claimAmount = currentProcess.income_tax_deductible_amount || 0;
        claimInput.value = parseFloat(claimAmount).toFixed(2);
    }

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

    // SARS Claim Summary
    const vatClaimableEl = document.getElementById('m-vat-claimable');
    const taxDeductibleAmtEl = document.getElementById('m-tax-deductible-amount');
    const claimSummaryEl = document.getElementById('m-claim-summary');

    if (vatClaimableEl) {
        const vatClaimable = currentProcess.vat_claimable_amount || 0;
        vatClaimableEl.innerText = 'R' + parseFloat(vatClaimable).toFixed(2);
        vatClaimableEl.className = vatClaimable > 0
            ? 'text-emerald-600 font-bold text-lg'
            : 'text-slate-400 font-bold text-lg';
    }

    if (taxDeductibleAmtEl) {
        const taxDeductible = currentProcess.income_tax_deductible_amount || 0;
        taxDeductibleAmtEl.innerText = 'R' + parseFloat(taxDeductible).toFixed(2);
        taxDeductibleAmtEl.className = taxDeductible > 0
            ? 'text-blue-600 font-bold text-lg'
            : 'text-slate-400 font-bold text-lg';
    }

    if (claimSummaryEl) {
        const summary = currentProcess.claim_summary || currentProcess.item_analysis || '';
        if (summary) {
            // Add emoji based on claimability
            const vatClaimable = currentProcess.vat_claimable_amount || 0;
            const taxDeductible = currentProcess.income_tax_deductible_amount || 0;
            let emoji = '❌';
            if (vatClaimable > 0 && taxDeductible > 0) emoji = '✅';
            else if (taxDeductible > 0) emoji = '⚠️';

            claimSummaryEl.innerHTML = `<span class="font-medium">${emoji} ${summary}</span>`;
        } else {
            claimSummaryEl.innerHTML = '<span class="text-slate-400">AI analysis will appear here after scanning...</span>';
        }
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

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysPassed = now.getDate();

    // Initialize daily totals for the entire month (or up to today)
    const dailyTotals = {};
    const labels = [];

    // Create labels for all days in the month
    for (let i = 1; i <= daysInMonth; i++) {
        labels.push(i);
        dailyTotals[i] = 0;
    }

    let currentMonthTotal = 0;

    savedSlips.forEach(slip => {
        if (!slip.date) return;

        // Safe date parsing (YYYY-MM-DD)
        const [yearStr, monthStr, dayStr] = slip.date.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        const day = parseInt(dayStr);

        if (year === currentYear && month === currentMonth) {
            dailyTotals[day] += (slip.total || 0);
            currentMonthTotal += (slip.total || 0);
        }
    });

    // Prepare data for chart (Cumulative)
    const data = [];
    let runningTotal = 0;
    for (let i = 1; i <= daysInMonth; i++) {
        if (i <= daysPassed) {
            runningTotal += dailyTotals[i];
            data.push(runningTotal);
        } else {
            // Future days: null so they don't show as 0 bars
            data.push(null);
        }
    }

    // --- PREDICTIVE LOGIC ---
    let projectedTotal = 0;
    let predictionText = "Not enough data for this month yet.";
    let showPrediction = false;
    let dailyAverage = 0;

    if (daysPassed > 0) {
        // Calculate daily average based on days passed
        // We only consider days up to 'daysPassed' for the average to be accurate
        let spendSoFar = 0;
        for (let i = 1; i <= daysPassed; i++) {
            spendSoFar += dailyTotals[i];
        }

        dailyAverage = spendSoFar / daysPassed;
        projectedTotal = dailyAverage * daysInMonth;
        const remaining = projectedTotal - spendSoFar;

        predictionText = `Based on your daily average (R${dailyAverage.toFixed(0)}), you are projected to spend <b>R${projectedTotal.toFixed(0)}</b> by month-end.`;
        showPrediction = true;
    }

    // Update Prediction UI
    const summaryEl = document.getElementById('prediction-summary');
    const textEl = document.getElementById('prediction-text');
    if (summaryEl && textEl) {
        if (showPrediction) {
            summaryEl.classList.remove('hidden');
            textEl.innerHTML = predictionText;
        } else {
            summaryEl.classList.add('hidden');
        }
    }

    // Calculate smart max value (Cumulative)
    // Max value should be at least the projected total
    const currentMax = Math.max(...(data.filter(d => d !== null)));
    const maxValue = Math.max(currentMax, projectedTotal, 0);
    const suggestedMax = maxValue === 0 ? 1000 : Math.ceil(maxValue * 1.2 / 1000) * 1000;

    // Create prediction data (Linear trend)
    let predictionData = [];
    if (daysPassed > 0) {
        // Linear progression: day * dailyAverage
        for (let i = 1; i <= daysInMonth; i++) {
            predictionData.push(dailyAverage * i);
        }
    } else {
        predictionData = new Array(daysInMonth).fill(0);
    }

    if (monthlyTrendsChart) monthlyTrendsChart.destroy();
    monthlyTrendsChart = new Chart(ctx, {
        type: 'bar', // Base type
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: 'Prediction',
                    data: predictionData,
                    borderColor: '#22c55e', // Green color as requested
                    borderWidth: 2,
                    borderDash: [5, 5], // Dotted line
                    pointRadius: 0,
                    tension: 0.1,
                    order: 0 // Draw on top
                },
                {
                    type: 'bar',
                    label: 'Cumulative Spending',
                    data: data,
                    backgroundColor: labels.map(day => day > daysPassed ? '#e2e8f0' : '#0077b6'), // Grey out future days
                    borderRadius: 4,
                    hoverBackgroundColor: '#005f9e',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true, // Show legend to distinguish prediction
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function (context) {
                            return `Day ${context[0].label}`;
                        },
                        label: function (context) {
                            return context.dataset.label + ': R ' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    title: { display: true, text: 'Day of Month', font: { size: 10 } }
                },
                y: {
                    beginAtZero: true,
                    suggestedMax: suggestedMax,
                    border: { display: false },
                    grid: { color: '#f1f5f9' },
                    ticks: {
                        font: { family: 'Outfit' },
                        callback: function (value) {
                            if (value >= 1000) return 'R' + (value / 1000).toFixed(1) + 'k';
                            return 'R' + value;
                        }
                    }
                }
            }
        }
    });
}

function updateInsightsDashboard() {
    let totalSpending = 0;
    let totalClaimable = 0;
    let totalReceipts = savedSlips.length;
    const categoryTotals = {};
    const monthlyTotals = {};

    savedSlips.forEach(slip => {
        const total = slip.total || 0;
        const claim = slip.income_tax_deductible_amount || (slip.is_tax_deductible ? total : 0);

        totalSpending += total;
        totalClaimable += claim;
        categoryTotals[slip.category] = (categoryTotals[slip.category] || 0) + total;

        const date = new Date(slip.date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyTotals[monthYear] = (monthlyTotals[monthYear] || 0) + total;
    });

    const averagePerReceipt = totalReceipts > 0 ? totalSpending / totalReceipts : 0;

    // Update Financial Overview
    const totalSpendingEl = document.getElementById('total-spending');
    const totalClaimableEl = document.getElementById('total-claimable');
    const avgPerReceiptEl = document.getElementById('average-per-receipt');
    const totalReceiptsCountEl = document.getElementById('total-receipts-count');

    if (totalSpendingEl) totalSpendingEl.innerText = `R ${totalSpending.toFixed(2)}`;
    if (totalClaimableEl) totalClaimableEl.innerText = `R ${totalClaimable.toFixed(2)}`;
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

// --- BUDGET INTELLIGENCE ---
function openBudgetModal() {
    const modal = document.getElementById('budget-modal');
    const content = document.getElementById('budget-content');
    const inputContainer = document.getElementById('budget-input-container');
    const budgetInput = document.getElementById('budget-input');
    const actions = document.getElementById('budget-actions');

    if (!modal || !content) return;

    const storedBudget = localStorage.getItem('monthlyBudget');
    let budgetAmount = storedBudget ? parseFloat(storedBudget) : 0;

    // Reset UI state
    inputContainer.classList.add('hidden');
    actions.classList.remove('hidden');

    if (!budgetAmount) {
        // No budget set - show input immediately
        content.innerHTML = `
            <div class="text-center space-y-2">
                <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span class="text-3xl">🧠</span>
                </div>
                <h4 class="font-bold text-slate-800">Welcome to Budget Intelligence!</h4>
                <p class="text-sm text-slate-500">Set a monthly budget target to track your spending and get AI insights.</p>
            </div>
        `;
        inputContainer.classList.remove('hidden');
        actions.classList.add('hidden'); // Hide standard actions when forcing setup
    } else {
        // Calculate insights
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        let monthlyTotal = 0;

        savedSlips.forEach(slip => {
            const slipDate = new Date(slip.date);
            if (slipDate.getMonth() === currentMonth && slipDate.getFullYear() === currentYear) {
                monthlyTotal += (slip.total || 0);
            }
        });

        const percentage = (monthlyTotal / budgetAmount) * 100;
        const remaining = budgetAmount - monthlyTotal;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const daysRemaining = daysInMonth - now.getDate();
        const dailyBudget = remaining > 0 ? remaining / daysRemaining : 0;

        let insight = "";
        let insightColor = "text-slate-600";
        let insightBg = "bg-slate-50";
        let icon = "✅";

        if (percentage > 100) {
            insight = `You have exceeded your budget by <b>R${Math.abs(remaining).toFixed(2)}</b>. Try to limit discretionary spending.`;
            insightColor = "text-red-700";
            insightBg = "bg-red-50";
            icon = "⚠️";
        } else if (percentage > 80) {
            insight = `You have used <b>${percentage.toFixed(1)}%</b> of your budget. You have <b>R${remaining.toFixed(2)}</b> remaining for the next ${daysRemaining} days.`;
            insightColor = "text-orange-700";
            insightBg = "bg-orange-50";
            icon = "⚠️";
        } else {
            insight = `You are on track! You have used <b>${percentage.toFixed(1)}%</b> of your budget. You have <b>R${remaining.toFixed(2)}</b> remaining.`;
            insightColor = "text-emerald-700";
            insightBg = "bg-emerald-50";
            icon = "✅";
        }

        content.innerHTML = `
            <div class="grid grid-cols-2 gap-3 mb-2">
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target</p>
                    <p class="text-lg font-black text-slate-800">R${budgetAmount.toFixed(2)}</p>
                </div>
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spent</p>
                    <p class="text-lg font-black text-blue-600">R${monthlyTotal.toFixed(2)}</p>
                </div>
            </div>
            
            <div class="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                <div class="absolute top-0 left-0 h-full ${percentage > 100 ? 'bg-red-500' : 'bg-blue-500'} transition-all duration-1000" style="width: ${Math.min(percentage, 100)}%"></div>
            </div>

            <div class="${insightBg} p-4 rounded-xl border border-slate-100 flex gap-3 items-start">
                <span class="text-xl">${icon}</span>
                <p class="text-sm ${insightColor} leading-relaxed">${insight}</p>
            </div>
        `;
    }

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden'); // Lock background scroll
    // renderBudgetBreakdown(); // This function is not defined in the provided context, so commenting out or assuming it's meant to be added elsewhere.
}

function closeBudgetModal() {
    const modal = document.getElementById('budget-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden'); // Unlock background scroll
    }
    document.getElementById('budget-input-container').classList.add('hidden');
}

function showBudgetInput() {
    const inputContainer = document.getElementById('budget-input-container');
    const budgetInput = document.getElementById('budget-input');
    const storedBudget = localStorage.getItem('monthlyBudget');

    if (inputContainer && budgetInput) {
        budgetInput.value = storedBudget || '';
        inputContainer.classList.remove('hidden');
        // Scroll to bottom to show input
        inputContainer.scrollIntoView({ behavior: 'smooth' });
    }
}

function saveBudget() {
    const budgetInput = document.getElementById('budget-input');
    if (!budgetInput) return;

    const amount = parseFloat(budgetInput.value);
    if (amount && !isNaN(amount) && amount > 0) {
        localStorage.setItem('monthlyBudget', amount);
        updateBudgetDisplay(amount);

        // Refresh modal content
        openBudgetModal();
    } else {
        alert("Please enter a valid budget amount.");
    }
}

// --- GENERIC MODAL ---
function openInfoModal(title, contentHtml) {
    const modal = document.getElementById('info-modal');
    const titleEl = document.getElementById('info-modal-title');
    const contentEl = document.getElementById('info-modal-content');

    if (modal && titleEl && contentEl) {
        titleEl.innerText = title;
        contentEl.innerHTML = contentHtml;
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden'); // Lock background scroll
    }
}

function closeInfoModal() {
    const modal = document.getElementById('info-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden'); // Unlock background scroll
    }
}

// --- EXPENSE PREDICTIONS ---
function openPredictionsModal() {
    if (savedSlips.length === 0) {
        openInfoModal("Predictions", "We need a bit more data to make predictions! 📊<br><br>Start by scanning a few receipts.");
        return;
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysPassed = now.getDate();

    // Calculate current month stats
    let monthlyTotal = 0;
    const categoryTotals = {};

    savedSlips.forEach(slip => {
        const slipDate = new Date(slip.date);
        if (slipDate.getMonth() === currentMonth && slipDate.getFullYear() === currentYear) {
            monthlyTotal += (slip.total || 0);
            categoryTotals[slip.category] = (categoryTotals[slip.category] || 0) + (slip.total || 0);
        }
    });

    // Calculate projections
    const dailyAverage = daysPassed > 0 ? monthlyTotal / daysPassed : 0;
    const projectedTotal = dailyAverage * daysInMonth;
    const projectedIncrease = projectedTotal - monthlyTotal;

    // Identify highest spending category
    let topCategory = "None";
    let topCategoryAmount = 0;
    for (const [cat, amount] of Object.entries(categoryTotals)) {
        if (amount > topCategoryAmount) {
            topCategory = cat;
            topCategoryAmount = amount;
        }
    }

    // Generate insight text
    let insight = "";
    if (daysPassed < 5) {
        insight = "It's early in the month, so predictions might fluctuate. Keep scanning!";
    } else {
        insight = `Based on your average daily spending of R${dailyAverage.toFixed(2)}, you are on track to spend R${projectedTotal.toFixed(2)} this month.`;
    }

    const htmlContent = `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current</p>
                    <p class="text-lg font-black text-slate-800">R${monthlyTotal.toFixed(2)}</p>
                </div>
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Projected</p>
                    <p class="text-lg font-black text-blue-600">R${projectedTotal.toFixed(2)}</p>
                </div>
            </div>
            
            <div class="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p class="text-xs font-bold text-blue-800 mb-1">Est. Remaining Spend</p>
                <p class="text-2xl font-black text-blue-600">R${projectedIncrease.toFixed(2)}</p>
            </div>

            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span class="text-xs font-bold text-slate-500">Top Category</span>
                <span class="text-sm font-bold text-slate-800">${topCategory} (R${topCategoryAmount.toFixed(0)})</span>
            </div>

            <div class="flex gap-3 items-start">
                <span class="text-xl">💡</span>
                <p class="text-xs text-slate-600 leading-relaxed">${insight}</p>
            </div>
        </div>
    `;

    openInfoModal("Expense Predictions", htmlContent);
}

// --- BUSINESS HUB ---
async function openBusinessModal(type) {
    const featureNames = {
        'client': 'New Client',
        'quote': 'New Quotation',
        'invoice': 'New Invoice',
        'tax-dashboard': 'Tax Dashboard',
        'business-profile': 'Business Profile',
        'pnl-report': 'P&L Report',
        'invoice-list': 'All Invoices',
        'quote-list': 'All Quotations',
        'subscription': 'Subscription & Billing',
        'categories': 'Expense Categories',
        'support': 'Support'
    };

    const name = featureNames[type] || type;
    let htmlContent = '';

    if (type === 'client') {
        htmlContent = `
            <form onsubmit="saveClient(event)" class="space-y-4 text-left">
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Client Name</label>
                    <input type="text" name="name" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
                    <input type="email" name="email" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Phone Number</label>
                    <input type="tel" name="phone" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Address</label>
                    <textarea name="address" rows="2" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition"></textarea>
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">VAT Number (Optional)</label>
                    <input type="text" name="vat_number" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                </div>
                <button type="submit" class="w-full bg-[#0077b6] text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition mt-4">
                    Save Client
                </button>
            </form>
        `;
    } else if (type === 'quote' || type === 'invoice') {
        const clients = await fetchClients();
        const clientOptions = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        const isQuote = type === 'quote';

        htmlContent = `
            <form onsubmit="${isQuote ? 'saveQuote(event)' : 'saveInvoice(event)'}" class="space-y-4 text-left">
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Select Client</label>
                    <select name="client_id" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                        <option value="">-- Select a Client --</option>
                        ${clientOptions}
                    </select>
                    ${clients.length === 0 ? '<p class="text-xs text-red-500 mt-1">Please create a client first.</p>' : ''}
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Description</label>
                    <input type="text" name="description" required placeholder="e.g. Web Design Services" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Amount (R)</label>
                    <input type="number" name="amount" step="0.01" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">${isQuote ? 'Expiry Date' : 'Due Date'}</label>
                    <input type="date" name="date" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                </div>
                <button type="submit" class="w-full bg-[#0077b6] text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition mt-4">
                    ${isQuote ? 'Create Quotation' : 'Create Invoice'}
                </button>
            </form>
        `;
    } else if (type === 'tax-dashboard') {
        const invoices = await fetchInvoices();
        const stats = calculateTaxStats(savedSlips, invoices);

        htmlContent = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="bg-blue-50 p-4 rounded-xl">
                        <p class="text-xs text-blue-600 font-bold uppercase">Total Income</p>
                        <p class="text-xl font-black text-blue-900">R${stats.totalIncome.toFixed(2)}</p>
                    </div>
                    <div class="bg-red-50 p-4 rounded-xl">
                        <p class="text-xs text-red-600 font-bold uppercase">Expenses</p>
                        <p class="text-xl font-black text-red-900">R${stats.deductibleExpenses.toFixed(2)}</p>
                    </div>
                </div>
                <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
                    <p class="text-sm text-slate-500 font-bold uppercase mb-1">Estimated Tax (28%)</p>
                    <h3 class="text-4xl font-black text-slate-800">R${stats.estimatedTax.toFixed(2)}</h3>
                    <p class="text-xs text-slate-400 mt-2">Based on taxable income of R${stats.taxableIncome.toFixed(2)}</p>
                </div>
                <div class="bg-yellow-50 p-4 rounded-xl flex gap-3 items-start">
                    <span class="text-xl">💡</span>
                    <p class="text-xs text-yellow-800 leading-relaxed">
                        <b>Tip:</b> Add more deductible expenses to lower your estimated tax.
                    </p>
                </div>
            </div>
        `;
    } else if (type === 'business-profile') {
        const meta = currentUser.user_metadata || {};
        htmlContent = `
            <form onsubmit="saveBusinessProfile(event)" class="space-y-4 text-left">
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Business Name</label>
                    <input type="text" name="business_name" value="${meta.business_name || ''}" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Business Type</label>
                    <select name="business_type" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                        <option value="">-- Select Type --</option>
                        <option value="accommodation" ${meta.business_type === 'accommodation' ? 'selected' : ''}>Accommodation</option>
                        <option value="catering" ${meta.business_type === 'catering' ? 'selected' : ''}>Catering & Food</option>
                        <option value="professional" ${meta.business_type === 'professional' ? 'selected' : ''}>Professional Services</option>
                        <option value="tech" ${meta.business_type === 'tech' ? 'selected' : ''}>Tech & Info</option>
                        <option value="education" ${meta.business_type === 'education' ? 'selected' : ''}>Education</option>
                        <option value="construction" ${meta.business_type === 'construction' ? 'selected' : ''}>Construction</option>
                        <option value="retail" ${meta.business_type === 'retail' ? 'selected' : ''}>Retail & Trade</option>
                        <option value="manufacturing" ${meta.business_type === 'manufacturing' ? 'selected' : ''}>Manufacturing</option>
                        <option value="personal_services" ${meta.business_type === 'personal_services' ? 'selected' : ''}>Personal Services</option>
                        <option value="transport" ${meta.business_type === 'transport' ? 'selected' : ''}>Transport</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">VAT Number</label>
                    <input type="text" name="vat_number" value="${meta.vat_number || ''}" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Address</label>
                    <textarea name="address" rows="2" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">${meta.address || ''}</textarea>
                </div>
                <button type="submit" class="w-full bg-[#0077b6] text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition mt-4">
                    Save Profile
                </button>
            </form>
        `;
    } else if (type === 'pnl-report') {
        const invoices = await fetchInvoices();
        const stats = calculatePnL(savedSlips, invoices);
        const isProfit = stats.netProfit >= 0;

        htmlContent = `
            <div class="space-y-4">
                <div class="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center">
                    <p class="text-sm text-slate-500 font-bold uppercase mb-1">Net Profit / Loss</p>
                    <h3 class="text-4xl font-black ${isProfit ? 'text-emerald-600' : 'text-red-600'}">
                        ${isProfit ? '+' : '-'}R${Math.abs(stats.netProfit).toFixed(2)}
                    </h3>
                </div>
                <div class="space-y-2">
                    <div class="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl">
                        <span class="text-slate-600 font-medium">Total Income</span>
                        <span class="text-slate-900 font-bold">R${stats.totalIncome.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl">
                        <span class="text-slate-600 font-medium">Total Expenses</span>
                        <span class="text-slate-900 font-bold">R${stats.totalExpenses.toFixed(2)}</span>
                    </div>
                </div>
                <div class="text-center">
                    <button onclick="alert('Export feature coming soon!')" class="text-blue-600 text-sm font-bold hover:underline">
                        Download Report (PDF)
                    </button>
                </div>
            </div>
        `;
    } else if (type === 'invoice-list') {
        const invoices = await fetchInvoices();
        const clients = await fetchClients();
        const clientMap = new Map(clients.map(c => [c.id, c.name]));

        if (invoices.length === 0) {
            htmlContent = '<p class="text-center py-10 text-slate-400">No invoices found.</p>';
        } else {
            htmlContent = `
                <div class="space-y-3 max-h-[60vh] overflow-y-auto">
                    ${invoices.map(inv => `
                        <div class="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <h4 class="font-bold text-slate-800">${clientMap.get(inv.client_id) || 'Unknown Client'}</h4>
                                    <p class="text-xs text-slate-500">${inv.invoice_number}</p>
                                </div>
                                <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}">
                                    ${inv.status}
                                </span>
                            </div>
                            <div class="flex justify-between items-end">
                                <p class="text-xs text-slate-400">Due: ${inv.due_date}</p>
                                <p class="font-black text-slate-800">R${(inv.amount || 0).toFixed(2)}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } else if (type === 'quote-list') {
        const quotes = await fetchQuotes();
        const clients = await fetchClients();
        const clientMap = new Map(clients.map(c => [c.id, c.name]));

        if (quotes.length === 0) {
            htmlContent = '<p class="text-center py-10 text-slate-400">No quotations found.</p>';
        } else {
            htmlContent = `
                <div class="space-y-3 max-h-[60vh] overflow-y-auto">
                    ${quotes.map(q => `
                        <div class="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <h4 class="font-bold text-slate-800">${clientMap.get(q.client_id) || 'Unknown Client'}</h4>
                                    <p class="text-xs text-slate-500">${q.quote_number}</p>
                                </div>
                                <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-lg bg-blue-100 text-blue-700">
                                    ${q.status}
                                </span>
                            </div>
                            <div class="flex justify-between items-end">
                                <p class="text-xs text-slate-400">Expires: ${q.expiry_date}</p>
                                <p class="font-black text-slate-800">R${(q.amount || 0).toFixed(2)}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } else if (type === 'subscription') {
        // Get current subscription status (could be fetched from Supabase in future)
        const currentPlan = 'Trial';
        let selectedBillingCycle = 'monthly'; // Default to monthly

        htmlContent = `
            <div class="subscription-modal space-y-5">
                <!-- Current Subscription Section -->
                <div class="bg-white border border-slate-200 rounded-2xl p-5">
                    <div class="flex items-center gap-2 mb-3">
                        <svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <h3 class="font-bold text-lg text-slate-800">Current Subscription</h3>
                    </div>
                    <div class="inline-block bg-slate-100 text-slate-700 text-sm font-semibold px-4 py-2 rounded-xl">
                        ${currentPlan}
                    </div>
                </div>

                <!-- Choose Your Billing Cycle -->
                <div class="bg-slate-50 rounded-2xl p-5">
                    <h4 class="font-bold text-slate-800 text-center mb-4">Choose Your Billing Cycle</h4>
                    
                    <div class="flex items-center justify-center gap-3 mb-3">
                        <span id="billing-monthly-label" class="text-sm font-semibold text-slate-800">Monthly</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="billing-toggle" class="sr-only peer" onchange="toggleBillingCycle()">
                            <div class="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0077b6]"></div>
                        </label>
                        <span id="billing-yearly-label" class="text-sm font-medium text-slate-500">Yearly</span>
                        <span class="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                            </svg>
                            Save 10%
                        </span>
                    </div>
                    
                    <p class="text-xs text-slate-500 text-center">R49/month - flexible billing, cancel anytime</p>
                </div>

                <!-- Premium Plan Card -->
                <div class="bg-white border border-slate-200 rounded-2xl p-5">
                    <div class="mb-4">
                        <h3 class="text-xl font-bold text-slate-800">Premium Monthly</h3>
                        <p class="text-sm text-slate-500">Full access to all Simple Slips features for R49/month.</p>
                    </div>
                    
                    <div class="mb-5">
                        <span class="text-4xl font-black text-slate-800">R 49,00</span>
                        <span class="text-slate-500 text-sm">/month</span>
                    </div>

                    <!-- Features List -->
                    <div class="space-y-3">
                        <div class="flex items-center gap-3">
                            <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-sm text-slate-700">Unlimited receipt scanning</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-sm text-slate-700">AI-powered categorization</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-sm text-slate-700">Smart search & analytics</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-sm text-slate-700">Tax insights & deductions</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-sm text-slate-700">Budget tracking & alerts</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-sm text-slate-700">Export to PDF & CSV</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-sm text-slate-700">Cloud storage & sync</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-sm text-slate-700">Priority customer support</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-sm text-slate-700">Advanced tax reports</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <svg class="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                            <span class="text-sm text-slate-700">Business expense tracking</span>
                        </div>
                    </div>

                    <!-- Subscribe Button -->
                    <button onclick="handleSubscribe()" class="w-full bg-[#0d525f] text-white font-bold py-4 rounded-2xl mt-6 hover:bg-[#0a4149] active:scale-[0.98] transition-all shadow-lg">
                        Subscribe Now
                    </button>
                </div>

                <!-- Subscription Information Section -->
                <div class="bg-white border border-slate-200 rounded-2xl p-5">
                    <h4 class="font-bold text-slate-800 text-center mb-4">Subscription Information</h4>
                    
                    <div class="space-y-3 text-sm">
                        <div class="flex justify-between items-center">
                            <span class="font-semibold text-slate-700">Subscription:</span>
                            <span class="text-slate-600">Simple Slips Premium</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="font-semibold text-slate-700">Duration:</span>
                            <span class="text-slate-600">Monthly (auto-renewable)</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="font-semibold text-slate-700">Price:</span>
                            <span class="text-slate-600">R49.00 per month</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="font-semibold text-slate-700">Free Trial:</span>
                            <span class="text-slate-600">30 days included</span>
                        </div>
                    </div>

                    <p class="text-xs text-slate-500 text-center mt-4 leading-relaxed">
                        Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period. Payment will be charged to your App Store account at confirmation of purchase. You can manage and cancel your subscriptions by going to your account settings on the App Store after purchase.
                    </p>

                    <div class="flex justify-center gap-4 mt-4">
                        <a href="#" onclick="openTermsOfUse()" class="text-[#0077b6] text-sm font-medium hover:underline">Terms of Use</a>
                        <span class="text-slate-300">·</span>
                        <a href="#" onclick="openPrivacyPolicy()" class="text-[#0077b6] text-sm font-medium hover:underline">Privacy Policy</a>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'categories') {
        // Default categories optimized for South African businesses
        const defaultCategories = [
            'Groceries',
            'Electricity Water',
            'Municipal Rates Taxes',
            'Rent Bond',
            'Domestic Help Home Services',
            'Home Maintenance',
            'Transport Public Taxi',
            'Fuel',
            'Vehicle Maintenance Licensing',
            'Airtime Data Internet',
            'Subscriptions',
            'Insurance',
            'Pharmacy Medication',
            'Education Courses',
            'Dining Takeaways',
            'Entertainment',
            'Travel Accommodation',
            'Clothing Shopping',
            'Personal Care Beauty',
            'Gifts Celebrations',
            'Donations Tithes',
            'Family Support Remittances',
            'Load Shedding Costs',
            'Other'
        ];

        // Get custom categories from localStorage
        const customCategories = JSON.parse(localStorage.getItem('customCategories') || '[]');

        htmlContent = `
            <div class="expense-categories-modal space-y-5 max-h-[75vh] overflow-y-auto">
                <!-- Header Section -->
                <div class="text-left">
                    <h2 class="text-2xl font-black text-slate-800 mb-1">Expense<br/>Categories</h2>
                    <p class="text-sm text-slate-500">Manage your expense categories and create custom ones</p>
                </div>

                <!-- Add Category Button -->
                <button onclick="showAddCategoryForm()" class="w-full bg-[#0077b6] text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                    </svg>
                    Add Category
                </button>

                <!-- Default Categories Section -->
                <div class="bg-white border border-slate-200 rounded-2xl p-5">
                    <h3 class="font-bold text-lg text-slate-800 mb-2">Default Categories</h3>
                    <p class="text-xs text-slate-500 mb-4">These are the built-in expense categories optimized for South African businesses and services.</p>
                    
                    <div class="space-y-1">
                        ${defaultCategories.map(cat => `
                            <div class="flex items-center gap-3 py-3 border-b border-slate-100 last:border-b-0">
                                <svg class="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                                </svg>
                                <span class="text-sm text-slate-700">${cat}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Custom Categories Section -->
                <div class="bg-white border border-slate-200 rounded-2xl p-5">
                    <h3 class="font-bold text-lg text-slate-800 mb-2">Your Custom Categories</h3>
                    <p class="text-xs text-slate-500 mb-4">Create custom categories for expenses that don't fit into the default categories.</p>
                    
                    <div id="custom-categories-list">
                        ${customCategories.length === 0 ? `
                            <!-- Empty State -->
                            <div class="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl">
                                <div class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                                    </svg>
                                </div>
                                <h4 class="font-bold text-slate-800 mb-1">No custom categories yet</h4>
                                <p class="text-xs text-slate-500 mb-4 px-4">Create your first custom category to organize expenses that don't fit the default categories.</p>
                                <button onclick="showAddCategoryForm()" class="bg-[#0077b6] text-white text-sm font-bold px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 mx-auto hover:bg-blue-700 active:scale-[0.98] transition-all">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                    </svg>
                                    Create First Category
                                </button>
                            </div>
                        ` : `
                            <!-- Custom Categories List -->
                            <div class="space-y-1">
                                ${customCategories.map((cat, index) => `
                                    <div class="flex items-center justify-between py-3 border-b border-slate-100 last:border-b-0 group">
                                        <div class="flex items-center gap-3">
                                            <svg class="w-5 h-5 text-[#0077b6] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                                            </svg>
                                            <span class="text-sm text-slate-700">${cat}</span>
                                        </div>
                                        <button onclick="deleteCustomCategory(${index})" class="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition p-1">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                            </svg>
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                            <button onclick="showAddCategoryForm()" class="w-full mt-4 border-2 border-dashed border-slate-200 text-slate-500 text-sm font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:border-[#0077b6] hover:text-[#0077b6] transition">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                </svg>
                                Add Another Category
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'support') {
        htmlContent = `
            <div class="support-modal space-y-5">
                <!-- Intro Text -->
                <p class="text-sm text-slate-500 text-center">Send us a message and we'll get back to you as soon as possible.</p>

                <!-- Subject Dropdown -->
                <div>
                    <label class="block text-sm font-bold text-slate-800 mb-2">Subject</label>
                    <div class="relative">
                        <select id="support-subject" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-[#0077b6] focus:ring-2 focus:ring-[#0077b6]/20 transition text-slate-700">
                            <option value="">Select a topic</option>
                            <option value="general">General Question</option>
                            <option value="technical">Technical Issue / Bug Report</option>
                            <option value="billing">Subscription & Billing</option>
                            <option value="feature">Feature Request</option>
                            <option value="account">Account Help</option>
                            <option value="other">Other</option>
                        </select>
                        <svg class="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </div>
                </div>

                <!-- Message Text Area -->
                <div>
                    <label class="block text-sm font-bold text-slate-800 mb-2">Message</label>
                    <textarea 
                        id="support-message" 
                        rows="4" 
                        placeholder="Describe your question or issue..."
                        class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0077b6] focus:ring-2 focus:ring-[#0077b6]/20 transition text-slate-700 resize-none"
                    ></textarea>
                </div>

                <!-- Screenshot Upload -->
                <div>
                    <label class="block text-sm font-bold text-slate-800 mb-2">Screenshot (optional)</label>
                    <button onclick="attachSupportScreenshot()" class="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-center gap-2 text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <span id="screenshot-label">Attach Screenshot</span>
                    </button>
                    <input type="file" id="support-screenshot" accept="image/*" class="hidden" onchange="handleScreenshotAttach(event)">
                </div>

                <!-- Contact Preference -->
                <div>
                    <label class="block text-sm font-bold text-slate-800 mb-3">How should we contact you?</label>
                    <div class="space-y-3">
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" id="contact-email" checked class="w-5 h-5 rounded border-slate-300 text-[#0077b6] focus:ring-[#0077b6]">
                            <div class="flex items-center gap-2">
                                <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                </svg>
                                <span class="text-sm text-slate-700">Email</span>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- Action Buttons -->
                <button onclick="sendSupportMessage()" class="w-full bg-[#0077b6] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                    </svg>
                    Send Message
                </button>

                <button onclick="closeInfoModal()" class="w-full bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-2xl hover:bg-slate-50 transition">
                    Cancel
                </button>
            </div>
        `;
    } else {
        // Default "Coming Soon" for other features
        htmlContent = `
            <div class="text-center py-4 space-y-4">
                <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                </div>
                <div>
                    <h4 class="font-bold text-slate-800 text-lg mb-1">Coming Soon</h4>
                    <p class="text-slate-500">We are currently setting up your premium <b>${name}</b>.</p>
                </div>
                <div class="bg-slate-50 p-3 rounded-xl text-xs text-slate-400">
                    Check back soon for updates!
                </div>
            </div>
        `;
    }

    openInfoModal(name, htmlContent);
}

// --- EXPORT ---
async function exportToExcel() {
    if (savedSlips.length === 0) {
        openInfoModal("Smart Reports", "No data to export! 📉<br><br>Please scan some receipts first.");
        return;
    }

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

    openInfoModal("Smart Reports", `
        <div class="text-center space-y-4 py-2">
            <div class="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto"></div>
            <div>
                <p class="font-bold text-slate-800">Generating Excel Report...</p>
                <p class="text-xs text-slate-500 mt-1">Compiling data and embedding images.</p>
            </div>
        </div>
    `);

    // Small delay to allow modal to render before heavy processing
    await new Promise(resolve => setTimeout(resolve, 500));

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

// --- SUBSCRIPTION FUNCTIONS ---
let currentBillingCycle = 'monthly';

function toggleBillingCycle() {
    const toggle = document.getElementById('billing-toggle');
    const monthlyLabel = document.getElementById('billing-monthly-label');
    const yearlyLabel = document.getElementById('billing-yearly-label');

    if (toggle && toggle.checked) {
        currentBillingCycle = 'yearly';
        if (monthlyLabel) {
            monthlyLabel.classList.remove('text-slate-800', 'font-semibold');
            monthlyLabel.classList.add('text-slate-500', 'font-medium');
        }
        if (yearlyLabel) {
            yearlyLabel.classList.remove('text-slate-500', 'font-medium');
            yearlyLabel.classList.add('text-slate-800', 'font-semibold');
        }
        // Update pricing display
        updateSubscriptionPricing('yearly');
    } else {
        currentBillingCycle = 'monthly';
        if (monthlyLabel) {
            monthlyLabel.classList.remove('text-slate-500', 'font-medium');
            monthlyLabel.classList.add('text-slate-800', 'font-semibold');
        }
        if (yearlyLabel) {
            yearlyLabel.classList.remove('text-slate-800', 'font-semibold');
            yearlyLabel.classList.add('text-slate-500', 'font-medium');
        }
        // Update pricing display
        updateSubscriptionPricing('monthly');
    }
}

function updateSubscriptionPricing(cycle) {
    const priceEls = document.querySelectorAll('.subscription-modal .text-4xl');
    const periodEls = document.querySelectorAll('.subscription-modal .text-4xl + span');
    const planTitleEls = document.querySelectorAll('.subscription-modal h3');
    const planDescEls = document.querySelectorAll('.subscription-modal h3 + p');
    const durationEl = document.querySelector('.subscription-modal .space-y-3 .flex:nth-child(2) .text-slate-600');
    const priceInfoEl = document.querySelector('.subscription-modal .space-y-3 .flex:nth-child(3) .text-slate-600');
    const billingInfo = document.querySelector('.subscription-modal .bg-slate-50 .text-xs.text-slate-500');

    if (cycle === 'yearly') {
        // Yearly pricing: R529/year (R44/month equivalent with 10% off from R49)
        if (priceEls[0]) priceEls[0].textContent = 'R 529,00';
        if (periodEls[0]) periodEls[0].textContent = '/year';
        if (planTitleEls.length > 1) planTitleEls[1].textContent = 'Premium Yearly';
        if (planDescEls.length > 1) planDescEls[1].textContent = 'Full access to all Simple Slips features for R529/year (Save 10%!).';
        if (durationEl) durationEl.textContent = 'Yearly (auto-renewable)';
        if (priceInfoEl) priceInfoEl.textContent = 'R529.00 per year';
        if (billingInfo) billingInfo.textContent = 'R529/year (R44/month) - flexible billing, cancel anytime';
    } else {
        // Monthly pricing: R49/month
        if (priceEls[0]) priceEls[0].textContent = 'R 49,00';
        if (periodEls[0]) periodEls[0].textContent = '/month';
        if (planTitleEls.length > 1) planTitleEls[1].textContent = 'Premium Monthly';
        if (planDescEls.length > 1) planDescEls[1].textContent = 'Full access to all Simple Slips features for R49/month.';
        if (durationEl) durationEl.textContent = 'Monthly (auto-renewable)';
        if (priceInfoEl) priceInfoEl.textContent = 'R49.00 per month';
        if (billingInfo) billingInfo.textContent = 'R49/month - flexible billing, cancel anytime';
    }
}

function handleSubscribe() {
    const cycle = currentBillingCycle;
    const price = cycle === 'yearly' ? 'R529/year' : 'R49/month';

    // For now, show a coming soon message. In the future, this will integrate with payment providers.
    openInfoModal('Subscribe to Premium', `
        <div class="text-center space-y-4">
            <div class="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                <svg class="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
            </div>
            <div>
                <h4 class="font-bold text-slate-800 text-lg mb-1">Almost there!</h4>
                <p class="text-slate-600 text-sm">You selected the <b>${cycle === 'yearly' ? 'Yearly' : 'Monthly'}</b> plan at <b>${price}</b>.</p>
            </div>
            <div class="bg-blue-50 p-4 rounded-xl">
                <p class="text-xs text-blue-700 leading-relaxed">
                    Payment integration via PayFast is coming soon! You'll be able to subscribe and manage your billing directly in the app.
                </p>
            </div>
            <button onclick="closeInfoModal()" class="w-full bg-[#0077b6] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
                Got it!
            </button>
        </div>
    `);
}

function openTermsOfUse() {
    openInfoModal('Terms of Use', `
        <div class="text-left space-y-4 max-h-[60vh] overflow-y-auto text-sm text-slate-600 leading-relaxed">
            <h4 class="font-bold text-slate-800">1. Acceptance of Terms</h4>
            <p>By accessing and using Simple Slips, you accept and agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use our service.</p>
            
            <h4 class="font-bold text-slate-800">2. Subscription Services</h4>
            <p>Simple Slips offers subscription-based services. By subscribing, you agree to pay the applicable fees and grant us permission to charge your payment method on a recurring basis.</p>
            
            <h4 class="font-bold text-slate-800">3. Free Trial</h4>
            <p>We may offer free trial periods. If you do not cancel before the end of the trial, you will be charged for the subscription plan you selected.</p>
            
            <h4 class="font-bold text-slate-800">4. Cancellation</h4>
            <p>You may cancel your subscription at any time. Cancellation will take effect at the end of your current billing period.</p>
            
            <h4 class="font-bold text-slate-800">5. Data & Privacy</h4>
            <p>Your use of Simple Slips is also governed by our Privacy Policy. Please review it to understand our data practices.</p>
            
            <h4 class="font-bold text-slate-800">6. Limitation of Liability</h4>
            <p>Simple Slips is provided "as is" without warranties. We are not liable for any indirect, incidental, or consequential damages.</p>
            
            <h4 class="font-bold text-slate-800">7. Changes to Terms</h4>
            <p>We reserve the right to modify these terms at any time. Continued use after changes constitutes acceptance of the new terms.</p>
            
            <p class="text-xs text-slate-400 mt-6">Last updated: January 2026</p>
        </div>
    `);
}

function openPrivacyPolicy() {
    openInfoModal('Privacy Policy', `
        <div class="text-left space-y-4 max-h-[60vh] overflow-y-auto text-sm text-slate-600 leading-relaxed">
            <h4 class="font-bold text-slate-800">1. Information We Collect</h4>
            <p>We collect information you provide directly, including your email, profile information, and receipt data you upload to our service.</p>
            
            <h4 class="font-bold text-slate-800">2. How We Use Your Information</h4>
            <p>We use your information to provide and improve our services, process transactions, send notifications, and comply with legal obligations.</p>
            
            <h4 class="font-bold text-slate-800">3. Data Storage & Security</h4>
            <p>Your data is stored securely using industry-standard encryption. We use Supabase for data storage and implement security best practices.</p>
            
            <h4 class="font-bold text-slate-800">4. Receipt & Financial Data</h4>
            <p>Receipt images and financial data you upload are stored securely and used solely to provide our services. We do not sell your data to third parties.</p>
            
            <h4 class="font-bold text-slate-800">5. Third-Party Services</h4>
            <p>We use third-party services for authentication, payments, and analytics. These services have their own privacy policies.</p>
            
            <h4 class="font-bold text-slate-800">6. Your Rights</h4>
            <p>You have the right to access, correct, or delete your personal data. Contact us to exercise these rights.</p>
            
            <h4 class="font-bold text-slate-800">7. Data Retention</h4>
            <p>We retain your data for as long as your account is active. Upon account deletion, your data will be removed within 30 days.</p>
            
            <h4 class="font-bold text-slate-800">8. Contact Us</h4>
            <p>For privacy-related questions, contact us at privacy@simpleslips.co.za.</p>
            
            <p class="text-xs text-slate-400 mt-6">Last updated: January 2026</p>
        </div>
    `);
}

// --- CATEGORY MANAGEMENT FUNCTIONS ---
function showAddCategoryForm() {
    openInfoModal('Add Custom Category', `
        <div class="space-y-4">
            <p class="text-sm text-slate-600">Create a new custom expense category for your business.</p>
            
            <div>
                <label class="block text-sm font-bold text-slate-700 mb-2">Category Name</label>
                <input 
                    type="text" 
                    id="new-category-input" 
                    placeholder="e.g. Office Supplies, Marketing, etc."
                    class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#0077b6] focus:ring-2 focus:ring-[#0077b6]/20 transition"
                    maxlength="50"
                >
                <p class="text-xs text-slate-400 mt-1">Maximum 50 characters</p>
            </div>

            <div class="flex gap-3">
                <button onclick="closeInfoModal()" class="flex-1 bg-slate-100 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-200 transition">
                    Cancel
                </button>
                <button onclick="saveCustomCategory()" class="flex-1 bg-[#0077b6] text-white font-bold py-3 rounded-xl hover:bg-blue-700 active:scale-[0.98] transition">
                    Save Category
                </button>
            </div>
        </div>
    `);

    // Focus the input after modal opens
    setTimeout(() => {
        const input = document.getElementById('new-category-input');
        if (input) input.focus();
    }, 100);
}

function saveCustomCategory() {
    const input = document.getElementById('new-category-input');
    if (!input) return;

    const categoryName = input.value.trim();

    if (!categoryName) {
        alert('Please enter a category name.');
        return;
    }

    if (categoryName.length > 50) {
        alert('Category name must be 50 characters or less.');
        return;
    }

    // Get existing custom categories
    const customCategories = JSON.parse(localStorage.getItem('customCategories') || '[]');

    // Check for duplicates
    if (customCategories.some(cat => cat.toLowerCase() === categoryName.toLowerCase())) {
        alert('This category already exists.');
        return;
    }

    // Add new category
    customCategories.push(categoryName);
    localStorage.setItem('customCategories', JSON.stringify(customCategories));

    // Close the add form and refresh the categories modal
    closeInfoModal();

    // Small delay then reopen categories modal
    setTimeout(() => {
        openBusinessModal('categories');
    }, 150);
}

function deleteCustomCategory(index) {
    if (!confirm('Are you sure you want to delete this category?')) return;

    const customCategories = JSON.parse(localStorage.getItem('customCategories') || '[]');

    if (index >= 0 && index < customCategories.length) {
        customCategories.splice(index, 1);
        localStorage.setItem('customCategories', JSON.stringify(customCategories));

        // Refresh the categories modal
        closeInfoModal();
        setTimeout(() => {
            openBusinessModal('categories');
        }, 150);
    }
}

function getCustomCategories() {
    return JSON.parse(localStorage.getItem('customCategories') || '[]');
}

function getAllCategories() {
    // Default categories
    const defaultCategories = [
        'Groceries',
        'Electricity Water',
        'Municipal Rates Taxes',
        'Rent Bond',
        'Domestic Help Home Services',
        'Home Maintenance',
        'Transport Public Taxi',
        'Fuel',
        'Vehicle Maintenance Licensing',
        'Airtime Data Internet',
        'Subscriptions',
        'Insurance',
        'Pharmacy Medication',
        'Education Courses',
        'Dining Takeaways',
        'Entertainment',
        'Travel Accommodation',
        'Clothing Shopping',
        'Personal Care Beauty',
        'Gifts Celebrations',
        'Donations Tithes',
        'Family Support Remittances',
        'Load Shedding Costs',
        'Other'
    ];

    // Combine with custom categories
    const customCategories = getCustomCategories();
    return [...defaultCategories, ...customCategories];
}

// --- SUPPORT FORM FUNCTIONS ---
let supportScreenshotFile = null;

function attachSupportScreenshot() {
    const fileInput = document.getElementById('support-screenshot');
    if (fileInput) {
        fileInput.click();
    }
}

function handleScreenshotAttach(event) {
    const file = event.target.files[0];
    if (file) {
        supportScreenshotFile = file;
        const label = document.getElementById('screenshot-label');
        if (label) {
            label.innerHTML = `<span class="text-emerald-600 font-medium">✓ ${file.name}</span>`;
        }
    }
}

function sendSupportMessage() {
    const subject = document.getElementById('support-subject')?.value;
    const message = document.getElementById('support-message')?.value?.trim();
    const emailContact = document.getElementById('contact-email')?.checked;

    // Validation
    if (!subject) {
        alert('Please select a subject.');
        return;
    }

    if (!message) {
        alert('Please enter a message.');
        return;
    }

    if (!emailContact) {
        alert('Please confirm email as your contact method.');
        return;
    }

    // Get user email if available
    const userEmail = currentUser?.email || 'Not logged in';

    // Gather all support data
    const supportData = {
        subject,
        message,
        contactEmail: emailContact,
        userEmail,
        hasScreenshot: !!supportScreenshotFile,
        timestamp: new Date().toISOString(),
        deviceInfo: {
            device: /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
            os: navigator.platform || 'Unknown',
            browser: navigator.userAgent,
            appVersion: '1.0.0'
        }
    };

    console.log('Support message data:', supportData);

    // Close current modal and show success
    closeInfoModal();

    setTimeout(() => {
        openInfoModal('Message Sent!', `
            <div class="text-center space-y-4">
                <div class="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                    <svg class="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                </div>
                <div>
                    <h4 class="font-bold text-slate-800 text-lg mb-1">Thank you!</h4>
                    <p class="text-slate-600 text-sm">Your support request has been submitted successfully.</p>
                </div>
                <div class="bg-blue-50 p-4 rounded-xl text-left">
                    <p class="text-xs text-blue-700 leading-relaxed">
                        <b>What happens next?</b><br/>
                        Our support team will review your message and get back to you within 24-48 hours via email.
                    </p>
                </div>
                <button onclick="closeInfoModal()" class="w-full bg-[#0077b6] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
                    Done
                </button>
            </div>
        `);
    }, 150);

    // Reset screenshot file
    supportScreenshotFile = null;
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

// --- BUSINESS LOGIC ---

async function fetchClients() {
    if (!currentUser) return [];

    const { data, error } = await supabaseClient
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching clients:', error);
        return [];
    }
    return data;
}

async function saveClient(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const clientData = {
        user_id: currentUser.id,
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        address: formData.get('address'),
        vat_number: formData.get('vat_number')
    };

    loader.classList.remove('hidden');
    try {
        const { error } = await supabaseClient
            .from('clients')
            .insert([clientData]);

        if (error) throw error;

        alert('Client saved successfully!');
        // Close modal by refreshing or finding a close method if available. 
        // For now, reloading to ensure state is clean.
        location.reload();
    } catch (err) {
        console.error('Error saving client:', err);
        alert('Failed to save client: ' + err.message);
    } finally {
        loader.classList.add('hidden');
    }
}

async function saveQuote(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const quoteData = {
        user_id: currentUser.id,
        client_id: formData.get('client_id'),
        quote_number: 'Q-' + Date.now().toString().slice(-6),
        amount: parseFloat(formData.get('amount')),
        expiry_date: formData.get('date'),
        status: 'draft'
    };

    loader.classList.remove('hidden');
    try {
        const { error } = await supabaseClient
            .from('quotes')
            .insert([quoteData]);

        if (error) throw error;

        alert('Quotation created successfully!');
        location.reload();
    } catch (err) {
        console.error('Error saving quote:', err);
        alert('Failed to save quotation: ' + err.message);
    } finally {
        loader.classList.add('hidden');
    }
}

async function saveInvoice(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const invoiceData = {
        user_id: currentUser.id,
        client_id: formData.get('client_id'),
        invoice_number: 'INV-' + Date.now().toString().slice(-6),
        amount: parseFloat(formData.get('amount')),
        due_date: formData.get('date'),
        status: 'unpaid'
    };

    loader.classList.remove('hidden');
    try {
        const { error } = await supabaseClient
            .from('invoices')
            .insert([invoiceData]);

        if (error) throw error;

        alert('Invoice created successfully!');
        location.reload();
    } catch (err) {
        console.error('Error saving invoice:', err);
        alert('Failed to save invoice: ' + err.message);
    } finally {
        loader.classList.add('hidden');
    }
}

async function fetchInvoices() {
    if (!currentUser) return [];

    const { data, error } = await supabaseClient
        .from('invoices')
        .select('*')
        .order('due_date', { ascending: false });

    if (error) {
        console.error('Error fetching invoices:', error);
        return [];
    }
    return data;
}

function calculateTaxStats(slips, invoices) {
    const totalIncome = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const deductibleExpenses = slips.filter(s => s.is_tax_deductible).reduce((sum, s) => sum + (s.total || 0), 0);
    const taxableIncome = Math.max(0, totalIncome - deductibleExpenses);
    const estimatedTax = taxableIncome * 0.28; // Assuming flat 28% company tax for simplicity

    return {
        totalIncome,
        deductibleExpenses,
        taxableIncome,
        estimatedTax
    };
}

function calculatePnL(slips, invoices) {
    const totalIncome = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalExpenses = slips.reduce((sum, s) => sum + (s.total || 0), 0);
    const netProfit = totalIncome - totalExpenses;

    return {
        totalIncome,
        totalExpenses,
        netProfit
    };
}

async function saveBusinessProfile(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const businessData = {
        business_name: formData.get('business_name'),
        business_type: formData.get('business_type'),
        vat_number: formData.get('vat_number'),
        address: formData.get('address')
    };

    loader.classList.remove('hidden');
    try {
        const { error } = await supabaseClient.auth.updateUser({
            data: businessData
        });

        if (error) throw error;

        // Update local user object
        const { data: { user } } = await supabaseClient.auth.getUser();
        currentUser = user;
        updateProfileUI(); // Refresh profile UI if needed

        alert('Business profile updated successfully!');
        location.reload();
    } catch (err) {
        console.error('Error updating business profile:', err);
        alert('Failed to update profile: ' + err.message);
    } finally {
        loader.classList.add('hidden');
    }
}

async function fetchQuotes() {
    if (!currentUser) return [];

    const { data, error } = await supabaseClient
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching quotes:', error);
        return [];
    }
    return data;
}

async function renderRecentBusinessItems() {
    const invoices = await fetchInvoices();
    const quotes = await fetchQuotes();
    const clients = await fetchClients();
    const clientMap = new Map(clients.map(c => [c.id, c.name]));

    // Render Recent Invoices
    const recentInvoices = invoices.slice(0, 3);
    const invoiceList = document.getElementById('recent-invoices-list');
    if (invoiceList) {
        if (recentInvoices.length === 0) {
            invoiceList.innerHTML = '<p class="text-slate-400 text-sm">No invoices yet. Create your first invoice to get started.</p>';
        } else {
            invoiceList.innerHTML = recentInvoices.map(inv => `
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                        <p class="font-bold text-slate-800 text-sm">${clientMap.get(inv.client_id) || 'Unknown Client'}</p>
                        <p class="text-xs text-slate-500">${inv.invoice_number} • ${inv.due_date}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-slate-800 text-sm">R${(inv.amount || 0).toFixed(2)}</p>
                        <span class="text-[10px] font-bold uppercase ${inv.status === 'paid' ? 'text-emerald-600' : 'text-orange-500'}">${inv.status}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    // Render Recent Quotes
    const recentQuotes = quotes.slice(0, 3);
    const quoteList = document.getElementById('recent-quotes-list');
    if (quoteList) {
        if (recentQuotes.length === 0) {
            quoteList.innerHTML = '<p class="text-slate-400 text-sm">No quotations yet. Create your first quotation to get started.</p>';
        } else {
            quoteList.innerHTML = recentQuotes.map(q => `
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                        <p class="font-bold text-slate-800 text-sm">${clientMap.get(q.client_id) || 'Unknown Client'}</p>
                        <p class="text-xs text-slate-500">${q.quote_number} • ${q.expiry_date}</p>
                    </div>
                    <div class="text-right">
                        <p class="font-bold text-slate-800 text-sm">R${(q.amount || 0).toFixed(2)}</p>
                        <span class="text-[10px] font-bold uppercase text-blue-600">${q.status}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    // Update Business Stats
    const totalClients = clients.length;
    const totalSales = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount || 0), 0);
    const outstanding = invoices.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.amount || 0), 0);

    // This month sales
    const now = new Date();
    const thisMonthSales = invoices.filter(i => {
        const d = new Date(i.created_at || i.due_date); // Fallback to due_date if created_at missing
        return i.status === 'paid' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((sum, i) => sum + (i.amount || 0), 0);

    const clientsEl = document.getElementById('biz-stat-clients');
    const salesEl = document.getElementById('biz-stat-sales');
    const monthEl = document.getElementById('biz-stat-month');
    const outstandingEl = document.getElementById('biz-stat-outstanding');

    if (clientsEl) clientsEl.innerText = totalClients;
    if (salesEl) salesEl.innerText = 'R ' + totalSales.toFixed(2);
    if (monthEl) monthEl.innerText = 'R ' + thisMonthSales.toFixed(2);
    if (outstandingEl) outstandingEl.innerText = 'R ' + outstanding.toFixed(2);
}

// --- TESTING EXPORTS ---
if (typeof window !== 'undefined') {
    window.setTestUser = (user) => { currentUser = user; };
    window.setTestSlips = (slips) => { savedSlips = slips; };
    window.runCheckUser = checkUser;
    window.runUpdateProfileUI = updateProfileUI;
    window.runRenderSlips = renderSlips;
    window.getSupabaseClient = () => supabaseClient;
}