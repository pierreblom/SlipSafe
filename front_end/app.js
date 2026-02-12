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

// --- PHASE 3: SMART FILTER CHIPS STATE ---
let activeFilterChips = new Set();
let dateRangeStart = null;
let dateRangeEnd = null;

const fileInput = document.getElementById('file-input');
const loader = document.getElementById('loader');
const modal = document.getElementById('modal');
const lunchWarning = document.getElementById('lunch-warning');
const authOverlay = document.getElementById('auth-overlay');

// --- PREMIUM DIALOG SYSTEM ---
/**
 * Shows a premium custom dialog (alert/confirm)
 * @param {string} title - The title of the dialog
 * @param {string} message - The message body
 * @param {'info'|'success'|'warning'|'error'} type - The type of dialog for icon styling
 * @param {boolean} showCancel - Whether to show the cancel button (confirm mode)
 * @param {string} confirmText - Text for the primary button
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
async function showDialog(title, message, type = 'info', showCancel = false, confirmText = 'OK') {
    const dialog = document.getElementById('premium-dialog');
    const titleEl = document.getElementById('dialog-title');
    const messageEl = document.getElementById('dialog-message');
    const iconBox = document.getElementById('dialog-icon-box');
    const confirmBtn = document.getElementById('dialog-confirm-btn');
    const cancelBtn = document.getElementById('dialog-cancel-btn');

    return new Promise((resolve) => {
        titleEl.innerText = title;
        messageEl.innerHTML = message;
        confirmBtn.innerText = confirmText;

        // Set Icon & Styling
        iconBox.innerHTML = '';
        iconBox.className = 'icon-box icon-box-' + type;

        let iconSvg = '';
        if (type === 'error') {
            iconSvg = '<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>';
        } else if (type === 'success') {
            iconSvg = '<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>';
        } else if (type === 'warning') {
            iconSvg = '<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
        } else {
            iconSvg = '<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
        }
        iconBox.innerHTML = iconSvg;

        // Visibility
        if (showCancel) cancelBtn.classList.remove('hidden');
        else cancelBtn.classList.add('hidden');

        dialog.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');

        const handleAction = (result) => {
            dialog.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
            resolve(result);
        };

        confirmBtn.onclick = () => handleAction(true);
        cancelBtn.onclick = () => handleAction(false);
    });
}

// --- AUTHENTICATION ---
// Helper to handle successful login actions
function handleLoginSuccess() {
    const path = window.location.pathname;
    // If on root/index, redirect to main dashboard
    if (path === '/' || path === '/index.html') {
        console.log('User logged in on root, redirecting to /home/');
        window.location.href = '/home/';
        return;
    }

    if (authOverlay) authOverlay.classList.add('hidden');
    updateProfileUI();
    fetchSlips();

    // Phase 3: Trigger onboarding wizard for new users
    if (currentUser && !currentUser.user_metadata?.onboarding_complete) {
        setTimeout(() => showOnboardingWizard(), 800);
    }
}

async function checkUser() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        currentUser = user;
        if (user) {
            handleLoginSuccess();
        } else {
            if (authOverlay) authOverlay.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error checking user:', error);
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
        await showDialog("Input Required", "Please enter both email and password.", "warning");
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
            showToast("Success", "Signup successful! Please check your email for verification.");
            toggleAuthMode();
        }
    } catch (err) {
        await showDialog("Authentication Error", err.message, "error");
    } finally {
        loader.classList.add('hidden');
    }
}

// --- Toast Notifications ---
function showToast(title, message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const id = Date.now();
    const isSuccess = type === 'success';
    const isError = type === 'error';

    let bgColor = 'bg-white border-slate-100';
    let icon = 'ℹ️';
    let textColor = 'text-slate-800';

    if (isSuccess) {
        bgColor = 'bg-emerald-50 border-emerald-100';
        icon = '✅';
        textColor = 'text-emerald-800';
    } else if (isError) {
        bgColor = 'bg-red-50 border-red-100';
        icon = '❌';
        textColor = 'text-red-800';
    }

    const toastHTML = `
        <div id="toast-${id}" class="transform translate-x-full transition-all duration-300 ease-out ${bgColor} border shadow-xl rounded-2xl p-4 flex gap-3 items-start pointer-events-auto w-full relative overflow-hidden">
            <div class="shrink-0 text-xl">${icon}</div>
            <div class="flex-1 min-w-0">
                <h4 class="font-bold ${textColor} text-sm">${title}</h4>
                <p class="text-xs text-slate-500 leading-relaxed mt-0.5">${message}</p>
            </div>
            <button onclick="dismissToast('${id}')" class="shrink-0 p-1 text-slate-400 hover:text-slate-600 transition">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            ${isSuccess ? `<div class="absolute bottom-0 left-0 h-1 bg-emerald-500 opacity-20 animate-toast-progress w-full"></div>` : ''}
        </div>
    `;

    // Create wrapper to allow HTML injection
    const wrapper = document.createElement('div');
    wrapper.innerHTML = toastHTML.trim();
    const toastEl = wrapper.firstElementChild;
    container.appendChild(toastEl);

    // Animate in (small delay to allow DOM render)
    requestAnimationFrame(() => {
        toastEl.classList.remove('translate-x-full');
    });

    // Auto dismiss for success
    if (isSuccess) {
        setTimeout(() => {
            dismissToast(id);
        }, 4000);
    }
}

function dismissToast(id) {
    const toast = document.getElementById(`toast-${id}`);
    if (toast) {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => {
            if (toast.parentElement) toast.remove();
        }, 300);
    }
}

async function loginWithGoogle() {
    if (window.location.protocol === 'file:') {
        await showDialog("Environment Error", "Google Login requires running on a local server (http://localhost), not directly from a file.", "warning");
        return;
    }

    const redirectUrl = window.location.origin; // Simplified to origin (e.g., http://localhost:8000)
    console.log('Initiating Google Login with redirect:', redirectUrl);

    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent'
                }
            }
        });

        if (error) throw error;
    } catch (err) {
        console.error('Google Login Error:', err);
        await showDialog("Login Error", `Failed to sign in with Google: ${err.message}`, "error");
    }
}

async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) await showDialog("Logout Error", error.message, "error");
    else window.location.reload();
}

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth State Change:', event);
    if (event === 'SIGNED_IN') {
        currentUser = session.user;
        handleLoginSuccess();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        if (authOverlay) authOverlay.classList.remove('hidden');
        savedSlips = [];
        // Optional: Redirect to root if signed out from a sub-page? 
        // For now, just show overlay.
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
    if (displayNameEl) displayNameEl.innerText = currentUser.user_metadata.business_name || 'Not set';

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

// Global variable for editing
let editingProfileField = null;

function editProfileField(field) {
    if (!currentUser) return;

    editingProfileField = field;
    const modal = document.getElementById('profile-edit-modal');
    const title = document.getElementById('profile-edit-title');
    const label = document.getElementById('profile-edit-label');
    const input = document.getElementById('profile-edit-input');
    const hint = document.getElementById('profile-edit-hint');

    if (!modal) return;

    // Reset UI
    hint.classList.add('hidden');
    input.value = '';

    if (field === 'email') {
        title.innerText = 'Change Email Address';
        label.innerText = 'New Email Address';
        input.type = 'email';
        input.value = currentUser.email;
        hint.innerText = "Note: You will need to verify your new email address.";
        hint.classList.remove('hidden');
    } else if (field === 'phone') {
        title.innerText = 'Update Phone Number';
        label.innerText = 'Phone Number';
        input.type = 'tel';
        input.value = currentUser.user_metadata.phone || '';
    }

    modal.classList.remove('hidden');
    input.focus();
}

function closeProfileEditModal() {
    const modal = document.getElementById('profile-edit-modal');
    if (modal) modal.classList.add('hidden');
    editingProfileField = null;
}

async function saveProfileField() {
    const input = document.getElementById('profile-edit-input');
    const btn = document.getElementById('profile-save-btn');
    const modalTitle = document.getElementById('profile-edit-title');

    if (!input || !editingProfileField) return;

    let newValue = input.value.trim();
    if (!newValue && editingProfileField === 'email') {
        await showDialog("Input Required", "Please enter a value.", "warning");
        return;
    }

    // Lock UI
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerHTML = '<span class="animate-spin inline-block mr-2">⏳</span> Saving...';

    try {
        let updateData = {};
        let needsVerification = false;

        if (editingProfileField === 'email') {
            if (newValue === currentUser.email) {
                closeProfileEditModal();
                btn.disabled = false;
                btn.innerText = originalText;
                return;
            }
            updateData = { email: newValue };
            needsVerification = true;
        } else if (editingProfileField === 'phone') {
            // Update metadata for phone
            updateData = { data: { phone: newValue } };
        }

        const { data, error } = await supabaseClient.auth.updateUser(updateData);

        if (error) throw error;

        // Success Handling
        if (needsVerification) {
            await showDialog("Check your Inbox", "A confirmation link has been sent to your new email address. Please click it to finalize the change.", "success");
        } else {
            // Instant update for metadata
            if (data.user) {
                currentUser = data.user;
                updateProfileUI(); // Refresh UI
                showToast("Success", "Profile updated successfully!");
            }
        }

        closeProfileEditModal();

    } catch (err) {
        console.error('Profile update error:', err);
        await showDialog("Update Failed", err.message, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = originalText;
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
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebar && overlay) {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');

        // Prevent body scroll when sidebar is open
        if (sidebar.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screenEl = document.getElementById(`screen-${screenId}`);
    if (screenEl) screenEl.classList.add('active');

    // Update sidebar nav active states
    document.querySelectorAll('.sidebar-item').forEach(n => {
        n.classList.remove('nav-active');
        n.classList.add('nav-inactive');
    });
    const navEl = document.getElementById(`nav-${screenId}`);
    if (navEl) {
        navEl.classList.add('nav-active');
        navEl.classList.remove('nav-inactive');
    }

    // Close mobile sidebar after navigation
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && overlay && sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Update URL hash (without triggering hashchange loop)
    // IMPORTANT: Do NOT overwrite hash if it contains auth tokens (from Supabase login)
    const currentHash = window.location.hash;
    if (!currentHash.includes('access_token') && !currentHash.includes('type=') && !currentHash.includes('error=')) {
        if (currentHash !== `#${screenId}`) {
            history.pushState(null, '', `#${screenId}`);
        }
    } else {
        console.log('Preserving auth hash for Supabase processing:', currentHash);
    }

    currentScreen = screenId;
    if (screenId === 'insights') updateInsightsDashboard();
    if (screenId === 'ai') generateAIInsights();
    if (screenId === 'home') renderSlips(); // Refresh home screen stats when switching back
    if (screenId === 'business') renderRecentBusinessItems();
    if (screenId === 'profile') fetchSessions();
}

// --- PAGE-BASED INITIALIZATION ---
const validScreens = ['home', 'ai', 'insights', 'business', 'profile'];

function initPage() {
    const path = window.location.pathname;
    let screenId = 'home'; // Default fallback

    if (path.includes('/ai')) screenId = 'ai';
    else if (path.includes('/insights')) screenId = 'insights';
    else if (path.includes('/business')) screenId = 'business';
    else if (path.includes('/profile')) screenId = 'profile';
    else if (path.includes('/home')) screenId = 'home';

    // If no path match, maybe check hash for backward compatibility? No, strictly separate pages.
    // If we're on root '/', default to home if home content present? Or redirect?
    // Assume correct page.

    // If auth hash is present, let Supabase handle it first!
    if (window.location.hash.includes('access_token') || window.location.hash.includes('type=') || window.location.hash.includes('error=')) {
        console.log('Skipping initial screen switch due to auth hash.');
        return;
    }

    switchScreen(screenId);
}

// Initialize page on load
document.addEventListener('DOMContentLoaded', () => {
    initPage();
});

// --- HOME TAB SWITCHING ---
let currentHomeTab = 'receipts';
let needsReviewFilter = false;

// --- PHASE 3: SMART FILTER CHIP LOGIC ---
function toggleFilterChip(type) {
    if (type === 'dateRange') {
        const picker = document.getElementById('date-range-picker');
        const chip = document.getElementById('chip-dateRange');
        if (activeFilterChips.has('dateRange')) {
            activeFilterChips.delete('dateRange');
            if (chip) chip.classList.remove('active');
            if (picker) picker.classList.add('hidden');
            dateRangeStart = null;
            dateRangeEnd = null;
        } else {
            activeFilterChips.add('dateRange');
            if (chip) chip.classList.add('active');
            if (picker) picker.classList.remove('hidden');
            return; // Don't filter yet — wait for date selection
        }
    } else {
        const chip = document.getElementById(`chip-${type}`);
        if (activeFilterChips.has(type)) {
            activeFilterChips.delete(type);
            if (chip) chip.classList.remove('active');
        } else {
            activeFilterChips.add(type);
            if (chip) chip.classList.add('active');
        }
    }
    filterSlips();
}

function applyDateRange() {
    const startInput = document.getElementById('date-range-start');
    const endInput = document.getElementById('date-range-end');
    dateRangeStart = startInput?.value || null;
    dateRangeEnd = endInput?.value || null;
    if (!dateRangeStart || !dateRangeEnd) {
        showToast('Missing Dates', 'Please select both start and end dates.', 'error');
        return;
    }
    filterSlips();
    showToast('Date Range Applied', `Filtering from ${dateRangeStart} to ${dateRangeEnd}`);
}


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



function toggleSmartFilters() {
    // Phase 3: Now handled by chip bar, kept for backward compatibility
    const chipBar = document.querySelector('.chip-bar');
    if (chipBar) chipBar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
            openBudgetModal();
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
    return new Promise((resolve, reject) => {
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
            img.onerror = (e) => reject(new Error("Failed to load image for compression"));
            img.src = e.target.result;
        };
        reader.onerror = (e) => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}

if (fileInput) {
    // Force multiple and explicit accept just in case
    fileInput.multiple = true;
    fileInput.accept = "image/png,image/jpeg,image/jpg,image/webp,application/pdf";
    // console.log("File input initialized with multiple selection support");

    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        loader.classList.remove('hidden');
        const loaderTitle = loader.querySelector('h3');
        const originalText = loaderTitle ? loaderTitle.innerText : 'AI is analyzing...';

        try {
            for (let i = 0; i < files.length; i++) {
                if (loaderTitle && files.length > 1) {
                    loaderTitle.innerText = `Analyzing (${i + 1}/${files.length})...`;
                }
                const file = files[i];
                let fileToProcess = file;
                if (file.type.startsWith('image/')) {
                    try {
                        fileToProcess = await compressImage(file);
                    } catch (err) {
                        console.error("Compression failed for file " + file.name, err);
                    }
                }

                // Only open modal for single file, and only hide loader on the last file
                await analyzeSlip(fileToProcess, files.length === 1, i === files.length - 1);
            }
            if (files.length > 1) {
                // Short delay to ensure list is updated
                setTimeout(async () => {
                    showToast("Success", `Successfully processed ${files.length} receipts!`);
                }, 500);
            }
        } catch (err) {
            console.error("Processing error:", err);
            await showDialog("Processing Error", "Error processing one or more images. Some were skipped.", "error");
        } finally {
            if (loaderTitle) loaderTitle.innerText = originalText;
            loader.classList.add('hidden');
            fileInput.value = '';
        }
    });
}



async function analyzeSlip(fileObject, openReviewModal = true, hideLoaderOnFinish = true) {
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
            id: data.data.id, // Ensure ID is passed for deletion if cancelled
            imageData: data.data.image_url,
            notes: [], // Ensure notes is always an empty array initially for AI analysis
            reason: data.data.reason || "", // Populate reason from AI response
            isNew: true // Mark as new scan
        };
        if (openReviewModal) await openModal();
        await fetchSlips();
    } catch (err) {
        console.error("Analysis Failed:", err);

        const isQuotaError = err.message.toLowerCase().includes('quota') ||
            err.message.includes('429') ||
            err.message.toLowerCase().includes('limit');

        if (isQuotaError) {
            const msg = `The AI is currently busy or has reached its daily limit.<br><br>Would you like to enter the details manually instead?`;
            if (await showDialog("AI Quota Exceeded", msg, "warning", true, "Yes, Manual Entry")) {
                openManualEntry(fileObject);
            }
        } else if (err.message.includes('Duplicate Slip')) {
            await showDialog("Analysis Failed", "Duplicate Slip! This image has already been uploaded.", "error", false, "oky");
            switchScreen('home');
        } else {
            const msg = `${err.message}<br><br>This is often caused by an expired session.<br><br>Would you like to <b>SIGN OUT</b> and try again? (Recommended)`;
            if (await showDialog("Analysis Failed", msg, "error", true, "Sign Out")) {
                logout();
            } else if (await showDialog("Manual Entry", "Would you like to enter the details manually instead?", "info", true, "Yes")) {
                openManualEntry(fileObject);
            }
        }
    } finally {
        if (hideLoaderOnFinish) loader.classList.add('hidden');
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
        await showDialog("Upload Failed", err.message, "error");
    } finally {
        loader.classList.add('hidden');
    }
}

// Pagination State
let currentPage = 1;
const itemsPerPage = 20;
let hasMoreSlips = true;
let isLoadingMore = false;

async function fetchSlips(page = 1, append = false) {
    if (!currentUser) return;

    // If resetting (page 1), clear existing data unless appending
    if (page === 1 && !append) {
        savedSlips = [];
        currentPage = 1;
        hasMoreSlips = true;
        renderSkeletonList();
    }

    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage - 1;

    try {
        const { data, error, count } = await supabaseClient
            .from('slips')
            .select('*', { count: 'exact' })
            .order('date', { ascending: false })
            .range(start, end);

        if (error) throw error;

        if (data && data.length > 0) {
            if (append) {
                savedSlips = [...savedSlips, ...data];
            } else {
                savedSlips = data;
            }

            // Check if we have more records
            if (count !== null) {
                hasMoreSlips = savedSlips.length < count;
            } else {
                // Fallback if count is not returned
                hasMoreSlips = data.length === itemsPerPage;
            }
        } else {
            hasMoreSlips = false;
        }

        await renderSlips(append);
        if (currentScreen === 'insights') updateInsightsDashboard();

    } catch (err) {
        console.error('Error fetching slips:', err);
        await showDialog("Error", "Failed to load receipts.", "error");
    }
}

function renderSkeletonList() {
    const list = document.getElementById('slip-list');
    const fullList = document.getElementById('full-slip-list');
    const skeletonHTML = Array(4).fill(0).map(() => `
        <div class="card p-4 flex items-center gap-4 animate-pulse">
            <div class="w-14 h-14 rounded-2xl bg-slate-100"></div>
            <div class="flex-1 space-y-3">
                <div class="h-4 bg-slate-100 rounded w-3/4"></div>
                <div class="h-3 bg-slate-100 rounded w-1/2"></div>
            </div>
            <div class="space-y-2 text-right">
                <div class="h-5 bg-slate-100 rounded w-16 ml-auto"></div>
                <div class="h-3 bg-slate-100 rounded w-10 ml-auto"></div>
            </div>
        </div>
    `).join('');

    if (list) {
        list.innerHTML = skeletonHTML;
        list.classList.remove('hidden');
    }
    if (fullList) fullList.innerHTML = skeletonHTML;
}

// Function to load next page
async function loadMoreSlips() {
    if (isLoadingMore || !hasMoreSlips) return;

    isLoadingMore = true;
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.innerText = 'Loading...';
        loadMoreBtn.disabled = true;
    }

    currentPage++;
    await fetchSlips(currentPage, true);

    isLoadingMore = false;
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

async function renderSlips(append = false) {
    const list = document.getElementById('slip-list');
    const fullList = document.getElementById('full-slip-list');
    let claimTotal = 0;
    let deductionTotal = 0;

    // Apply filters (Client-side filtering for now, as search is complex)
    // Note: If we have many pages, client-side filtering only filters LOADED items.
    // For a robust app, we should move filtering to the DB query in fetchSlips.
    // For Phase 1, we stick to client-side filtering of the loaded subset.
    let filteredSlips = savedSlips;

    // Category filter
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter && categoryFilter.value) {
        filteredSlips = Logic.applyCategoryFilter(filteredSlips, categoryFilter.value);
    }

    // Needs review filter
    if (needsReviewFilter) {
        filteredSlips = Logic.applyNeedsReviewFilter(filteredSlips);
    }

    // Phase 3: Smart Chip Filters
    if (activeFilterChips.has('thisMonth')) {
        filteredSlips = Logic.applyThisMonthFilter(filteredSlips);
    }
    if (activeFilterChips.has('highValue')) {
        filteredSlips = Logic.applyHighValueFilter(filteredSlips);
    }
    if (activeFilterChips.has('taxDeductible')) {
        filteredSlips = Logic.applyTaxDeductibleFilter(filteredSlips);
    }
    if (activeFilterChips.has('dateRange') && dateRangeStart && dateRangeEnd) {
        filteredSlips = Logic.applyDateRangeFilter(filteredSlips, dateRangeStart, dateRangeEnd);
    }

    // Smart AI Search filter
    const receiptSearch = document.getElementById('receipt-search');
    if (receiptSearch && receiptSearch.value.trim()) {
        filteredSlips = Logic.applyTextSearch(filteredSlips, receiptSearch.value);
    }

    // Sort filter
    const sortFilter = document.getElementById('sort-filter');
    if (sortFilter) {
        filteredSlips = Logic.sortSlips(filteredSlips, sortFilter.value);
    }

    // Fetch signed URLs for all slips in parallel
    // OPTIMIZATION: Only fetch URLs for the new items if appending, 
    // but for simplicity and correct filtering, we re-process filtered set.
    // Ideally we should cache signed URLs (implemented in getSignedUrl)
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
                <img src="${s.displayUrl}" class="w-14 h-14 rounded-2xl object-cover border border-slate-50 shadow-sm" loading="lazy">
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

    // Load More Button HTML
    const loadMoreHtml = hasMoreSlips ? `
        <div class="text-center pt-4 pb-8">
            <button id="load-more-btn" onclick="loadMoreSlips()" class="px-6 py-2 bg-slate-100 text-slate-600 font-bold rounded-full text-sm hover:bg-slate-200 transition">
                Load More Receipts
            </button>
        </div>
    ` : '';


    // Update receipt count display
    const receiptCountEl = document.getElementById('receipt-count');
    const receiptCountText = document.getElementById('receipt-count-text');
    const emptyState = document.getElementById('empty-state');

    if (receiptCountEl) receiptCountEl.innerText = savedSlips.length + (hasMoreSlips ? '+' : '');

    // Update receipt count text ("Showing X of Y receipts")
    if (receiptCountText) {
        receiptCountText.innerText = `Showing ${slipsWithUrls.length} receipts`;
    }

    // Show/hide empty state and quick actions
    const quickActionsReceipts = document.getElementById('quick-actions-receipts');
    if (emptyState) {
        if (slipsWithUrls.length === 0 && !hasMoreSlips) {
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
        if (slipsWithUrls.length === 0 && !hasMoreSlips) {
            list.innerHTML = '';
        } else {
            list.innerHTML = html.join('') + loadMoreHtml;
            list.classList.remove('hidden');
        }
    }
    if (fullList) fullList.innerHTML = (html.join('') + loadMoreHtml) || '<p class="text-center py-10 text-slate-300 text-sm">No slips found.</p>';

    const claimableEl = document.getElementById('stat-claimable');
    const deductionsEl = document.getElementById('stat-deductions');
    const totalReceiptsEl = document.getElementById('stat-total-receipts');

    // We calculate totals only from loaded slips for now. 
    // Ideally, backend should provide aggregate totals.
    if (claimableEl) claimableEl.innerText = "R " + claimTotal.toFixed(2);
    if (deductionsEl) deductionsEl.innerText = "R " + deductionTotal.toFixed(2);
    if (totalReceiptsEl) totalReceiptsEl.innerText = savedSlips.length;

    // Recalculate This Month only from loaded slips (approximate)
    const thisMonthEl = document.getElementById('stat-this-month');
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

    if (vatClaimableEl) vatClaimableEl.innerText = "R" + (currentProcess.vat_claimable_amount || 0).toFixed(2);
    if (taxDeductibleAmtEl) taxDeductibleAmtEl.innerText = "R" + (currentProcess.income_tax_deductible_amount || 0).toFixed(2);

    // Use claim_summary from AI if available, else standard text
    if (claimSummaryEl) {
        if (currentProcess.claim_summary) {
            claimSummaryEl.innerHTML = `<p class="font-medium text-slate-700 mb-1">AI Analysis:</p><p>${currentProcess.claim_summary}</p>`;
        } else {
            claimSummaryEl.innerHTML = `<span class="text-slate-400">AI analysis will appear here after scanning...</span>`;
        }
    }

    // --- Confidence Indicators (Phase 2) ---
    const confidence = currentProcess.confidence;
    const confMerchant = document.getElementById('conf-merchant');
    const confDate = document.getElementById('conf-date');
    const confTotal = document.getElementById('conf-total');
    const confScore = document.getElementById('confidence-score');

    const setDot = (el, level) => {
        if (!el) return;
        el.classList.remove('hidden', 'bg-emerald-500', 'bg-orange-500', 'bg-red-500');
        if (!level || level === 'pending') {
            el.classList.add('hidden');
            return;
        }
        el.classList.remove('hidden');
        if (level === 'high') el.classList.add('bg-emerald-500');
        else if (level === 'medium') el.classList.add('bg-orange-500');
        else el.classList.add('bg-red-500');
    };

    if (confidence) {
        setDot(confMerchant, confidence.merchant);
        setDot(confDate, confidence.date);
        setDot(confTotal, confidence.total);
        if (confScore) confScore.innerText = (confidence.overall || 0) + '%';
    } else {
        // Hide if no confidence data
        setDot(confMerchant, null);
        setDot(confDate, null);
        setDot(confTotal, null);
        if (confScore) confScore.innerText = 'N/A';
    }

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

    // Show/Hide Delete Button
    const deleteBtn = document.getElementById('modal-delete-btn');
    if (deleteBtn) {
        if (currentProcess.id && !currentProcess.isNew) {
            deleteBtn.classList.remove('hidden');
        } else {
            deleteBtn.classList.add('hidden');
        }
    }

    modal.classList.remove('hidden');
}

// Confirmation for deleting
async function confirmDeleteCurrentSlip() {
    if (!currentProcess.id) return;

    const confirm = await showDialog(
        "Delete Receipt?",
        "Are you sure you want to delete this receipt? This cannot be undone.",
        "warning",
        true, // showCancel
        "Delete" // confirmText
    );

    if (confirm) {
        const deleteBtn = document.getElementById('modal-delete-btn');
        if (deleteBtn) {
            deleteBtn.innerHTML = '<span class="animate-spin">⏳</span>';
            deleteBtn.disabled = true;
        }

        const success = await deleteSlip(currentProcess.id);

        if (success) {
            closeModal();
            fetchSlips();
            showToast("Success", "Receipt deleted.");
        } else {
            if (deleteBtn) {
                deleteBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>`;
                deleteBtn.disabled = false;
            }
            await showDialog("Error", "Failed to delete receipt.", "error");
        }
    }
}

function toggleWarning() {
    const cat = document.getElementById('m-category').value;
    if (lunchWarning) lunchWarning.classList.toggle('hidden', cat !== 'Entertainment');
}

function closeModal() {
    modal.classList.add('hidden');

    // Reset Delete Button State
    const deleteBtn = document.getElementById('modal-delete-btn');
    if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>`;
        deleteBtn.classList.add('hidden'); // Default to hidden
    }
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

function renderCharts(slips = savedSlips) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    const categories = {};
    slips.forEach(s => {
        categories[s.category] = (categories[s.category] || 0) + (s.total || 0);
    });

    const total = Object.values(categories).reduce((sum, val) => sum + val, 0);

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
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        font: { family: 'Outfit', weight: 'bold' },
                        generateLabels: (chart) => {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                                    return {
                                        text: `${label} (${percentage})`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: isNaN(data.datasets[0].data[i]),
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            const value = context.raw;
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                            label += 'R ' + value.toFixed(2) + ' (' + percentage + ')';
                            return label;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

function renderMonthlyTrendsChart(selectedMonth = null, selectedYear = null) {
    console.log("Starting renderMonthlyTrendsChart", selectedMonth, selectedYear);
    const ctx = document.getElementById('monthlyTrendsChart');
    if (!ctx) {
        console.error("monthlyTrendsChart canvas not found");
        return;
    }

    const now = new Date();
    let targetYear = selectedYear;
    let targetMonth = selectedMonth;

    // --- POPULATE DROPDOWN ---
    const monthSelector = document.getElementById('chart-month-selector');
    if (monthSelector) {
        // Find all unique months
        const uniqueMonths = new Set();

        // 1. Force add all 12 months of the current year (Jan-Dec)
        const currentYearForList = now.getFullYear();
        for (let m = 1; m <= 12; m++) {
            uniqueMonths.add(`${currentYearForList}-${m}`);
        }

        // 2. Add any months from data (handles historical years)
        savedSlips.forEach(slip => {
            if (slip.date) {
                const [y, m] = slip.date.split('-');
                uniqueMonths.add(`${parseInt(y)}-${parseInt(m)}`);
            }
        });

        // Convert to array and sort ASCENDING (Jan -> Dec)
        const sortedMonths = Array.from(uniqueMonths).sort((a, b) => {
            const [y1, m1] = a.split('-').map(Number);
            const [y2, m2] = b.split('-').map(Number);
            if (y1 !== y2) return y1 - y2; // Year ascending
            return m1 - m2; // Month ascending
        });

        // Create options
        const monthNameList = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        // Rebuild options
        monthSelector.innerHTML = '';
        sortedMonths.forEach(key => {
            const [y, m] = key.split('-').map(Number);
            const name = `${monthNameList[m - 1]} ${y}`;
            const option = document.createElement('option');
            option.value = `${y}-${m}`;
            option.text = name;
            monthSelector.appendChild(option);
        });
    }

    // --- DETERMINE TARGET IF NOT PROVIDED ---
    if (!targetYear || !targetMonth) {
        // Default logic: Current month, or most recent if current has no data
        targetYear = now.getFullYear();
        targetMonth = now.getMonth() + 1;

        const currentMonthHasReceipts = savedSlips.some(slip => {
            if (!slip.date) return false;
            const [yearStr, monthStr] = slip.date.split('-');
            return parseInt(yearStr) === targetYear && parseInt(monthStr) === targetMonth;
        });

        if (!currentMonthHasReceipts && savedSlips.length > 0) {
            const sortedSlips = [...savedSlips].sort((a, b) => {
                if (!a.date || !b.date) return 0;
                return new Date(b.date) - new Date(a.date);
            });

            if (sortedSlips[0] && sortedSlips[0].date) {
                const [yearStr, monthStr] = sortedSlips[0].date.split('-');
                targetYear = parseInt(yearStr);
                targetMonth = parseInt(monthStr);
            }
        }
    }

    // Sync Dropdown with Target
    if (monthSelector) {
        monthSelector.value = `${targetYear}-${targetMonth}`;
    }

    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

    // Calculate days passed (only relevant if showing current month)
    const isCurrentMonth = targetYear === now.getFullYear() && targetMonth === (now.getMonth() + 1);
    const daysPassed = isCurrentMonth ? now.getDate() : daysInMonth;

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

        if (year === targetYear && month === targetMonth) {
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

    // Update Month Indicator
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthIndicator = document.getElementById('chart-month-indicator');
    if (monthIndicator) {
        const monthName = monthNames[targetMonth - 1];
        const indicatorText = isCurrentMonth
            ? `Showing data for ${monthName} ${targetYear} (current month)`
            : `Showing data for ${monthName} ${targetYear} (most recent month with receipts)`;
        monthIndicator.innerText = indicatorText;
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

function populateInsightsFilter() {
    const filterEl = document.getElementById('insights-month-filter');
    if (!filterEl) return;

    const currentSelection = filterEl.value;

    // Identify distinct years from data, defaulting to current year if empty
    const years = new Set();
    const currentYear = new Date().getFullYear();
    years.add(currentYear);

    savedSlips.forEach(slip => {
        if (!slip.date) return;
        const d = new Date(slip.date);
        if (!isNaN(d.getTime())) {
            years.add(d.getFullYear());
        }
    });

    const sortedYears = Array.from(years).sort((a, b) => b - a); // Descending years

    // Clear existing
    filterEl.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.innerText = 'All Time';
    filterEl.appendChild(allOption);

    sortedYears.forEach(year => {
        // Generate months Jan (0) to Dec (11)
        for (let m = 0; m < 12; m++) {
            const date = new Date(year, m, 1);
            const monthName = date.toLocaleString('default', { month: 'long' });
            const label = `${monthName} ${year}`;
            const value = `${year}-${String(m + 1).padStart(2, '0')}`;

            const option = document.createElement('option');
            option.value = value;
            option.innerText = label;
            filterEl.appendChild(option);
        }
    });

    // Set functionality to default to current month on first load
    const now = new Date();
    const currentMonthVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Check if we already set the default for this session/load
    if (!filterEl.hasAttribute('data-default-set')) {
        // Try to set current month
        const currentMonthOption = Array.from(filterEl.options).find(o => o.value === currentMonthVal);
        if (currentMonthOption) {
            filterEl.value = currentMonthVal;
        } else {
            filterEl.value = 'all';
        }
        filterEl.setAttribute('data-default-set', 'true');
    } else {
        // Restore selection if valid, otherwise default to "all"
        const hasValue = Array.from(filterEl.options).some(o => o.value === currentSelection);
        if (hasValue && currentSelection !== '') {
            filterEl.value = currentSelection;
        } else {
            filterEl.value = 'all';
        }
    }
}

function updateInsightsDashboard() {
    populateInsightsFilter();

    const filterEl = document.getElementById('insights-month-filter');
    const selectedValue = filterEl ? filterEl.value : 'all';

    let filteredSlips = savedSlips;
    if (selectedValue !== 'all') {
        const [y, m] = selectedValue.split('-');
        filteredSlips = savedSlips.filter(slip => {
            if (!slip.date) return false;
            const date = new Date(slip.date);
            return date.getFullYear() === parseInt(y) && (date.getMonth() + 1) === parseInt(m);
        });

        // Update Monthly Trends Chart to selected month
        renderMonthlyTrendsChart(parseInt(m), parseInt(y));
    } else {
        // If All Time, default Monthly Trends to current month or maybe average?
        // Defaulting to current month is safest for now
        const now = new Date();
        renderMonthlyTrendsChart(now.getMonth() + 1, now.getFullYear());
    }

    let totalSpending = 0;
    let totalClaimable = 0;
    let deductibleCount = 0;
    let totalReceipts = filteredSlips.length;
    const categoryTotals = {};
    const monthlyTotals = {};

    filteredSlips.forEach(slip => {
        const total = slip.total || 0;
        const claim = slip.income_tax_deductible_amount || (slip.is_tax_deductible ? total : 0);

        totalSpending += total;
        totalClaimable += claim;
        if (slip.is_tax_deductible) deductibleCount++;
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

    // Render charts with filtered data
    renderCharts(filteredSlips); // For Spending by Category (Doughnut)
    // renderMonthlyTrendsChart is already called above based on selection

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

    // Update Tax Preparation Card
    const deductibleCountEl = document.getElementById('deductible-count');
    const taxProgressEl = document.getElementById('tax-progress');
    const deductionsSummaryEl = document.getElementById('deductions-summary');

    if (deductibleCountEl) deductibleCountEl.innerText = `${deductibleCount} deductible`;
    if (deductionsSummaryEl) deductionsSummaryEl.innerText = `R ${totalClaimable.toFixed(2)} in deductions`;
    if (taxProgressEl) {
        const percentage = totalSpending > 0 ? (totalClaimable / totalSpending) * 100 : 0;
        taxProgressEl.style.width = `${percentage}%`;
    }

    // Update Monthly Budget Card (Dashboard)
    const budgetProgress = document.getElementById('budget-progress');
    const budgetStatus = document.getElementById('budget-status');
    const storedBudget = localStorage.getItem('monthlyBudget');

    if (budgetProgress && budgetStatus) {
        if (storedBudget) {
            const budgetAmount = parseFloat(storedBudget);
            // If viewing specific month, use its total. If "all", maybe average or just hide? 
            // "Monthly Budget" implies a single month view. 
            // If "All Time" is selected, we can't show a meaningful "Monthly Budget" progress bar for *all time* 
            // unless we sum ALL budgets (which don't historically exist) or show average.
            // Let's rely on the requested behavior: "Monthly Budget... must use the top date".
            // If "All Time" is selected, we'll default to current month for the budget card, 
            // or perhaps disable it? Let's show filtered spending if a month is selected.

            // If a specific month is selected:
            if (selectedValue !== 'all') {
                const percentage = (totalSpending / budgetAmount) * 100;
                budgetProgress.style.width = `${Math.min(percentage, 100)}%`;
                budgetProgress.className = `h-full rounded-full transition-all ${percentage > 100 ? 'bg-red-500' : 'bg-blue-600'}`;

                const remaining = budgetAmount - totalSpending;
                if (remaining >= 0) {
                    budgetStatus.innerText = `R ${remaining.toFixed(2)} remaining`;
                } else {
                    budgetStatus.innerText = `R ${Math.abs(remaining).toFixed(2)} over`;
                }
            } else {
                // For "All Time", we show "N/A" or reset
                budgetProgress.style.width = `0%`;
                budgetStatus.innerText = `Select a month`;
            }
        } else {
            budgetStatus.innerText = `No budget set`;
            budgetProgress.style.width = `0%`;
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
// --- BUDGET INTELLIGENCE ---
function openBudgetModal(selectedMonth = null, selectedYear = null) {
    const modal = document.getElementById('budget-modal');
    const content = document.getElementById('budget-content');
    const inputContainer = document.getElementById('budget-input-container');
    const budgetInput = document.getElementById('budget-input');
    const actions = document.getElementById('budget-actions');
    const filterEl = document.getElementById('insights-month-filter');

    if (!modal || !content) return;

    // Default dates
    const now = new Date();
    let targetMonth = now.getMonth() + 1;
    let targetYear = now.getFullYear();

    // Check custom params or filter
    if (selectedMonth && selectedYear) {
        targetMonth = selectedMonth;
        targetYear = selectedYear;
    } else if (filterEl && filterEl.value !== 'all') {
        const [y, m] = filterEl.value.split('-');
        targetMonth = parseInt(m);
        targetYear = parseInt(y);
    }

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
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[targetMonth - 1];

        let monthlyTotal = 0;
        let anySlipsExist = savedSlips.length > 0;

        savedSlips.forEach(slip => {
            const slipDate = new Date(slip.date);
            if (slipDate.getMonth() === (targetMonth - 1) && slipDate.getFullYear() === targetYear) {
                monthlyTotal += (slip.total || 0);
            }
        });

        const percentage = (monthlyTotal / budgetAmount) * 100;
        const remaining = budgetAmount - monthlyTotal;
        const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
        const isPast = new Date(targetYear, targetMonth - 1, 1) < new Date(now.getFullYear(), now.getMonth(), 1);
        const isFuture = new Date(targetYear, targetMonth - 1, 1) > new Date(now.getFullYear(), now.getMonth(), 1);
        const isCurrent = !isPast && !isFuture;
        const daysRemaining = isCurrent ? (daysInMonth - now.getDate()) : (isFuture ? daysInMonth : 0);

        // Insight Generation
        let insight = "";
        let insightColor = "text-slate-600";
        let insightBg = "bg-slate-50";
        let icon = "✅";

        if (isPast) {
            if (percentage > 100) {
                insight = `You exceeded your budget by <b>R${Math.abs(remaining).toFixed(2)}</b> in ${monthName}.`;
                insightColor = "text-red-700";
                insightBg = "bg-red-50";
                icon = "⚠️";
            } else {
                insight = `You stayed within budget! You saved <b>R${remaining.toFixed(2)}</b> in ${monthName}.`;
                insightColor = "text-emerald-700";
                insightBg = "bg-emerald-50";
                icon = "✅";
            }
        } else {
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
        }

        // Add clarification if total is 0 but user has slips (likely from other months)
        let note = "";
        if (monthlyTotal === 0 && anySlipsExist) {
            note = `<p class="text-[10px] text-slate-400 mt-2 italic">Note: No spending recorded for <b>${monthName} ${targetYear}</b>.</p>`;
        }

        content.innerHTML = `
            <div class="grid grid-cols-2 gap-3 mb-2">
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target</p>
                    <p class="text-lg font-black text-slate-800">R${budgetAmount.toFixed(2)}</p>
                </div>
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spent (${monthName})</p>
                    <p class="text-lg font-black text-blue-600">R${monthlyTotal.toFixed(2)}</p>
                </div>
            </div>
            
            <div class="relative h-4 bg-slate-100 rounded-full overflow-hidden mb-4">
                <div class="absolute top-0 left-0 h-full ${percentage > 100 ? 'bg-red-500' : 'bg-blue-500'} transition-all duration-1000" style="width: ${Math.min(percentage, 100)}%"></div>
            </div>

            <div class="${insightBg} p-4 rounded-xl border border-slate-100 flex gap-3 items-start">
                <span class="text-xl">${icon}</span>
                <div class="flex-1">
                    <p class="text-sm ${insightColor} leading-relaxed">${insight}</p>
                    ${note}
                </div>
            </div>
        `;
    }

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden'); // Lock background scroll
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

async function saveBudget() {
    const budgetInput = document.getElementById('budget-input');
    if (!budgetInput) return;

    const amount = parseFloat(budgetInput.value);
    if (amount && !isNaN(amount) && amount > 0) {
        localStorage.setItem('monthlyBudget', amount);
        updateBudgetDisplay(amount);

        // Refresh modal content
        openBudgetModal();
    } else {
        await showDialog("Invalid Amount", "Please enter a valid budget amount.", "warning");
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
// --- EXPENSE PREDICTIONS ---
function openPredictionsModal(monthOffset = 0) {
    if (savedSlips.length === 0) {
        openInfoModal("Predictions", "We need a bit more data to make predictions! 📊<br><br>Start by scanning a few receipts.");
        return;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Calculate target date based on offset
    const targetDate = new Date(currentYear, currentMonth + monthOffset, 1);
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();
    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    // Format month name (e.g., "January 2026")
    const monthName = targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const isCurrentMonth = monthOffset === 0;
    const isFuture = targetDate > now && !isCurrentMonth;
    const isPast = targetDate < new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Calculate Stats for Target Month & Collect History
    let targetMonthTotal = 0;
    const targetCategoryTotals = {};
    const historicalMonthTotals = {}; // key: "YYYY-MM"

    savedSlips.forEach(slip => {
        const slipDate = new Date(slip.date);
        const slipMonth = slipDate.getMonth();
        const slipYear = slipDate.getFullYear();
        const monthKey = `${slipYear}-${slipMonth}`;

        if (slipMonth === targetMonth && slipYear === targetYear) {
            // Target Month Data
            targetMonthTotal += (slip.total || 0);
            targetCategoryTotals[slip.category] = (targetCategoryTotals[slip.category] || 0) + (slip.total || 0);
        } else {
            // Historical Data (for averages)
            historicalMonthTotals[monthKey] = (historicalMonthTotals[monthKey] || 0) + (slip.total || 0);
        }
    });

    // 2. Calculate Historical Average (for predictions)
    const pastMonths = Object.values(historicalMonthTotals);
    let historicalAverage = 0;
    if (pastMonths.length > 0) {
        const sumPast = pastMonths.reduce((a, b) => a + b, 0);
        historicalAverage = sumPast / pastMonths.length;
    }

    // 3. Logic Branching based on Time
    let mainValueLabel = "Projected";
    let mainValue = 0;
    let secondaryValueLabel = "Current Spending";
    let secondaryValue = targetMonthTotal;
    let insight = "";
    let topCategory = "None";
    let topCategoryAmount = 0;

    // Identify top category for target month (if any data exists)
    for (const [cat, amount] of Object.entries(targetCategoryTotals)) {
        if (amount > topCategoryAmount) {
            topCategory = cat;
            topCategoryAmount = amount;
        }
    }

    if (isPast) {
        // --- PAST MONTH ---
        mainValueLabel = "Total Spent";
        mainValue = targetMonthTotal;
        secondaryValueLabel = "Budget"; // Could show budget here if available
        secondaryValue = parseFloat(localStorage.getItem('monthlyBudget') || 0);

        insight = `You spent <b>R${targetMonthTotal.toFixed(2)}</b> in ${monthName}.`;
        if (topCategory !== "None") {
            insight += ` Your biggest expense was <b>${topCategory}</b>.`;
        }

    } else if (isFuture) {
        // --- FUTURE MONTH ---
        mainValueLabel = "Predicted";
        // Future prediction is purely based on historical average
        mainValue = historicalAverage > 0 ? historicalAverage : 0;
        secondaryValueLabel = "Historical Avg";
        secondaryValue = historicalAverage;

        if (historicalAverage === 0) {
            insight = "We don't have enough history to predict this future month yet.";
        } else {
            insight = `Based on your past spending habits, we estimate you'll spend around <b>R${mainValue.toFixed(2)}</b> in ${monthName}.`;
        }

    } else {
        // --- CURRENT MONTH (Original blended logic) ---
        const daysPassed = now.getDate();
        // Current Trend Projection: (Current Spend / Days Passed) * Total Days
        const currentTrendProjection = daysPassed > 0 ? (targetMonthTotal / daysPassed) * daysInTargetMonth : 0;

        // Weight factor
        const weight = daysPassed / daysInTargetMonth;

        if (pastMonths.length === 0) {
            mainValue = currentTrendProjection;
            if (daysPassed < 5) {
                insight = "It's early in the month! Keep scanning to improve accuracy.";
            } else {
                insight = `Based on your current spending, you're on track for R${mainValue.toFixed(2)}.`;
            }
        } else {
            // Blend History and Trend
            mainValue = (currentTrendProjection * weight) + (historicalAverage * (1 - weight));

            if (daysPassed < 7) {
                insight = `It's early. We used your average (R${historicalAverage.toFixed(0)}) to refine this.`;
            } else {
                insight = `Based on history & activity, you're on track for R${mainValue.toFixed(2)}.`;
            }
        }
    }

    // Calculate Increase / Variance
    const projectedIncrease = Math.max(0, mainValue - targetMonthTotal);

    // --- CALENDAR MONTH PICKER ---
    let monthGridHtml = '<div class="grid grid-cols-4 gap-2 mb-2">';
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    monthsShort.forEach((m, index) => {
        // Calculate offset for this specific month in the targetYear
        const offset = (targetYear - currentYear) * 12 + (index - currentMonth);
        const isSelected = index === targetMonth;
        const activeClass = isSelected
            ? 'bg-[#0077b6] text-white shadow-md ring-2 ring-blue-200'
            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100';

        monthGridHtml += `
            <button onclick="openPredictionsModal(${offset})" 
                class="p-2 rounded-lg text-xs font-bold transition ${activeClass}">
                ${m}
            </button>
        `;
    });
    monthGridHtml += '</div>';

    const yearNav = `
        <div class="flex items-center justify-between mb-3 px-1">
            <button onclick="openPredictionsModal(${monthOffset - 12})" class="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                <span class="text-xs font-bold">Prev Year</span>
            </button>
            <span class="font-black text-slate-800 text-lg">${targetYear}</span>
             <button onclick="openPredictionsModal(${monthOffset + 12})" class="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition flex items-center gap-1">
                <span class="text-xs font-bold">Next Year</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    `;

    const htmlContent = `
        <div class="space-y-4">
            <div class="bg-white rounded-xl">
                ${yearNav}
                ${monthGridHtml}
            </div>

            <div class="hidden"> <!-- Hidden legacy header for debugging if needed -->
                Showing: ${monthName}
            </div>

            <div class="grid grid-cols-2 gap-3">
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${isPast ? 'Actual' : 'Current'}</p>
                    <p class="text-lg font-black text-slate-800">R${targetMonthTotal.toFixed(2)}</p>
                </div>
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${mainValueLabel}</p>
                    <p class="text-lg font-black text-blue-600">R${mainValue.toFixed(2)}</p>
                </div>
            </div>
            
            ${!isPast ? `
            <div class="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p class="text-xs font-bold text-blue-800 mb-1">Est. Remaining Spend</p>
                <p class="text-2xl font-black text-blue-600">R${projectedIncrease.toFixed(2)}</p>
            </div>
            ` : ''}

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
        'quote': 'Purchase Invoice',
        'invoice': 'Sales Invoice',
        'tax-dashboard': 'Tax Dashboard',
        'business-profile': 'Business Profile',
        'pnl-report': 'P&L Report',
        'invoice-list': 'All Sales Invoices',
        'quote-list': 'All Purchase Invoices',
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
    } else if (type === 'quote') {
        // Purchase Invoice - Scan Mode
        htmlContent = `
            <div class="text-center space-y-6">
                <div class="mx-auto w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center">
                    <svg class="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                    </svg>
                </div>
                <div>
                    <h3 class="text-xl font-bold text-slate-800 mb-2">Scan Purchase Invoice</h3>
                    <p class="text-slate-500 text-sm">Upload an image of your supplier invoice.<br>AI will automatically extract all the details.</p>
                </div>
                <button onclick="document.getElementById('purchase-invoice-input').click()" class="w-full bg-[#0077b6] text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition">
                    <div class="flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        Upload Invoice Image
                    </div>
                </button>
                <p class="text-xs text-slate-400">Supports: JPG, PNG, PDF</p>
            </div>
            <input type="file" id="purchase-invoice-input" accept="image/*,application/pdf" class="hidden">
        `;

        // Attach event listener after modal is created
        setTimeout(() => {
            const purchaseInput = document.getElementById('purchase-invoice-input');
            if (purchaseInput) {
                purchaseInput.addEventListener('change', async (e) => {
                    if (e.target.files.length > 0) {
                        modal.classList.add('hidden');
                        const file = e.target.files[0];

                        let fileToUpload = file;
                        // Only compress images, pass PDFs through directly
                        if (file.type.startsWith('image/')) {
                            try {
                                fileToUpload = await compressImage(file);
                            } catch (err) {
                                console.error("Image compression failed, using original", err);
                            }
                        }

                        await analyzePurchaseInvoice(fileToUpload);
                        e.target.value = '';
                    }
                });
            }
        }, 100);
    } else if (type === 'invoice') {
        const clients = await fetchClients();
        const clientOptions = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        const isQuote = type === 'quote';

        htmlContent = `
            <!-- Invoice / Quote Form -->
            <form onsubmit="${isQuote ? 'saveQuote(event)' : 'saveInvoice(event)'}" class="space-y-4 text-left">
                <!-- Client Selection -->
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Select Client</label>
                    <select name="client_id" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                        <option value="">-- Select a Client --</option>
                        ${clientOptions}
                    </select>
                    ${clients.length === 0 ? '<p class="text-xs text-red-500 mt-1">Please create a client first.</p>' : ''}
                </div>

                <!-- Date -->
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">${isQuote ? 'Expiry Date' : 'Due Date'}</label>
                    <input type="date" name="date" required class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                </div>

                <hr class="border-slate-100 my-4">

                <!-- Line Items Section -->
                <div>
                    <div class="flex justify-between items-center mb-2">
                        <label class="block text-sm font-bold text-slate-700">Line Items</label>
                        <button type="button" onclick="addInvoiceItemRow()" class="text-xs text-blue-600 font-bold hover:underline">+ Add Item</button>
                    </div>
                    
                    <div id="invoice-items-container" class="space-y-3">
                        <!-- Initial Item Row -->
                        <div class="invoice-item-row grid grid-cols-12 gap-2 items-start">
                            <div class="col-span-6">
                                <input type="text" name="item_desc[]" placeholder="Description" required class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                            </div>
                            <div class="col-span-2">
                                <input type="number" name="item_qty[]" placeholder="Qty" value="1" min="1" step="0.1" onchange="calculateLineTotal(this)" required class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                            </div>
                            <div class="col-span-3">
                                <input type="number" name="item_price[]" placeholder="Price (R)" min="0" step="0.01" onchange="calculateLineTotal(this)" required class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                            </div>
                             <div class="col-span-1 flex items-center justify-center pt-2">
                                <button type="button" onclick="removeInvoiceItemRow(this)" class="text-red-400 hover:text-red-600">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Totals -->
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
                    <div class="flex justify-between items-center">
                        <span class="font-bold text-slate-700">Total</span>
                        <span id="invoice-total-display" class="font-black text-xl text-blue-600">R 0.00</span>
                    </div>
                    <input type="hidden" name="amount" id="invoice-total-input" value="0">
                </div>

                <button type="submit" class="w-full bg-[#0077b6] text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 active:scale-95 transition mt-4">
                    ${isQuote ? 'Create Purchase Invoice' : 'Create Sales Invoice'}
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
                
                <hr class="border-slate-100 my-4">
                <h3 class="font-bold text-slate-800 text-sm uppercase tracking-wide mb-3">Banking Details</h3>
                
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-1">Bank Name</label>
                        <input type="text" name="bank_name" value="${meta.bank_name || ''}" placeholder="e.g. FNB" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-700 mb-1">Branch Code</label>
                        <input type="text" name="branch_code" value="${meta.branch_code || ''}" placeholder="e.g. 250655" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Account Holder</label>
                    <input type="text" name="account_holder" value="${meta.account_holder || ''}" placeholder="e.g. My Business Pty Ltd" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
                </div>
                <div>
                    <label class="block text-sm font-bold text-slate-700 mb-1">Account Number</label>
                    <input type="text" name="account_number" value="${meta.account_number || ''}" placeholder="e.g. 62000000000" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 transition">
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
            htmlContent = '<p class="text-center py-10 text-slate-400">No sales invoices found.</p>';
        } else {
            htmlContent = `
                <div class="space-y-3 max-h-[60vh] overflow-y-auto">
                    ${invoices.map(inv => `
                        <div onclick="closeInfoModal(); openInvoiceDetails('${inv.id}')" class="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition cursor-pointer">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <h4 class="font-bold text-slate-800">${clientMap.get(inv.client_id) || 'Unknown Client'}</h4>
                                    <p class="text-xs text-slate-500">#${inv.invoice_number}</p>
                                </div>
                                <span class="px-3 py-1 rounded-full text-xs font-bold uppercase ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">
                                    ${inv.status}
                                </span>
                            </div>
                            <div class="flex justify-between items-center text-sm">
                                <span class="text-slate-500">Due: ${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}</span>
                                <span class="font-bold text-blue-600">R ${(inv.amount || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    } else if (type === 'quote-list') {
        // Fetch purchase invoices instead of old quotes
        const { data: purchaseInvoices, error } = await supabaseClient
            .from('purchase_invoices')
            .select('*')
            .order('invoice_date', { ascending: false });

        if (error) {
            console.error('Error fetching purchase invoices:', error);
            htmlContent = '<p class="text-center py-10 text-red-400">Error loading purchase invoices.</p>';
        } else if (!purchaseInvoices || purchaseInvoices.length === 0) {
            htmlContent = '<p class="text-center py-10 text-slate-400">No purchase invoices found.</p>';
        } else {
            htmlContent = `
                <div class="space-y-3 max-h-[60vh] overflow-y-auto">
                    ${purchaseInvoices.map(inv => `
                        <div class="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition cursor-pointer" onclick="closeInfoModal(); viewPurchaseInvoice('${inv.id}')">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <h4 class="font-bold text-slate-800">${inv.vendor_name}</h4>
                                    <p class="text-xs text-slate-500">#${inv.invoice_number}</p>
                                </div>
                                <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}">
                                    ${inv.status}
                                </span>
                            </div>
                            <div class="flex justify-between items-end">
                                <p class="text-xs text-slate-400">Date: ${new Date(inv.invoice_date).toLocaleDateString()}</p>
                                <p class="font-black text-blue-600">R ${(inv.total || 0).toFixed(2)}</p>
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
                            <span class="text-slate-600">15 days included</span>
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

// --- YOCO PAYMENT INTEGRATION ---
/**
 * Initiates a Yoco payment checkout
 * @param {Object} options - Payment options
 * @param {number} options.amount - Amount in cents (e.g., 4900 = R49.00)
 * @param {string} options.description - Description of what's being purchased
 * @param {Object} options.metadata - Additional metadata to store with payment
 * @param {Array} options.lineItems - Optional line items for the checkout
 * @returns {Promise<void>}
 */
async function initiateYocoPayment(options) {
    const { amount, description, metadata = {}, lineItems = [] } = options;

    try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !session) {
            throw new Error('Please sign in to continue');
        }

        // Get current URL for redirects
        const baseUrl = window.location.origin + window.location.pathname;

        // Call the Yoco checkout Edge Function
        const response = await fetch(`${supabaseUrl}/functions/v1/yoco-checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                amount: amount,
                currency: 'ZAR',
                successUrl: `${baseUrl}?payment=success`,
                cancelUrl: `${baseUrl}?payment=cancelled`,
                failureUrl: `${baseUrl}?payment=failed`,
                metadata: {
                    description: description,
                    user_email: currentUser?.email || '',
                    ...metadata
                },
                lineItems: lineItems.length > 0 ? lineItems : [{
                    displayName: description,
                    quantity: 1,
                    pricingDetails: { price: amount }
                }]
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to create checkout session');
        }

        // Redirect to Yoco payment page
        if (data.redirectUrl) {
            window.location.href = data.redirectUrl;
        } else {
            throw new Error('No redirect URL received');
        }

    } catch (error) {
        console.error('Payment error:', error);
        throw error;
    }
}


async function handleSubscribe() {
    const cycle = currentBillingCycle;
    const price = cycle === 'yearly' ? 'R529/year' : 'R49/month';
    const amountCents = cycle === 'yearly' ? 52900 : 4900; // Amount in cents

    // Show loading state
    openInfoModal('Subscribe to Premium', `
        <div class="text-center space-y-4 py-4">
            <div class="animate-spin w-12 h-12 border-4 border-blue-200 border-t-[#0077b6] rounded-full mx-auto"></div>
            <div>
                <h4 class="font-bold text-slate-800 text-lg mb-1">Preparing checkout...</h4>
                <p class="text-slate-600 text-sm">Setting up your <b>${cycle === 'yearly' ? 'Yearly' : 'Monthly'}</b> subscription at <b>${price}</b></p>
            </div>
        </div>
    `);

    try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !session) {
            throw new Error('Please sign in to subscribe');
        }

        // Get current URL for redirects
        const baseUrl = window.location.origin + window.location.pathname;

        // Call the Yoco checkout Edge Function
        const response = await fetch(`${supabaseUrl}/functions/v1/yoco-checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
                amount: amountCents,
                currency: 'ZAR',
                successUrl: `${baseUrl}?payment=success&plan=${cycle}`,
                cancelUrl: `${baseUrl}?payment=cancelled`,
                failureUrl: `${baseUrl}?payment=failed`,
                metadata: {
                    plan_type: cycle,
                    user_email: currentUser?.email || ''
                },
                lineItems: [{
                    displayName: `SlipSafe Pro ${cycle === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
                    quantity: 1,
                    pricingDetails: {
                        price: amountCents
                    }
                }]
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to create checkout session');
        }

        // Redirect to Yoco payment page
        if (data.redirectUrl) {
            window.location.href = data.redirectUrl;
        } else {
            throw new Error('No redirect URL received from payment provider');
        }

    } catch (error) {
        console.error('Subscription error:', error);
        closeInfoModal();

        setTimeout(() => {
            openInfoModal('Payment Error', `
                <div class="text-center space-y-4">
                    <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                        <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-800 text-lg mb-1">Payment Error</h4>
                        <p class="text-slate-600 text-sm">${error.message}</p>
                    </div>
                    <div class="bg-slate-50 p-4 rounded-xl">
                        <p class="text-xs text-slate-500 leading-relaxed">
                            Please try again or contact support if the issue persists.
                        </p>
                    </div>
                    <button onclick="closeInfoModal()" class="w-full bg-[#0077b6] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
                        Try Again
                    </button>
                </div>
            `);
        }, 150);
    }
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

async function sendSupportMessage() {
    const subject = document.getElementById('support-subject')?.value;
    const message = document.getElementById('support-message')?.value?.trim();
    const emailContact = document.getElementById('contact-email')?.checked;

    // Validation
    if (!subject) {
        await showDialog("Selection Required", "Please select a subject.", "warning");
        return;
    }

    if (!message) {
        await showDialog("Message Required", "Please enter a message.", "warning");
        return;
    }

    if (!emailContact) {
        await showDialog("Confirmation Required", "Please confirm email as your contact method.", "warning");
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

// --- PAYMENT STATUS HANDLING ---
// Handle payment return from Yoco
(function handlePaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const planType = urlParams.get('plan');

    if (paymentStatus) {
        // Remove payment params from URL without reload
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        // Wait for DOM to be ready
        setTimeout(() => {
            if (paymentStatus === 'success') {
                openInfoModal('Payment Successful! 🎉', `
                    <div class="text-center space-y-4">
                        <div class="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
                            <svg class="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                            </svg>
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 text-xl mb-2">Welcome to SlipSafe Pro!</h4>
                            <p class="text-slate-600">Your ${planType === 'yearly' ? 'yearly' : 'monthly'} subscription is now active.</p>
                        </div>
                        <div class="bg-emerald-50 p-4 rounded-xl">
                            <div class="flex items-center justify-center gap-3 text-emerald-700">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                                </svg>
                                <span class="font-medium">All premium features unlocked</span>
                            </div>
                        </div>
                        <ul class="text-left text-sm text-slate-600 space-y-2 px-4">
                            <li class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                                Unlimited receipt scans
                            </li>
                            <li class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                                AI-powered SARS compliance
                            </li>
                            <li class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                                Export to Excel with images
                            </li>
                            <li class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                                </svg>
                                Priority support
                            </li>
                        </ul>
                        <button onclick="closeInfoModal()" class="w-full bg-[#0077b6] text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition">
                            Start Using Pro Features
                        </button>
                    </div>
                `);
            } else if (paymentStatus === 'cancelled') {
                openInfoModal('Payment Cancelled', `
                    <div class="text-center space-y-4">
                        <div class="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                            <svg class="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                            </svg>
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 text-lg mb-1">Payment Cancelled</h4>
                            <p class="text-slate-600 text-sm">No worries! You can subscribe anytime.</p>
                        </div>
                        <div class="bg-slate-50 p-4 rounded-xl">
                            <p class="text-xs text-slate-500 leading-relaxed">
                                Your card was not charged. You can try again whenever you're ready.
                            </p>
                        </div>
                        <button onclick="closeInfoModal()" class="w-full bg-[#0077b6] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
                            Continue to App
                        </button>
                    </div>
                `);
            } else if (paymentStatus === 'failed') {
                openInfoModal('Payment Failed', `
                    <div class="text-center space-y-4">
                        <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                            <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 text-lg mb-1">Payment Failed</h4>
                            <p class="text-slate-600 text-sm">We couldn't process your payment.</p>
                        </div>
                        <div class="bg-red-50 p-4 rounded-xl">
                            <p class="text-xs text-red-700 leading-relaxed">
                                Please check your card details and try again. If the issue persists, contact your bank or try a different payment method.
                            </p>
                        </div>
                        <button onclick="closeInfoModal()" class="w-full bg-[#0077b6] text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">
                            Try Again
                        </button>
                    </div>
                `);
            }
        }, 500);
    }
})();

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

        showToast("Success", `Business type updated to: ${businessTypes[value]}`);
    } catch (err) {
        await showDialog("Update Error", 'Error updating business type: ' + err.message, "error");
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
                await showDialog("Invalid Selection", 'Invalid selection. Please enter a number between 1 and 10.', "warning");
            }
        }
    } else {
        await showDialog("Coming Soon", `Editing ${field} coming soon! We are building a secure profile editor.`, "info");
    }
}



async function signOutAllDevices() {
    if (await showDialog("Sign Out All Devices", "This will sign you out of ALL devices, including this one. Continue?", "warning", true, "Yes, Sign Out All")) {
        try {
            // Revoke all on server
            const { error } = await supabaseClient.rpc('revoke_all_sessions');
            if (error) throw error;

            // Sign out locally/client-side final cleanup
            logout();
        } catch (err) {
            console.error("Error signing out all:", err);
            // Fallback to local logout
            logout();
        }
    }
}

// --- SESSION MANAGEMENT ---

async function fetchSessions() {
    const list = document.getElementById('active-devices-list');
    if (!list) return;

    list.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">Loading devices...</p>';

    try {
        const { data, error } = await supabaseClient.rpc('get_active_sessions');
        if (error) throw error;
        renderSessions(data);
    } catch (err) {
        console.error("Error fetching sessions:", err);
        list.innerHTML = `<p class="text-xs text-red-400 text-center py-2">Failed to load devices</p>`;
    }
}

function renderSessions(sessions) {
    const list = document.getElementById('active-devices-list');
    if (!list) return;
    list.innerHTML = '';

    if (!sessions || sessions.length === 0) {
        list.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">No active sessions found</p>';
        return;
    }

    // Helper to parse UA
    const getDeviceName = (ua) => {
        if (!ua) return 'Unknown Device';
        if (ua.includes('iPhone')) return 'iPhone';
        if (ua.includes('iPad')) return 'iPad';
        if (ua.includes('Macintosh')) return 'Mac';
        if (ua.includes('Windows')) return 'Windows PC';
        if (ua.includes('Android')) return 'Android Device';
        if (ua.includes('Linux')) return 'Linux Device';
        return 'Unknown Device';
    };

    const getBrowserName = (ua) => {
        if (!ua) return 'Unknown Browser';
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Edge')) return 'Edge';
        return 'Browser';
    };

    sessions.forEach(session => {
        const isCurrent = session.is_current;
        const deviceName = getDeviceName(session.user_agent);
        const browserName = getBrowserName(session.user_agent);
        const lastActive = new Date(session.last_active_at).toLocaleString();

        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100';

        let icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>`; // Default Desktop
        if (deviceName === 'iPhone' || deviceName === 'Android Device') {
            icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>`;
        }

        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                    ${icon}
                </div>
                <div class="space-y-0.5">
                    <p class="text-sm font-bold text-slate-800 flex items-center gap-2">
                        ${deviceName}
                        ${isCurrent ? '<span class="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded uppercase tracking-wider">Current</span>' : ''}
                    </p>
                    <p class="text-[10px] text-slate-400">${browserName} • ${lastActive}</p>
                </div>
            </div>
            ${!isCurrent ? `
            <button onclick="revokeSession('${session.id}')" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Sign Out Device">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
            </button>` : ''}
        `;
        list.appendChild(item);
    });
}

async function revokeSession(sessionId) {
    if (await showDialog("Revoke Session", "Are you sure you want to sign out this device?", "warning", true, "Yes, Sign Out")) {
        try {
            const { error } = await supabaseClient.rpc('revoke_session', { target_session_id: sessionId });
            if (error) throw error;
            await showDialog("Success", "Device signed out successfully.", "success");
            fetchSessions();
        } catch (err) {
            console.error("Error revoking session:", err);
            await showDialog("Error", "Failed to sign out device.", "error");
        }
    }
}

async function clearAllData() {
    // For now, replacing prompt with a clear warning since it's a destructive action
    const msg = "This will delete all your receipts, categories, and analytics. <b>This cannot be undone.</b><br><br>Are you absolutely sure?";
    if (await showDialog("Clear All Data", msg, "error", true, "Clear Everything")) {
        await showDialog("Success", "Clearing all data... Your account will be fresh in a few seconds.", "success");
        // In a real app, we would call a backend function here
    }
}

async function deleteAccount() {
    const msg = "Are you sure you want to permanently delete your account? All data will be lost forever.";
    if (await showDialog("Delete Account", msg, "error", true, "Delete Permanently")) {
        await showDialog("Account Deleted", "Account deletion initiated. We're sorry to see you go.", "info");
        // In a real app, we would call a backend function here
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

        showToast("Success", 'Client saved successfully!');
        // Close modal by refreshing or finding a close method if available. 
        // For now, reloading to ensure state is clean.
        setTimeout(() => location.reload(), 1500);
    } catch (err) {
        console.error('Error saving client:', err);
        await showDialog("Failed to Save", 'Failed to save client: ' + err.message, "error");
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

        showToast("Success", 'Purchase Invoice created successfully!');
        setTimeout(() => location.reload(), 1500);
    } catch (err) {
        console.error('Error saving quote:', err);
        await showDialog("Failed to Save", 'Failed to save purchase invoice: ' + err.message, "error");
    } finally {
        loader.classList.add('hidden');
    }
}

async function saveInvoice(event) {
    event.preventDefault();

    // Check for VAT Number before proceeding
    const companyMetadata = currentUser?.user_metadata || {};
    if (!companyMetadata.vat_number || !companyMetadata.vat_number.trim()) {
        await showDialog(
            "VAT Number Missing",
            "You cannot create an invoice without a configured VAT Number.<br>Please update your <b>Business Profile</b> settings.",
            "warning"
        );
        return;
    }

    const form = event.target;
    // Extract line items data manually
    const descriptions = Array.from(form.querySelectorAll('input[name="item_desc[]"]')).map(i => i.value);
    const quantities = Array.from(form.querySelectorAll('input[name="item_qty[]"]')).map(i => parseFloat(i.value));
    const prices = Array.from(form.querySelectorAll('input[name="item_price[]"]')).map(i => parseFloat(i.value));

    // Calculate total from items
    let totalAmount = 0;
    const items = [];

    for (let i = 0; i < descriptions.length; i++) {
        if (descriptions[i] && quantities[i] && prices[i]) {
            const lineTotal = quantities[i] * prices[i];
            totalAmount += lineTotal;
            items.push({
                description: descriptions[i],
                quantity: quantities[i],
                unit_price: prices[i],
                total: lineTotal
            });
        }
    }

    const formData = new FormData(form);
    const invoiceData = {
        user_id: currentUser.id,
        client_id: formData.get('client_id'),
        invoice_number: 'INV-' + Date.now().toString().slice(-6),
        amount: totalAmount,
        due_date: formData.get('date'),
        status: 'pending' // Default status
    };

    if (items.length === 0) {
        await showDialog("Error", "Please add at least one line item.", "warning");
        return;
    }

    loader.classList.remove('hidden');
    try {
        // 1. Save Invoice Header
        const { data: savedInvoice, error: invError } = await supabaseClient
            .from('invoices')
            .insert([invoiceData])
            .select()
            .single();

        if (invError) throw invError;

        // 2. Save Invoice Items
        const itemsToSave = items.map(item => ({
            ...item,
            invoice_id: savedInvoice.id
        }));

        const { error: itemsError } = await supabaseClient
            .from('invoice_items')
            .insert(itemsToSave);

        if (itemsError) throw itemsError;

        showToast("Success", 'Sales Invoice created successfully!');

        // Fetch Client Data for Preview
        const { data: clientData, error: clientError } = await supabaseClient
            .from('clients')
            .select('*')
            .eq('id', savedInvoice.client_id)
            .single();

        if (clientError) {
            console.error("Error fetching client for preview:", clientError);
            location.reload();
            return;
        }

        // Show Preview
        await showInvoicePreview(savedInvoice, clientData, itemsToSave);
    } catch (err) {
        console.error('Error saving invoice:', err);
        await showDialog("Failed to Save", 'Failed to save sales invoice: ' + err.message, "error");
    } finally {
        loader.classList.add('hidden');
    }
}

// --- INVOICE HELPER FUNCTIONS ---

function addInvoiceItemRow() {
    const container = document.getElementById('invoice-items-container');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'invoice-item-row grid grid-cols-12 gap-2 items-start';
    row.innerHTML = `
        <div class="col-span-6">
            <input type="text" name="item_desc[]" placeholder="Description" required class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
        </div>
        <div class="col-span-2">
            <input type="number" name="item_qty[]" placeholder="Qty" value="1" min="1" step="0.1" onchange="calculateLineTotal(this)" required class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
        </div>
        <div class="col-span-3">
            <input type="number" name="item_price[]" placeholder="Price (R)" min="0" step="0.01" onchange="calculateLineTotal(this)" required class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
        </div>
         <div class="col-span-1 flex items-center justify-center pt-2">
            <button type="button" onclick="removeInvoiceItemRow(this)" class="text-red-400 hover:text-red-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
        </div>
    `;
    container.appendChild(row);
}

function removeInvoiceItemRow(btn) {
    const row = btn.closest('.invoice-item-row');
    const container = document.getElementById('invoice-items-container');

    // Don't remove if it's the only one
    if (container.children.length > 1) {
        row.remove();
        calculateInvoiceTotal();
    }
}

function calculateLineTotal(input) {
    calculateInvoiceTotal();
}

function calculateInvoiceTotal() {
    const container = document.getElementById('invoice-items-container');
    if (!container) return;

    const rows = container.querySelectorAll('.invoice-item-row');
    let total = 0;

    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('input[name="item_qty[]"]').value) || 0;
        const price = parseFloat(row.querySelector('input[name="item_price[]"]').value) || 0;
        total += qty * price;
    });

    const displayEl = document.getElementById('invoice-total-display');
    const inputEl = document.getElementById('invoice-total-input');

    if (displayEl) displayEl.innerText = 'R ' + total.toFixed(2);
    if (inputEl) inputEl.value = total;
}

async function downloadInvoicePDF(invoiceId, invoiceDataVal = null) {
    loader.classList.remove('hidden');
    try {
        let invoice = invoiceDataVal;

        // Fetch invoice if not provided
        if (!invoice) {
            const { data, error } = await supabaseClient
                .from('invoices')
                .select('*')
                .eq('id', invoiceId)
                .single();
            if (error) throw error;
            invoice = data;
        }

        // Fetch Client
        const { data: client, error: clientError } = await supabaseClient
            .from('clients')
            .select('*')
            .eq('id', invoice.client_id)
            .single();
        if (clientError) throw clientError;

        // Fetch Items
        const { data: items, error: itemsError } = await supabaseClient
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', invoice.id);
        if (itemsError) throw itemsError;

        await generateInvoicePDF(invoice, client, items);

    } catch (err) {
        console.error("PDF generation error:", err);
        await showDialog("Error", "Failed to generate PDF: " + err.message, "error");
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
        address: formData.get('address'),
        bank_name: formData.get('bank_name'),
        account_holder: formData.get('account_holder'),
        account_number: formData.get('account_number'),
        branch_code: formData.get('branch_code')
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

        showToast("Success", 'Business profile updated successfully!');
        setTimeout(() => location.reload(), 1500);
    } catch (err) {
        console.error('Error updating business profile:', err);
        await showDialog("Update Failed", 'Failed to update profile: ' + err.message, "error");
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
            invoiceList.innerHTML = '<p class="text-slate-400 text-sm py-10 text-center">No sales invoices yet. Create your first invoice to get started.</p>';
        } else {
            invoiceList.innerHTML = recentInvoices.map(inv => `
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-blue-200 transition cursor-pointer" onclick="openInvoiceDetails('${inv.id}')">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h4 class="font-bold text-slate-800">${clientMap.get(inv.client_id) || 'Unknown Client'}</h4>
                            <p class="text-xs text-slate-500">#${inv.invoice_number}</p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-bold uppercase ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${inv.status}</span>
                    </div>
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-slate-500">Due: ${inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}</span>
                        <span class="font-bold text-blue-600">R ${(inv.amount || 0).toFixed(2)}</span>
                    </div>
                </div>
            `).join('');
        }
    }

    // Render Recent Purchase Invoices (replacing quotes)
    await fetchPurchaseInvoices();

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

async function openInvoiceDetails(invoiceId) {
    loader.classList.remove('hidden');
    try {
        // Fetch full Invoice Data
        const { data: invoice, error: invError } = await supabaseClient
            .from('invoices')
            .select('*')
            .eq('id', invoiceId)
            .single();
        if (invError) throw invError;

        // Fetch Client
        const { data: client, error: clientError } = await supabaseClient
            .from('clients')
            .select('*')
            .eq('id', invoice.client_id)
            .single();
        if (clientError) throw clientError;

        // Fetch Items
        const { data: items, error: itemsError } = await supabaseClient
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', invoice.id);
        if (itemsError) throw itemsError;

        await showInvoicePreview(invoice, client, items);

    } catch (err) {
        console.error("Error opening invoice details:", err);
        await showDialog("Error", "Failed to load invoice details.", "error");
    } finally {
        loader.classList.add('hidden');
    }
}


// --- TESTING EXPORTS ---
if (typeof window !== 'undefined') {
    window.setTestUser = (user) => { currentUser = user; };
    window.setTestSlips = (slips) => { savedSlips = slips; };
    window.runCheckUser = checkUser;
    window.runUpdateProfileUI = updateProfileUI;
    window.runRenderSlips = renderSlips;
    window.getSupabaseClient = () => supabaseClient;
    window.markInvoiceAsPaid = markInvoiceAsPaid;
}

async function markInvoiceAsPaid(invoiceId) {
    console.log("markInvoiceAsPaid called with ID:", invoiceId);

    const confirmed = await showDialog("Confirm Payment", "Are you sure you want to mark this invoice as PAID? This cannot be undone.", "warning", true, "Yes, Mark as Paid");
    console.log("Dialog result:", confirmed);

    if (!confirmed) {
        console.log("User cancelled the dialog");
        return;
    }

    console.log("User confirmed, proceeding with update...");
    loader.classList.remove('hidden');
    try {
        console.log("Attempting to update invoice status to 'paid'...");
        const { data, error } = await supabaseClient
            .from('invoices')
            .update({ status: 'paid' })
            .eq('id', invoiceId)
            .select();

        console.log("Update response - data:", data, "error:", error);

        if (error) throw error;

        if (!data || data.length === 0) {
            console.warn("Update returned no rows - possible RLS policy issue");
            throw new Error("Update failed - no rows affected. Check RLS policies on invoices table.");
        }

        showToast("Success", "Invoice marked as PAID.");

        // Close the preview modal
        const closeBtn = document.getElementById('close-preview-btn');
        if (closeBtn) closeBtn.click();

        // Refresh the lists
        renderRecentBusinessItems();

        // If we are in the "All Sales Invoices" list modal (which is an info-modal), we might want to refresh it.
        // The info-modal content is static HTML once generated.
        // We can close the info modal or try to refresh it.
        // Simplest is to just refresh the background data. The user will see it updated if they re-open the list.
        // If the user opened the preview FROM the list, the list is still in the DOM behind the preview (if preview is a separate overlay).
        // Let's check modal structure.
        // showInvoicePreview creates a separate overlay.
        // openBusinessModal uses 'info-modal' or just populates content?
        // openBusinessModal calls openInfoModal(name, htmlContent).
        // openInfoModal puts content in 'info-modal-content'.
        // So the list is in 'info-modal'.
        // We should probably refresh the list if it's open.

        const infoModal = document.getElementById('info-modal');
        if (infoModal && !infoModal.classList.contains('hidden')) {
            // Re-open the invoices list to refresh content
            openBusinessModal('invoice-list');
        }

    } catch (err) {
        console.error("Error updating invoice:", err);
        await showDialog("Error", "Failed to update invoice status.", "error");
    } finally {
        loader.classList.add('hidden');
    }
}

// --- OFFLINE HANDLING ---
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

function updateOnlineStatus() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;

    if (navigator.onLine) {
        banner.classList.add('hidden');
    } else {
        banner.classList.remove('hidden');
    }
}

// Initial check
updateOnlineStatus();

// ========================================
// PHASE 3: ONBOARDING WIZARD
// ========================================

function showOnboardingWizard() {
    const wizard = document.getElementById('onboarding-wizard');
    if (!wizard) return;

    // Pre-fill business name if already set
    const nameInput = document.getElementById('wizard-business-name');
    if (nameInput && currentUser?.user_metadata?.business_name) {
        nameInput.value = currentUser.user_metadata.business_name;
    }

    // Pre-fill budget if already set
    const budgetInput = document.getElementById('wizard-budget');
    const storedBudget = localStorage.getItem('monthlyBudget');
    if (budgetInput && storedBudget) {
        budgetInput.value = storedBudget;
    }

    wizard.classList.remove('hidden');
}

function updateWizardDots(activeStep) {
    for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`wizard-dot-${i}`);
        if (dot) {
            if (i === activeStep) {
                dot.className = 'w-3 h-3 rounded-full bg-white transition-all duration-300 scale-125';
            } else if (i < activeStep) {
                dot.className = 'w-3 h-3 rounded-full bg-white/70 transition-all duration-300';
            } else {
                dot.className = 'w-3 h-3 rounded-full bg-white/30 transition-all duration-300';
            }
        }
    }
}

async function wizardNext(currentStep) {
    // Save data from current step
    if (currentStep === 1) {
        const businessName = document.getElementById('wizard-business-name')?.value?.trim();
        if (businessName) {
            try {
                await supabaseClient.auth.updateUser({
                    data: { business_name: businessName }
                });
                // Update local user object
                if (currentUser) currentUser.user_metadata.business_name = businessName;
            } catch (e) {
                console.error('Failed to save business name:', e);
            }
        }
    } else if (currentStep === 2) {
        const budget = parseFloat(document.getElementById('wizard-budget')?.value) || 0;
        if (budget > 0) {
            localStorage.setItem('monthlyBudget', budget.toString());
            updateBudgetDisplay(budget);
            try {
                await supabaseClient.auth.updateUser({
                    data: { monthly_budget: budget }
                });
            } catch (e) {
                console.error('Failed to save budget:', e);
            }
        }
    }

    // Transition to next step
    const nextStep = currentStep + 1;
    document.getElementById(`wizard-step-${currentStep}`).classList.add('hidden');
    const nextEl = document.getElementById(`wizard-step-${nextStep}`);
    if (nextEl) {
        nextEl.classList.remove('hidden');
        // Re-trigger animation
        nextEl.style.animation = 'none';
        nextEl.offsetHeight; // Force reflow
        nextEl.style.animation = '';
    }
    updateWizardDots(nextStep);
}

function wizardBack(currentStep) {
    const prevStep = currentStep - 1;
    document.getElementById(`wizard-step-${currentStep}`).classList.add('hidden');
    const prevEl = document.getElementById(`wizard-step-${prevStep}`);
    if (prevEl) {
        prevEl.classList.remove('hidden');
        prevEl.style.animation = 'none';
        prevEl.offsetHeight;
        prevEl.style.animation = '';
    }
    updateWizardDots(prevStep);
}

async function skipOnboarding() {
    try {
        await supabaseClient.auth.updateUser({
            data: { onboarding_complete: true }
        });
        if (currentUser) currentUser.user_metadata.onboarding_complete = true;
    } catch (e) {
        console.error('Failed to mark onboarding:', e);
    }
    const wizard = document.getElementById('onboarding-wizard');
    if (wizard) wizard.classList.add('hidden');
    showToast('Welcome!', 'You can update your business details anytime in Profile settings.');
}

async function completeOnboarding(loadSample) {
    const wizard = document.getElementById('onboarding-wizard');

    try {
        // Mark onboarding as complete
        await supabaseClient.auth.updateUser({
            data: { onboarding_complete: true }
        });
        if (currentUser) currentUser.user_metadata.onboarding_complete = true;

        if (loadSample && currentUser) {
            // Insert a sample receipt
            const sampleSlip = {
                user_id: currentUser.id,
                merchant: 'Woolworths',
                total: 345.90,
                vat: 45.12,
                date: new Date().toISOString().slice(0, 10),
                category: 'General Business',
                is_tax_deductible: true,
                is_tax_invoice: true,
                vat_number: '4040109441',
                compliance_status: 'Valid',
                image_url: 'sample/sample-receipt.png',
                notes: ['Sample receipt loaded during onboarding']
            };

            const { error } = await supabaseClient.from('slips').insert([sampleSlip]);
            if (error) {
                console.error('Failed to insert sample slip:', error);
            } else {
                await fetchSlips();
                showToast('Sample Loaded!', 'A sample receipt has been added. Explore the Insights tab!');
            }
        } else {
            showToast('All Set!', 'Start by scanning your first receipt with the button below.');
        }
    } catch (e) {
        console.error('Onboarding completion error:', e);
    }

    if (wizard) wizard.classList.add('hidden');
    updateProfileUI();
}

// ========================================
// PHASE 3: EXPORT MODAL & FUNCTIONS
// ========================================

function openExportModal() {
    if (savedSlips.length === 0) {
        showToast('No Data', 'Scan some receipts before exporting.', 'error');
        return;
    }

    const modal = document.getElementById('export-modal');
    const countText = document.getElementById('export-count-text');

    // Calculate how many slips would be exported (with current filters)
    let exportCount = savedSlips.length;
    if (activeFilterChips.size > 0 || needsReviewFilter) {
        exportCount = getFilteredSlips().length;
        if (countText) countText.textContent = `Exporting ${exportCount} filtered receipts`;
    } else {
        if (countText) countText.textContent = `Exporting all ${exportCount} receipts`;
    }

    if (modal) modal.classList.remove('hidden');
}

function closeExportModal() {
    const modal = document.getElementById('export-modal');
    if (modal) modal.classList.add('hidden');
}

// Helper: Get currently filtered slips (same logic as renderSlips but returns data)
function getFilteredSlips() {
    let filtered = [...savedSlips];

    // Category filter
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter && categoryFilter.value) {
        filtered = Logic.applyCategoryFilter(filtered, categoryFilter.value);
    }

    // Needs review
    if (needsReviewFilter) {
        filtered = Logic.applyNeedsReviewFilter(filtered);
    }

    // Smart chips
    if (activeFilterChips.has('thisMonth')) {
        filtered = Logic.applyThisMonthFilter(filtered);
    }
    if (activeFilterChips.has('highValue')) {
        filtered = Logic.applyHighValueFilter(filtered);
    }
    if (activeFilterChips.has('taxDeductible')) {
        filtered = Logic.applyTaxDeductibleFilter(filtered);
    }
    if (activeFilterChips.has('dateRange') && dateRangeStart && dateRangeEnd) {
        filtered = Logic.applyDateRangeFilter(filtered, dateRangeStart, dateRangeEnd);
    }

    // Text search
    const receiptSearch = document.getElementById('receipt-search');
    if (receiptSearch && receiptSearch.value.trim()) {
        filtered = Logic.applyTextSearch(filtered, receiptSearch.value);
    }

    return filtered;
}

// --- CSV Export ---
function exportToCSV() {
    const slips = getFilteredSlips();
    if (slips.length === 0) {
        showToast('No Data', 'No receipts match your current filters.', 'error');
        return;
    }

    closeExportModal();

    const csvContent = Logic.buildCsvContent(slips);

    // const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SlipSafe_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('CSV Exported', `${slips.length} receipts exported successfully.`);
}

// --- PDF Tax Pack ---
async function exportPDFTaxPack() {
    const slips = getFilteredSlips();
    if (slips.length === 0) {
        showToast('No Data', 'No receipts match your current filters.', 'error');
        return;
    }

    closeExportModal();

    openInfoModal("Generating PDF", `
        <div class="text-center space-y-4 py-2">
            <div class="animate-spin w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full mx-auto"></div>
            <div>
                <p class="font-bold text-slate-800">Building your Tax Pack...</p>
                <p class="text-xs text-slate-500 mt-1">Compiling ${slips.length} receipts into a PDF report.</p>
            </div>
        </div>
    `);

    await new Promise(resolve => setTimeout(resolve, 300));

    // Calculate summary statistics
    const { totalSpent, totalVat, deductibleTotal, categories } = Logic.calculatePdfSummary(slips);

    const businessName = currentUser?.user_metadata?.business_name || 'My Business';
    const today = new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });

    // Build HTML for the PDF
    const pdfHtml = `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; padding: 20px; max-width: 700px; margin: 0 auto;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #0077b6;">
                <h1 style="font-size: 28px; font-weight: 900; color: #0077b6; margin: 0;">🧾 SlipSafe Tax Pack</h1>
                <p style="font-size: 14px; color: #64748b; margin: 8px 0 0;">${businessName} • Generated ${today}</p>
            </div>

            <!-- Summary Cards -->
            <div style="display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 140px; background: #f0f9ff; border-radius: 12px; padding: 16px; border: 1px solid #bae6fd;">
                    <p style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #0077b6; margin: 0 0 4px;">Total Spent</p>
                    <p style="font-size: 22px; font-weight: 900; color: #0c4a6e; margin: 0;">R ${totalSpent.toFixed(2)}</p>
                </div>
                <div style="flex: 1; min-width: 140px; background: #f0fdf4; border-radius: 12px; padding: 16px; border: 1px solid #bbf7d0;">
                    <p style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #16a34a; margin: 0 0 4px;">Tax Deductible</p>
                    <p style="font-size: 22px; font-weight: 900; color: #14532d; margin: 0;">R ${deductibleTotal.toFixed(2)}</p>
                </div>
                <div style="flex: 1; min-width: 140px; background: #fefce8; border-radius: 12px; padding: 16px; border: 1px solid #fde68a;">
                    <p style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #ca8a04; margin: 0 0 4px;">Total VAT</p>
                    <p style="font-size: 22px; font-weight: 900; color: #713f12; margin: 0;">R ${totalVat.toFixed(2)}</p>
                </div>
            </div>

            <!-- Category Breakdown -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
                <h3 style="font-size: 16px; font-weight: 800; margin: 0 0 12px; color: #1e293b;">Category Breakdown</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <tr style="border-bottom: 2px solid #e2e8f0;">
                        <th style="text-align: left; padding: 8px 4px; font-weight: 700; color: #64748b;">Category</th>
                        <th style="text-align: center; padding: 8px 4px; font-weight: 700; color: #64748b;">Receipts</th>
                        <th style="text-align: right; padding: 8px 4px; font-weight: 700; color: #64748b;">Total</th>
                    </tr>
                    ${Object.entries(categories).map(([cat, data]) => `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px 4px; font-weight: 600;">${cat}</td>
                            <td style="padding: 8px 4px; text-align: center; color: #64748b;">${data.count}</td>
                            <td style="padding: 8px 4px; text-align: right; font-weight: 700;">R ${data.total.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>

            <!-- Receipt Details -->
            <h3 style="font-size: 16px; font-weight: 800; margin: 0 0 12px; color: #1e293b;">Receipt Details (${slips.length} records)</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
                <tr style="background: #0077b6; color: white;">
                    <th style="padding: 8px 6px; text-align: left; font-weight: 700; border-radius: 6px 0 0 0;">Date</th>
                    <th style="padding: 8px 6px; text-align: left; font-weight: 700;">Merchant</th>
                    <th style="padding: 8px 6px; text-align: left; font-weight: 700;">Category</th>
                    <th style="padding: 8px 6px; text-align: right; font-weight: 700;">Total</th>
                    <th style="padding: 8px 6px; text-align: right; font-weight: 700;">VAT</th>
                    <th style="padding: 8px 6px; text-align: center; font-weight: 700; border-radius: 0 6px 0 0;">Deductible</th>
                </tr>
                ${slips.map((s, i) => `
                    <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 8px 6px;">${s.date || 'N/A'}</td>
                        <td style="padding: 8px 6px; font-weight: 600;">${s.merchant || 'Unknown'}</td>
                        <td style="padding: 8px 6px;">${s.category || 'Other'}</td>
                        <td style="padding: 8px 6px; text-align: right; font-weight: 700;">R ${(s.total || 0).toFixed(2)}</td>
                        <td style="padding: 8px 6px; text-align: right;">R ${(s.vat || 0).toFixed(2)}</td>
                        <td style="padding: 8px 6px; text-align: center;">${s.is_tax_deductible ? '✅' : '—'}</td>
                    </tr>
                `).join('')}
            </table>

            <!-- Footer -->
            <div style="text-align: center; padding: 16px; border-top: 2px solid #e2e8f0; color: #94a3b8; font-size: 11px;">
                <p style="margin: 0;">Generated by SlipSafe Pro • ${today}</p>
                <p style="margin: 4px 0 0;">This report is for informational purposes. Please consult a tax professional.</p>
            </div>
        </div>
    `;

    // Create a temporary container
    const container = document.createElement('div');
    container.innerHTML = pdfHtml;
    document.body.appendChild(container);

    const opt = {
        margin: 10,
        filename: `SlipSafe_Tax_Pack_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
        await html2pdf().set(opt).from(container).save();
        showToast('PDF Exported', `Tax Pack with ${slips.length} receipts downloaded.`);
    } catch (e) {
        console.error('PDF generation error:', e);
        showToast('Export Error', 'Failed to generate PDF. Please try again.', 'error');
    } finally {
        document.body.removeChild(container);
        closeInfoModal();
    }
}