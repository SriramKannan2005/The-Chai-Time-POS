// ===================================
// Chai Time POS - Main Script
// ===================================

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAFq4BsqX69Gbo9TKD5CGWD4iMEwv4KPkQ",
    authDomain: "chaitime-fa063.firebaseapp.com",
    databaseURL: "https://chaitime-fa063-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "chaitime-fa063",
    storageBucket: "chaitime-fa063.firebasestorage.app",
    messagingSenderId: "357283195164",
    appId: "1:357283195164:web:84ca7a59ba9b0d7f3132d9",
    measurementId: "G-E0KP6BXQ6H"
};

// Initialize Firebase
let app, auth, db, analytics;
let isFirebaseInitialized = false;

try {
    if (typeof firebase !== 'undefined') {
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.database();

        if (typeof firebase.analytics !== 'undefined') {
            analytics = firebase.analytics();
        }

        isFirebaseInitialized = true;
        console.log('✅ Firebase initialized successfully');
    }
} catch (error) {
    console.warn('⚠️ Firebase not initialized. Using demo mode.', error);
}

// ===================================
// Global State
// ===================================

const state = {
    currentUser: null,
    userRole: null,
    currentScreen: 'login-screen',
    cart: [],
    items: [],
    cashiers: [],
    settings: {
        shop: {
            name: 'Chai Time',
            footerText: 'Thank you for visiting! Come again ☕',
            upiQrUrl: '',
            printerWidth: 80
        },
        discount: {
            enabled: false,
            percentage: 0
        }
    },
    lastBill: null,
    shiftStartTime: null,
    lastBillNumber: 0,
    logoTapCount: 0,
    logoTapTimer: null
};

// ===================================
// Utility Functions
// ===================================

function formatCurrency(amount) {
    const num = parseFloat(amount);
    if (isNaN(num)) {
        console.warn('formatCurrency received NaN:', amount);
        return '₹0.00';
    }
    return `₹${num.toFixed(2)}`;
}

function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : type === 'warning' ? '#FF9800' : '#2196F3'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showLoading(show = true) {
    let loader = document.getElementById('global-loader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'global-loader';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;
        loader.innerHTML = '<div style="color: white; font-size: 24px;">Loading...</div>';
        document.body.appendChild(loader);
    }
    loader.style.display = show ? 'flex' : 'none';
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ===================================
// Screen Management
// ===================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        state.currentScreen = screenId;
    }
}

function navigateOwnerSection(sectionId) {
    document.querySelectorAll('.owner-section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const targetSection = document.getElementById(`${sectionId}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    const navItem = document.querySelector(`[data-section="${sectionId}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }

    // Load section data - functions from owner-portal.js
    if (sectionId === 'dashboard' && typeof loadDashboard === 'function') {
        loadDashboard();
    }
    if (sectionId === 'raw-materials' && typeof loadRawMaterialsTable === 'function') {
        loadRawMaterialsTable();
    }
    if (sectionId === 'settings' && typeof loadSettings === 'function') {
        loadSettings();
    }
}

// ===================================
// Authentication Module
// ===================================

function initAuth() {
    // Triple-tap logo for owner login
    const logo = document.getElementById('cafe-logo');
    if (logo) {
        logo.addEventListener('click', () => {
            state.logoTapCount++;

            if (state.logoTapTimer) {
                clearTimeout(state.logoTapTimer);
            }

            if (state.logoTapCount === 3) {
                showScreen('owner-login-screen');
                state.logoTapCount = 0;
                showToast('Owner login activated', 'info');
            }

            state.logoTapTimer = setTimeout(() => {
                state.logoTapCount = 0;
            }, 1000);
        });
    }

    // Owner login function
    async function ownerLogin() {
        const email = document.getElementById('owner-email').value;
        const password = document.getElementById('owner-password').value;

        const DEMO_OWNER_EMAIL = 'test@test.com';
        const DEMO_OWNER_PASSWORD = 'test123';

        if (!isFirebaseInitialized) {
            if (email === DEMO_OWNER_EMAIL && password === DEMO_OWNER_PASSWORD) {
                state.currentUser = { email: DEMO_OWNER_EMAIL, name: 'Owner' };
                state.userRole = 'owner';
                showScreen('owner-screen');
                showToast('Welcome, Owner! (Demo Mode)', 'success');
                navigateOwnerSection('dashboard');
            } else {
                showToast('Invalid credentials. Try: test@test.com / test123', 'error');
            }
        } else {
            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                state.currentUser = userCredential.user;
                state.userRole = 'owner';
                showScreen('owner-screen');
                showToast(`Welcome, ${email}!`, 'success');
                navigateOwnerSection('dashboard');
            } catch (error) {
                console.error('Owner login error:', error);
                showToast('Invalid credentials', 'error');
            }
        }
    }

    // Owner login form
    const ownerLoginForm = document.getElementById('owner-login-form');
    if (ownerLoginForm) {
        ownerLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await ownerLogin();
        });
    }

    // Back to cashier button
    const backToCashierBtn = document.getElementById('back-to-cashier');
    if (backToCashierBtn) {
        backToCashierBtn.addEventListener('click', () => {
            showScreen('login-screen');
        });
    }

    // Logout buttons
    const cashierLogoutBtn = document.getElementById('cashier-logout-btn');
    if (cashierLogoutBtn) {
        cashierLogoutBtn.addEventListener('click', logout);
    }

    const ownerLogoutBtn = document.getElementById('owner-logout-btn');
    if (ownerLogoutBtn) {
        ownerLogoutBtn.addEventListener('click', logout);
    }

    // Load cashiers for dropdown
    loadCashiers();
}

async function logout() {
    if (state.userRole === 'cashier') {
        logAction('logout', { cashierId: state.currentUser?.id, cashierName: state.currentUser?.name });
    } else {
        logAction('logout', { userEmail: state.currentUser?.email, role: 'owner' });
    }

    if (isFirebaseInitialized && auth.currentUser) {
        await auth.signOut();
    }

    state.currentUser = null;
    state.userRole = null;
    state.cart = [];
    state.shiftStartTime = null;
    showScreen('login-screen');
    showToast('Logged out successfully', 'success');
}

// ===================================
// Data Loading
// ===================================

async function loadCashiers() {
    const demoCashiers = [
        { id: 'demo1', name: 'Ravi Kumar', email: 'ravi@chaitime.com', active: true },
        { id: 'demo2', name: 'Priya Sharma', email: 'priya@chaitime.com', active: true },
        { id: 'demo3', name: 'Arjun Patel', email: 'arjun@chaitime.com', active: true }
    ];

    try {
        const response = await fetch('data/cashiers.json');
        if (response.ok) {
            const cashiers = await response.json();
            if (cashiers && cashiers.length > 0) {
                state.cashiers = cashiers;
                populateCashierDropdown(cashiers);
                console.log('✅ Loaded cashiers from local JSON file');
                return;
            }
        }
    } catch (error) {
        console.warn('Could not load cashiers from JSON file:', error);
    }

    // Fallback to demo cashiers if JSON file fails
    console.log('Using demo cashiers');
    state.cashiers = demoCashiers;
    populateCashierDropdown(state.cashiers);
}

function populateCashierDropdown(cashiers) {
    const select = document.getElementById('cashier-select');
    if (select) {
        select.innerHTML = '<option value="">-- Select Your Name --</option>';
        cashiers.filter(c => c.active !== false).forEach(cashier => {
            const option = document.createElement('option');
            option.value = cashier.id;
            option.textContent = cashier.name;
            select.appendChild(option);
        });
    }
}

async function loadItems() {
    try {
        const response = await fetch('data/items.json');
        if (response.ok) {
            const items = await response.json();
            if (items && items.length > 0) {
                state.items = items;
                renderItems(items);
                console.log('✅ Loaded items from local JSON file');
                return;
            }
        }
    } catch (error) {
        console.warn('Could not load items from JSON file:', error);
    }

    // Fallback to demo items if JSON file fails
    console.log('Using demo items');
    state.items = [
        { id: 'item1', nameEn: 'Masala Tea', nameTa: 'மசாலா டீ', category: 'Tea', costPrice: 8, sellingPrice: 15, imageUrl: 'https://images.unsplash.com/photo-1597318130293-c8eb8d0e4d81?w=400', enabled: true },
        { id: 'item2', nameEn: 'Filter Coffee', nameTa: 'பில்டர் காபி', category: 'Coffee', costPrice: 10, sellingPrice: 20, imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400', enabled: true }
    ];
    renderItems(state.items);
}

function renderItems(items) {
    const grid = document.getElementById('items-grid');
    if (!grid) return;

    const enabledItems = items.filter(item => item.enabled !== false);

    // Sort by priority (lower number = higher priority, displayed first)
    enabledItems.sort((a, b) => (a.priority || 99) - (b.priority || 99));

    grid.innerHTML = enabledItems.map(item => `
        <div class="item-card" onclick="addToCart('${item.id}')">
            <img src="${item.imageUrl}" alt="${item.nameEn}" class="item-image" onerror="this.src='https://via.placeholder.com/300'">
            <div class="item-info">
                <div class="item-name">${item.nameEn}</div>
                <div class="item-name-tamil">${item.nameTa}</div>
                <div class="item-price">${formatCurrency(item.sellingPrice)}</div>
            </div>
        </div>
    `).join('');
}

// Category filtering
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');

            const category = e.target.dataset.category;
            const filteredItems = category === 'all'
                ? state.items
                : state.items.filter(item => item.category === category);
            renderItems(filteredItems);
        });
    });
});

// ===================================
// Cart & Billing Module
// ===================================

function addToCart(itemId) {
    const item = state.items.find(i => i.id === itemId);
    if (!item) {
        console.error('Item not found:', itemId);
        return;
    }

    // Validation: Ensure item has required properties
    if (!item.id) {
        console.error('Invalid item: missing id', item);
        showToast('Error adding item to cart', 'error');
        return;
    }

    // Validate and normalize item properties
    const nameEn = item.nameEn || item.name || 'Unknown Item';
    const nameTa = item.nameTa || item.name || '';
    const price = parseFloat(item.sellingPrice || item.price || 0);

    if (price <= 0) {
        console.error('Invalid item price:', item);
        showToast('Error: Invalid item price', 'error');
        return;
    }

    const existingItem = state.cart.find(cartItem => cartItem.id === item.id);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        state.cart.push({
            id: item.id,
            nameEn: nameEn,
            nameTa: nameTa,
            price: price,
            quantity: 1
        });
    }

    renderCart();
    calculateTotal();
    showToast(`${nameEn} added to cart`, 'success');

    // Auto-open billing panel if first item
    const billingPanel = document.getElementById('billing-panel-floating');
    if (billingPanel && state.cart.length === 1) {
        billingPanel.classList.add('active');
    }
}

function renderCart() {
    const cartItems = document.getElementById('cart-items');

    if (!cartItems) return;

    if (state.cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <p>No items added yet</p>
                <p class="hint">Tap items to add to bill</p>
            </div>
        `;
        const proceedBtn = document.getElementById('proceed-payment-btn');
        if (proceedBtn) proceedBtn.disabled = true;
        return;
    }

    cartItems.innerHTML = state.cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.nameEn}</div>
                <div class="cart-item-price">${formatCurrency(item.price)} each</div>
            </div>
            <div class="cart-item-controls">
                <div class="quantity-control">
                    <button class="quantity-btn" onclick="updateQuantity('${item.id}', -1)">−</button>
                    <span class="quantity-value">${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                </div>
                <button class="remove-item" onclick="removeFromCart('${item.id}')">×</button>
            </div>
        </div>
    `).join('');

    const proceedBtn = document.getElementById('proceed-payment-btn');
    if (proceedBtn) proceedBtn.disabled = false;
}

function updateQuantity(itemId, delta) {
    const item = state.cart.find(cartItem => cartItem.id === itemId);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            removeFromCart(itemId);
        } else {
            renderCart();
            calculateTotal();
        }
    }
}

function removeFromCart(itemId) {
    state.cart = state.cart.filter(item => item.id !== itemId);
    renderCart();
    calculateTotal();
}

function calculateTotal() {
    // Validate cart items before calculation
    const validItems = state.cart.filter(item => {
        const price = parseFloat(item.price);
        const quantity = parseInt(item.quantity);
        return !isNaN(price) && !isNaN(quantity) && price > 0 && quantity > 0;
    });

    if (validItems.length !== state.cart.length) {
        console.warn('Some cart items have invalid prices or quantities');
    }

    const subtotal = validItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    let discount = 0;
    const discountRow = document.getElementById('discount-row');
    if (state.settings.discount.enabled) {
        const discountPercent = parseFloat(state.settings.discount.percentage) || 0;
        discount = subtotal * (discountPercent / 100);
        if (discountRow) {
            discountRow.style.display = 'flex';
            const discountPercentEl = document.getElementById('discount-percent');
            const discountAmountEl = document.getElementById('discount-amount');
            if (discountPercentEl) discountPercentEl.textContent = discountPercent;
            if (discountAmountEl) discountAmountEl.textContent = formatCurrency(discount);
        }
    } else {
        if (discountRow) discountRow.style.display = 'none';
    }

    const total = subtotal - discount;

    const subtotalEl = document.getElementById('subtotal');
    const totalEl = document.getElementById('total-amount');
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (totalEl) totalEl.textContent = formatCurrency(total);
}

// ===================================
// Cashier Login
// ===================================

const cashierLoginForm = document.getElementById('cashier-login-form');
if (cashierLoginForm) {
    cashierLoginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const cashierSelect = document.getElementById('cashier-select');

        if (!cashierSelect) {
            showToast('Form elements not found', 'error');
            return;
        }

        const cashierId = cashierSelect.value;

        if (!cashierId) {
            showToast('Please select a cashier', 'warning');
            return;
        }

        const cashier = state.cashiers.find(c => c.id === cashierId);
        if (cashier) {
            state.currentUser = cashier;
            state.userRole = 'cashier';
            state.shiftStartTime = new Date();
            showScreen('cashier-screen');
            const cashierNameEl = document.getElementById('current-cashier-name');
            if (cashierNameEl) {
                cashierNameEl.textContent = cashier.name;
            }
            showToast(`Welcome, ${cashier.name}!`, 'success');
            loadItems();
            logAction('login', { cashierId: cashier.id, cashierName: cashier.name });
        } else {
            showToast('Cashier not found', 'error');
        }
    });
}

// ===================================
// Payment Module
// ===================================

let selectedPaymentMode = null;

// Proceed to payment button
const proceedPaymentBtn = document.getElementById('proceed-payment-btn');
if (proceedPaymentBtn) {
    proceedPaymentBtn.addEventListener('click', () => {
        if (state.cart.length === 0) {
            showToast('Cart is empty', 'warning');
            return;
        }

        // Validate cart has valid items
        const hasInvalidItems = state.cart.some(item => {
            const price = parseFloat(item.price);
            return isNaN(price) || price <= 0;
        });

        if (hasInvalidItems) {
            showToast('Cart contains invalid items', 'error');
            return;
        }

        const total = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const paymentTotalEl = document.getElementById('payment-total');
        const upiAmountEl = document.getElementById('upi-amount');
        if (paymentTotalEl) paymentTotalEl.textContent = formatCurrency(total);
        if (upiAmountEl) upiAmountEl.textContent = total.toFixed(2);

        const modal = document.getElementById('payment-modal');
        if (modal) {
            modal.classList.add('active');
            selectedPaymentMode = null;
            const confirmBtn = document.getElementById('confirm-payment-btn');
            if (confirmBtn) confirmBtn.disabled = true;
            const upiSection = document.getElementById('upi-qr-section');
            if (upiSection) upiSection.style.display = 'none';

            document.querySelectorAll('.payment-mode-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
        }
    });
}

// Payment mode selection
document.querySelectorAll('.payment-mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        selectedPaymentMode = mode;

        document.querySelectorAll('.payment-mode-btn').forEach(b => b.classList.remove('selected'));
        e.currentTarget.classList.add('selected');

        const upiSection = document.getElementById('upi-qr-section');
        if (mode === 'upi') {
            if (state.settings.shop.upiQrUrl) {
                const upiQrImg = document.getElementById('upi-qr-image');
                if (upiQrImg) upiQrImg.src = state.settings.shop.upiQrUrl;
                if (upiSection) upiSection.style.display = 'block';
            } else {
                showToast('UPI QR not configured', 'warning');
            }
        } else {
            if (upiSection) upiSection.style.display = 'none';
        }

        const confirmBtn = document.getElementById('confirm-payment-btn');
        if (confirmBtn) confirmBtn.disabled = false;
    });
});

// Close payment modal
const closePaymentBtn = document.getElementById('close-payment-modal');
const cancelPaymentBtn = document.getElementById('cancel-payment-btn');

if (closePaymentBtn) {
    closePaymentBtn.addEventListener('click', closePaymentModal);
}

if (cancelPaymentBtn) {
    cancelPaymentBtn.addEventListener('click', closePaymentModal);
}

function closePaymentModal() {
    const modal = document.getElementById('payment-modal');
    if (modal) modal.classList.remove('active');
    selectedPaymentMode = null;
}

// Confirm payment
const confirmPaymentBtn = document.getElementById('confirm-payment-btn');
if (confirmPaymentBtn) {
    confirmPaymentBtn.addEventListener('click', async () => {
        if (!selectedPaymentMode) return;
        await processPayment(selectedPaymentMode);
    });
}

async function processPayment(mode) {
    showLoading(true);

    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discount = state.settings.discount.enabled ? subtotal * (state.settings.discount.percentage / 100) : 0;
    const total = subtotal - discount;

    const billData = {
        billNumber: await generateBillNumber(),
        cashierId: state.currentUser?.id || 'unknown',
        cashierName: state.currentUser?.name || 'Unknown',
        items: state.cart.map(item => ({
            itemId: item.id,
            name: item.nameEn,
            price: item.price,
            quantity: item.quantity
        })),
        subtotal,
        discount,
        total,
        paymentMode: mode,
        timestamp: new Date().toISOString(),
        synced: false
    };

    try {
        if (isFirebaseInitialized && navigator.onLine) {
            try {
                await db.ref('bills').push(billData);
                billData.synced = true;
            } catch (firebaseError) {
                console.warn('Firebase save failed, falling back to local storage:', firebaseError);
                savePendingBill(billData);
            }
        } else {
            savePendingBill(billData);
        }

        state.lastBill = billData;
        closePaymentModal();
        showPrintLayout(billData);
        showToast('Payment successful!', 'success');

        // Clear cart
        state.cart = [];
        renderCart();
        calculateTotal();
    } catch (error) {
        console.error('Error processing payment:', error);
        showToast('Error processing payment', 'error');
    } finally {
        showLoading(false);
    }
}

async function generateBillNumber() {
    let lastBillNumber = parseInt(localStorage.getItem('lastBillNumber') || '0');

    if (!isFirebaseInitialized) {
        lastBillNumber++;
        localStorage.setItem('lastBillNumber', lastBillNumber.toString());
        return lastBillNumber;
    }

    try {
        const snapshot = await db.ref('bills').orderByChild('billNumber').limitToLast(1).once('value');
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const bill = childSnapshot.val();
                const firebaseBillNumber = bill.billNumber || 0;
                if (firebaseBillNumber > lastBillNumber) {
                    lastBillNumber = firebaseBillNumber;
                }
            });
        }

        lastBillNumber++;
        localStorage.setItem('lastBillNumber', lastBillNumber.toString());
        return lastBillNumber;
    } catch (error) {
        console.error('Error generating bill number:', error);
        lastBillNumber++;
        localStorage.setItem('lastBillNumber', lastBillNumber.toString());
        return lastBillNumber;
    }
}

function savePendingBill(billData) {
    try {
        const bills = JSON.parse(localStorage.getItem('bills') || '[]');
        bills.push(billData);
        localStorage.setItem('bills', JSON.stringify(bills));
        console.log('Bill saved to localStorage:', billData.billNumber);
    } catch (error) {
        console.error('Error saving bill to localStorage:', error);
    }
}

// Sync pending bills from localStorage to Firebase
async function syncPendingBills() {
    if (!isFirebaseInitialized || !navigator.onLine) {
        console.log('⏸️ Sync skipped: Firebase not initialized or offline');
        return;
    }

    const bills = JSON.parse(localStorage.getItem('bills') || '[]');
    if (bills.length === 0) {
        console.log('✅ No pending bills to sync');
        return;
    }

    console.log(`📡 Syncing ${bills.length} pending bill(s) to Firebase...`);
    const syncedBillNumbers = [];

    for (const bill of bills) {
        try {
            // Mark as synced before pushing
            bill.synced = true;
            await db.ref('bills').push(bill);
            syncedBillNumbers.push(bill.billNumber);
            console.log(`✅ Bill #${bill.billNumber} synced to Firebase`);
        } catch (error) {
            console.error(`❌ Failed to sync bill #${bill.billNumber}:`, error);
        }
    }

    // Remove synced bills from localStorage
    if (syncedBillNumbers.length > 0) {
        const remainingBills = bills.filter(b => !syncedBillNumbers.includes(b.billNumber));
        localStorage.setItem('bills', JSON.stringify(remainingBills));
        console.log(`✅ Synced ${syncedBillNumbers.length} bill(s). ${remainingBills.length} remaining.`);

        if (syncedBillNumbers.length > 0) {
            showToast(`${syncedBillNumbers.length} bill(s) synced to cloud ☁️`, 'success');
        }
    }
}

// Auto-sync when coming online
window.addEventListener('online', () => {
    console.log('🌐 Network restored. Syncing pending bills...');
    showToast('Connection restored! Syncing bills...', 'info');
    syncPendingBills();
});

// Sync on page load if online
document.addEventListener('DOMContentLoaded', () => {
    if (isFirebaseInitialized && navigator.onLine) {
        // Delay sync slightly to let Firebase fully initialize
        setTimeout(syncPendingBills, 2000);
    }
});

// ===================================
// Print Module
// ===================================

function showPrintLayout(billData) {
    const printCafeName = document.getElementById('print-cafe-name');
    const printBillNumber = document.getElementById('print-bill-number');
    const printDate = document.getElementById('print-date');
    const printCashier = document.getElementById('print-cashier');

    if (printCafeName) printCafeName.textContent = state.settings.shop.name;
    if (printBillNumber) printBillNumber.textContent = billData.billNumber;
    if (printDate) printDate.textContent = formatDate(billData.timestamp);
    if (printCashier) printCashier.textContent = billData.cashierName;

    const tbody = document.getElementById('print-items-body');
    if (tbody) {
        tbody.innerHTML = '';
        billData.items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${formatCurrency(item.price * item.quantity)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    const printSubtotal = document.getElementById('print-subtotal');
    const printDiscountLine = document.getElementById('print-discount-line');
    const printDiscount = document.getElementById('print-discount');
    const printTotal = document.getElementById('print-total');
    const printPaymentMode = document.getElementById('print-payment-mode');
    const printFooterText = document.getElementById('print-footer-text');

    if (printSubtotal) printSubtotal.textContent = formatCurrency(billData.subtotal);

    if (billData.discount > 0) {
        if (printDiscountLine) printDiscountLine.style.display = 'block';
        if (printDiscount) printDiscount.textContent = formatCurrency(billData.discount);
    } else {
        if (printDiscountLine) printDiscountLine.style.display = 'none';
    }

    if (printTotal) printTotal.textContent = formatCurrency(billData.total);
    if (printPaymentMode) printPaymentMode.textContent = billData.paymentMode.toUpperCase();
    if (printFooterText) printFooterText.textContent = state.settings.shop.footerText;

    const printLayout = document.getElementById('print-layout');
    if (printLayout) printLayout.classList.add('active');
}

// Print button
const printBtn = document.getElementById('print-btn');
if (printBtn) {
    printBtn.addEventListener('click', () => {
        window.print();
        logAction('print', { billNumber: state.lastBill?.billNumber });
    });
}

// New bill button
const newBillBtn = document.getElementById('new-bill-btn');
if (newBillBtn) {
    newBillBtn.addEventListener('click', () => {
        const printLayout = document.getElementById('print-layout');
        if (printLayout) printLayout.classList.remove('active');
    });
}

// Reprint button
const reprintBtn = document.getElementById('reprint-btn');
if (reprintBtn) {
    reprintBtn.addEventListener('click', () => {
        if (state.lastBill) {
            showPrintLayout(state.lastBill);
            logAction('reprint', { billNumber: state.lastBill.billNumber });
        } else {
            showToast('No previous bill to reprint', 'warning');
        }
    });
}

// ===================================
// Shift Close Module
// ===================================

const closeShiftBtn = document.getElementById('close-shift-btn');
if (closeShiftBtn) {
    closeShiftBtn.addEventListener('click', async () => {
        showLoading(true);

        try {
            const shiftData = await calculateShiftSummary();

            const shiftBillCount = document.getElementById('shift-bill-count');
            const shiftCashTotal = document.getElementById('shift-cash-total');
            const shiftUpiTotal = document.getElementById('shift-upi-total');
            const shiftGrandTotal = document.getElementById('shift-grand-total');

            if (shiftBillCount) shiftBillCount.textContent = shiftData.billCount;
            if (shiftCashTotal) shiftCashTotal.textContent = formatCurrency(shiftData.cashTotal);
            if (shiftUpiTotal) shiftUpiTotal.textContent = formatCurrency(shiftData.upiTotal);
            if (shiftGrandTotal) shiftGrandTotal.textContent = formatCurrency(shiftData.grandTotal);

            const modal = document.getElementById('shift-close-modal');
            if (modal) modal.classList.add('active');
        } catch (error) {
            console.error('Error calculating shift:', error);
            showToast('Error calculating shift summary', 'error');
        } finally {
            showLoading(false);
        }
    });
}

async function calculateShiftSummary() {
    const shiftStartTimestamp = state.shiftStartTime ? state.shiftStartTime.getTime() : 0;

    let cashTotal = 0;
    let upiTotal = 0;
    let billCount = 0;
    let allBills = [];

    // Fetch from Firebase if available
    if (isFirebaseInitialized && navigator.onLine) {
        try {
            console.log('📡 Fetching shift bills from Firebase...');
            const snapshot = await db.ref('bills')
                .orderByChild('cashierId')
                .equalTo(state.currentUser?.id)
                .once('value');

            if (snapshot.exists()) {
                snapshot.forEach(childSnapshot => {
                    const bill = childSnapshot.val();
                    const billTimestamp = new Date(bill.timestamp).getTime();
                    if (billTimestamp >= shiftStartTimestamp) {
                        allBills.push(bill);
                    }
                });
            }
            console.log('✅ Fetched', allBills.length, 'bills from Firebase for shift');
        } catch (firebaseError) {
            console.warn('⚠️ Firebase fetch failed for shift summary:', firebaseError);
        }
    }

    // Also check localStorage for unsynced bills
    const localBills = JSON.parse(localStorage.getItem('bills') || '[]');
    localBills.forEach(bill => {
        const billTimestamp = new Date(bill.timestamp).getTime();
        if (billTimestamp >= shiftStartTimestamp && bill.cashierId === state.currentUser?.id) {
            const exists = allBills.some(b => b.billNumber === bill.billNumber);
            if (!exists) {
                allBills.push(bill);
            }
        }
    });

    allBills.forEach(bill => {
        billCount++;
        if (bill.paymentMode === 'cash') {
            cashTotal += bill.total;
        } else {
            upiTotal += bill.total;
        }
    });

    return {
        billCount,
        cashTotal,
        upiTotal,
        grandTotal: cashTotal + upiTotal
    };
}

const cancelShiftClose = document.getElementById('cancel-shift-close');
if (cancelShiftClose) {
    cancelShiftClose.addEventListener('click', () => {
        const modal = document.getElementById('shift-close-modal');
        if (modal) modal.classList.remove('active');
    });
}

const confirmShiftClose = document.getElementById('confirm-shift-close');
if (confirmShiftClose) {
    confirmShiftClose.addEventListener('click', async () => {
        const shiftData = {
            cashierId: state.currentUser?.id,
            cashierName: state.currentUser?.name,
            startTime: state.shiftStartTime?.toISOString(),
            endTime: new Date().toISOString(),
            cashTotal: parseFloat(document.getElementById('shift-cash-total')?.textContent.replace('₹', '') || 0),
            upiTotal: parseFloat(document.getElementById('shift-upi-total')?.textContent.replace('₹', '') || 0),
            billCount: parseInt(document.getElementById('shift-bill-count')?.textContent || 0)
        };

        if (isFirebaseInitialized) {
            try {
                await db.ref('shifts').push(shiftData);
            } catch (error) {
                console.error('Error saving shift:', error);
            }
        }

        logAction('shift', shiftData);
        const modal = document.getElementById('shift-close-modal');
        if (modal) modal.classList.remove('active');
        logout();
    });
}

// ===================================
// My Bills Module
// ===================================

const myBillsBtn = document.getElementById('my-bills-btn');
if (myBillsBtn) {
    myBillsBtn.addEventListener('click', () => {
        loadMyBills();
        const modal = document.getElementById('my-bills-modal');
        if (modal) modal.classList.add('active');
    });
}

const closeMyBillsModal = document.getElementById('close-my-bills-modal');
if (closeMyBillsModal) {
    closeMyBillsModal.addEventListener('click', () => {
        const modal = document.getElementById('my-bills-modal');
        if (modal) modal.classList.remove('active');
    });
}

async function loadMyBills() {
    const tbody = document.getElementById('my-bills-table-body');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading bills from cloud...</td></tr>';
    }

    if (!state.currentUser) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="hint">Please login first</td></tr>';
        return;
    }

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();

        let myBills = [];

        // Fetch from Firebase if available
        if (isFirebaseInitialized && navigator.onLine) {
            try {
                console.log('📡 Fetching bills from Firebase for cashier:', state.currentUser.id);
                const snapshot = await db.ref('bills')
                    .orderByChild('cashierId')
                    .equalTo(state.currentUser.id)
                    .once('value');

                if (snapshot.exists()) {
                    snapshot.forEach(childSnapshot => {
                        const bill = childSnapshot.val();
                        bill.firebaseKey = childSnapshot.key;
                        const billTimestamp = new Date(bill.timestamp).getTime();
                        // Filter for today only
                        if (billTimestamp >= todayTimestamp) {
                            myBills.push(bill);
                        }
                    });
                }
                console.log('✅ Fetched', myBills.length, 'bills from Firebase for today');
            } catch (firebaseError) {
                console.warn('⚠️ Firebase fetch failed, using localStorage:', firebaseError);
            }
        }

        // Also check localStorage for any unsynced bills
        const localBills = JSON.parse(localStorage.getItem('bills') || '[]');
        localBills.forEach(bill => {
            const billTimestamp = new Date(bill.timestamp).getTime();
            if (billTimestamp >= todayTimestamp && bill.cashierId === state.currentUser.id) {
                // Check if this bill is already in the Firebase results
                const exists = myBills.some(b => b.billNumber === bill.billNumber);
                if (!exists) {
                    bill.isLocal = true;
                    myBills.push(bill);
                }
            }
        });

        // Calculate totals
        let totalSales = 0;
        let cashTotal = 0;
        let upiTotal = 0;

        myBills.forEach(bill => {
            totalSales += bill.total || 0;
            if (bill.paymentMode === 'cash') {
                cashTotal += bill.total || 0;
            } else {
                upiTotal += bill.total || 0;
            }
        });

        // Sort by timestamp descending
        myBills.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Update summary
        const myBillsCount = document.getElementById('my-bills-count');
        const myBillsTotal = document.getElementById('my-bills-total');
        const myBillsCash = document.getElementById('my-bills-cash');
        const myBillsUpi = document.getElementById('my-bills-upi');

        if (myBillsCount) myBillsCount.textContent = myBills.length;
        if (myBillsTotal) myBillsTotal.textContent = formatCurrency(totalSales);
        if (myBillsCash) myBillsCash.textContent = formatCurrency(cashTotal);
        if (myBillsUpi) myBillsUpi.textContent = formatCurrency(upiTotal);

        // Render bills table
        if (tbody) {
            tbody.innerHTML = '';

            if (myBills.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="hint">No bills found for today</td></tr>';
                return;
            }

            myBills.forEach(bill => {
                const row = document.createElement('tr');
                const billTime = new Date(bill.timestamp);
                const timeStr = billTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                const itemsCount = bill.items ? bill.items.length : 0;
                const itemsSummary = bill.items ? bill.items.map(item => `${item.name} (${item.quantity})`).join(', ') : '';
                const localBadge = bill.isLocal ? ' <span class="sync-badge" title="Not synced to cloud">📴</span>' : '';

                row.innerHTML = `
                    <td><strong>#${bill.billNumber}</strong>${localBadge}</td>
                    <td>${timeStr}</td>
                    <td title="${itemsSummary}">${itemsCount} item${itemsCount !== 1 ? 's' : ''}</td>
                    <td><strong>${formatCurrency(bill.total)}</strong></td>
                    <td><span class="payment-badge ${bill.paymentMode}">${bill.paymentMode === 'cash' ? '💵 Cash' : '📱 UPI'}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline" onclick="viewBillDetails(${bill.billNumber})">View</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
    } catch (error) {
        console.error('Error loading my bills:', error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="hint">Error loading bills</td></tr>';
    }
}

async function viewBillDetails(billNumber) {
    showLoading(true);

    try {
        let billData = null;

        // Convert billNumber to number for proper comparison
        const billNum = typeof billNumber === 'string' ? parseInt(billNumber, 10) : billNumber;
        console.log('🔍 Looking for bill:', billNum);

        // Try Firebase first (since bills are now stored there)
        if (isFirebaseInitialized && navigator.onLine) {
            try {
                console.log('📡 Searching Firebase for bill:', billNum);
                const snapshot = await db.ref('bills')
                    .orderByChild('billNumber')
                    .equalTo(billNum)
                    .once('value');

                if (snapshot.exists()) {
                    snapshot.forEach(childSnapshot => {
                        billData = childSnapshot.val();
                        console.log('✅ Found bill in Firebase:', billData.billNumber);
                    });
                }
            } catch (error) {
                console.error('Error fetching bill from Firebase:', error);
            }
        }

        // If not found in Firebase, try localStorage
        if (!billData) {
            console.log('🔍 Searching localStorage for bill:', billNum);
            const localBills = JSON.parse(localStorage.getItem('bills') || '[]');
            billData = localBills.find(bill => bill.billNumber === billNum || bill.billNumber === billNumber);
            if (billData) {
                console.log('✅ Found bill in localStorage:', billData.billNumber);
            }
        }

        if (!billData) {
            showToast('Bill not found', 'error');
            console.error('❌ Bill not found:', billNum);
            return;
        }

        // Populate bill details modal
        const detailBillNumber = document.getElementById('detail-bill-number');
        const detailDateTime = document.getElementById('detail-date-time');
        const detailCashier = document.getElementById('detail-cashier');
        const detailPaymentMode = document.getElementById('detail-payment-mode');
        const detailItemsBody = document.getElementById('detail-items-body');
        const detailSubtotal = document.getElementById('detail-subtotal');
        const detailDiscount = document.getElementById('detail-discount');
        const detailDiscountRow = document.getElementById('detail-discount-row');
        const detailTotal = document.getElementById('detail-total');

        if (detailBillNumber) detailBillNumber.textContent = `#${billData.billNumber}`;
        if (detailDateTime) detailDateTime.textContent = formatDate(billData.timestamp);
        if (detailCashier) detailCashier.textContent = billData.cashierName || 'Unknown';
        if (detailPaymentMode) {
            const modeText = billData.paymentMode === 'cash' ? '💵 Cash' : '📱 UPI';
            detailPaymentMode.textContent = modeText;
        }

        // Populate items table
        if (detailItemsBody) {
            detailItemsBody.innerHTML = '';
            if (billData.items && billData.items.length > 0) {
                billData.items.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.name}</td>
                        <td>${item.quantity}</td>
                        <td>${formatCurrency(item.price)}</td>
                        <td>${formatCurrency(item.price * item.quantity)}</td>
                    `;
                    detailItemsBody.appendChild(row);
                });
            } else {
                detailItemsBody.innerHTML = '<tr><td colspan="4" class="hint">No items</td></tr>';
            }
        }

        // Populate totals
        if (detailSubtotal) detailSubtotal.textContent = formatCurrency(billData.subtotal || 0);
        if (detailTotal) detailTotal.textContent = formatCurrency(billData.total || 0);

        // Show/hide discount row
        if (billData.discount && billData.discount > 0) {
            if (detailDiscountRow) detailDiscountRow.style.display = 'flex';
            if (detailDiscount) detailDiscount.textContent = formatCurrency(billData.discount);
        } else {
            if (detailDiscountRow) detailDiscountRow.style.display = 'none';
        }

        // Store current bill for reprint
        state.currentViewedBill = billData;

        // Show the modal
        const modal = document.getElementById('bill-details-modal');
        if (modal) modal.classList.add('active');

    } catch (error) {
        console.error('Error viewing bill details:', error);
        showToast('Error loading bill details', 'error');
    } finally {
        showLoading(false);
    }
}

// Close bill details modal
const closeBillDetailsModal = document.getElementById('close-bill-details-modal');
const closeDetailsBtn = document.getElementById('close-details-btn');

if (closeBillDetailsModal) {
    closeBillDetailsModal.addEventListener('click', () => {
        const modal = document.getElementById('bill-details-modal');
        if (modal) modal.classList.remove('active');
    });
}

if (closeDetailsBtn) {
    closeDetailsBtn.addEventListener('click', () => {
        const modal = document.getElementById('bill-details-modal');
        if (modal) modal.classList.remove('active');
    });
}

// Reprint from details modal
const reprintDetailsBtn = document.getElementById('reprint-details-btn');
if (reprintDetailsBtn) {
    reprintDetailsBtn.addEventListener('click', () => {
        if (state.currentViewedBill) {
            showPrintLayout(state.currentViewedBill);
            const modal = document.getElementById('bill-details-modal');
            if (modal) modal.classList.remove('active');
            logAction('reprint', { billNumber: state.currentViewedBill.billNumber });
        } else {
            showToast('No bill data available', 'error');
        }
    });
}


// ===================================
// Other Buttons
// ===================================

// Clear cart button
const clearCartBtn = document.getElementById('clear-cart-btn');
if (clearCartBtn) {
    clearCartBtn.addEventListener('click', () => {
        if (state.cart.length > 0 && confirm('Clear all items from cart?')) {
            state.cart = [];
            renderCart();
            calculateTotal();
            showToast('Cart cleared', 'success');
        }
    });
}

// Toggle billing panel
const toggleBillingBtn = document.getElementById('toggle-billing-btn');
const closeBillingPanel = document.getElementById('close-billing-panel');

if (toggleBillingBtn) {
    toggleBillingBtn.addEventListener('click', () => {
        const billingPanel = document.getElementById('billing-panel-floating');
        if (billingPanel) {
            billingPanel.classList.toggle('active');
        }
    });
}

if (closeBillingPanel) {
    closeBillingPanel.addEventListener('click', () => {
        const billingPanel = document.getElementById('billing-panel-floating');
        if (billingPanel) {
            billingPanel.classList.remove('active');
        }
    });
}

// ===================================
// Audit Logs
// ===================================

async function logAction(action, details) {
    const logData = {
        action,
        userId: state.currentUser?.id || state.currentUser?.email || 'unknown',
        userName: state.currentUser?.name || 'Unknown',
        details,
        timestamp: new Date()
    };

    if (isFirebaseInitialized) {
        try {
            await db.ref('audit').push(logData);
        } catch (error) {
            console.error('Error logging action:', error);
        }
    } else {
        const logs = JSON.parse(localStorage.getItem('auditLogs') || '[]');
        logs.push(logData);
        localStorage.setItem('auditLogs', JSON.stringify(logs));
    }
}

// ===================================
// Owner Navigation
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const section = e.currentTarget.dataset.section;
            navigateOwnerSection(section);
        });
    });
});

// ===================================
// Initialization
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    initAuth();

    // Set default dates for reports
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const reportFromDate = document.getElementById('report-from-date');
    const reportToDate = document.getElementById('report-to-date');

    if (reportFromDate) reportFromDate.value = weekAgo;
    if (reportToDate) reportToDate.value = today;

    // Keyboard shortcut for admin access (Ctrl+Shift+A)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'A') {
            e.preventDefault();
            const currentScreen = state.currentScreen;

            if (currentScreen === 'login-screen' || currentScreen === 'owner-login-screen') {
                if (currentScreen === 'login-screen') {
                    showScreen('owner-login-screen');
                    showToast('Admin login activated (Ctrl+Shift+A)', 'info');
                } else {
                    showScreen('login-screen');
                    showToast('Switched to cashier login', 'info');
                }
            } else {
                showToast('Admin shortcut: Ctrl+Shift+A (available on login screen)', 'info');
            }
        }
    });

    console.log('Chai Time POS System initialized');
    console.log('Demo Credentials:');
    console.log('Cashier: Select any cashier');
    console.log('Owner: test@test.com, password: test123');
    console.log('');
    console.log('🔑 Admin Access Shortcuts:');
    console.log('  - Keyboard: Ctrl+Shift+A (on login screen)');
    console.log('  - Logo: Tap 3 times on the cafe logo');
});
