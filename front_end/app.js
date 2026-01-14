// --- CONFIGURATION ---
// Version: 1.0.1 (SARS 2025/26 Optimized)
const supabaseUrl = 'https://fezppgnxhbxacuwcejma.supabase.co';
const supabaseKey = 'sb_publishable_ZOns1RnJ9eCQijgcBe_aRg_09u0sYH2';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- STATE ---
let savedSlips = [];
let currentProcess = null;
let currentUser = null;
let currentScreen = 'home';
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
    document.getElementById('profile-name').innerText = name;
    document.getElementById('profile-email').innerText = currentUser.email;
    const pic = document.getElementById('profile-pic');

    if (currentUser.user_metadata.avatar_url) {
        pic.innerHTML = `<img src="${currentUser.user_metadata.avatar_url}" class="w-full h-full rounded-full object-cover" referrerpolicy="no-referrer">`;
    } else {
        pic.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-blue-100 text-[#0077b6] text-2xl font-black rounded-full">${(name[0] || '?').toUpperCase()}</div>`;
    }
}

// --- NAVIGATION ---
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screenId}`).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('nav-active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.add('nav-inactive'));
    document.getElementById(`nav-${screenId}`).classList.add('nav-active');
    document.getElementById(`nav-${screenId}`).classList.remove('nav-inactive');

    currentScreen = screenId;
    if (screenId === 'reports') renderCharts();
    if (screenId === 'ai') generateAIInsights();
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

        const { data: { session } } = await supabaseClient.auth.getSession();

        if (!session) {
            throw new Error("You must be logged in. Please sign out and sign in again.");
        }

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

        currentProcess = { ...data.data, imageData: data.data.image_url };
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
            id: null
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
        if (currentScreen === 'reports') renderCharts();
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

    // Fetch signed URLs for all slips in parallel
    const slipsWithUrls = await Promise.all(savedSlips.map(async s => {
        const signedUrl = await getSignedUrl(s.image_url);
        return { ...s, displayUrl: signedUrl };
    }));

    const html = slipsWithUrls.map(s => {
        const vat = s.vat || 0;
        const total = s.total || 0;
        if (s.category !== 'Entertainment') claimTotal += vat;
        if (s.is_tax_deductible) deductionTotal += total;

        return `
            <div class="card p-4 flex items-center gap-4">
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

    if (list) list.innerHTML = html.slice(0, 5).join('') || '<p class="text-center py-10 text-slate-300">No recent slips.</p>';
    if (fullList) fullList.innerHTML = html.join('') || '<p class="text-center py-10 text-slate-300">No slips found.</p>';

    const claimableEl = document.getElementById('stat-claimable');
    const deductionsEl = document.getElementById('stat-deductions');
    if (claimableEl) claimableEl.innerText = "R " + claimTotal.toFixed(2);
    if (deductionsEl) deductionsEl.innerText = "R " + deductionTotal.toFixed(2);
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

    const badge = document.getElementById('compliance-badge');
    const status = currentProcess.compliance_status || (currentProcess.is_tax_invoice ? "Valid" : "Receipt Only");
    badge.innerText = status;

    if (status === 'Valid' || status === 'Sufficient') {
        badge.className = "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700";
    } else if (status === 'Incomplete') {
        badge.className = "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-orange-100 text-orange-700";
    } else {
        badge.className = "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-700";
    }

    // Show reasoning if available
    const reasoningEl = document.getElementById('m-reasoning');
    if (reasoningEl) {
        reasoningEl.innerText = currentProcess.reasoning || "";
        reasoningEl.parentElement.classList.toggle('hidden', !currentProcess.reasoning);
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

const saveBtn = document.getElementById('save-btn');
if (saveBtn) {
    saveBtn.onclick = async () => {
        const merchant = document.getElementById('m-merchant').value;
        const total = parseFloat(document.getElementById('m-total').value);
        const vat = parseFloat(document.getElementById('m-vat').value);
        const category = document.getElementById('m-category').value;
        const is_tax_deductible = document.getElementById('m-deductible').checked;
        const vat_number = document.getElementById('m-vatno').value;
        const is_tax_invoice = document.getElementById('compliance-badge').innerText === "Valid" || document.getElementById('compliance-badge').innerText === "Sufficient";
        const date = new Date().toISOString().split('T')[0]; // Default to today for manual

        const slipData = {
            merchant,
            total,
            vat,
            category,
            is_tax_deductible,
            vat_number,
            is_tax_invoice,
            date
        };

        // Disable button and show loading
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="animate-spin mr-2">⏳</span> Saving...';

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
                fetchSlips();
            } else {
                if (error.code === '23505') {
                    alert("Duplicate Slip! You have already saved this receipt.");
                } else {
                    alert("Error saving: " + error.message);
                }
                saveBtn.disabled = false;
                saveBtn.innerHTML = 'Save Slip';
            }
        } catch (err) {
            alert("An unexpected error occurred: " + err.message);
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Slip';
        }
    };
}

// --- REPORTS & CHARTS ---
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

// --- AI INSIGHTS ---
function generateAIInsights() {
    if (savedSlips.length === 0) return;

    const stores = {};
    savedSlips.forEach(s => stores[s.merchant] = (stores[s.merchant] || 0) + 1);
    const topStore = Object.entries(stores).sort((a, b) => b[1] - a[1])[0][0];

    const trendEl = document.getElementById('ai-insight-trend');
    if (trendEl) trendEl.innerText = `You've been shopping at ${topStore} frequently. Consider checking for bulk discounts!`;

    const deductibleCount = savedSlips.filter(s => s.is_tax_deductible).length;
    const taxEl = document.getElementById('ai-insight-tax');
    if (taxEl) taxEl.innerText = `You have ${deductibleCount} tax-deductible expenses. That's a great start for tax season!`;
}

// --- BUSINESS HUB ---
function openBusinessModal(type) {
    alert(`New ${type} feature coming soon! We are setting up your Client Hub.`);
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

// Initialize
checkUser();
switchScreen('home');
