// ===================================
// Owner Portal - Dashboard & Analytics (Rebuilt)
// ===================================

// Load data from JSON files
async function loadJSONData(filename) {
    try {
        const response = await fetch(`data/${filename}`);
        if (!response.ok) {
            throw new Error(`Failed to load ${filename}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error loading ${filename}:`, error);
        return [];
    }
}

async function loadItemsFromJSON() {
    const items = await loadJSONData('items.json');
    if (items.length > 0) {
        state.items = items;
    }
    return items;
}

async function loadCashiersFromJSON() {
    const cashiers = await loadJSONData('cashiers.json');
    if (cashiers.length > 0) {
        state.cashiers = cashiers;
    }
    return cashiers;
}

async function loadRawMaterialsFromJSON() {
    const rawMaterials = await loadJSONData('raw-materials.json');

    return rawMaterials;
}

// ===================================
// Dashboard Analytics
// ===================================

let monthlyChart, paymentChart, itemsChart;

async function loadDashboard() {


    // Rate limiting check
    if (typeof rateLimiter !== 'undefined' && !rateLimiter.canProceed()) {
        showToast('Too many requests. Please wait a moment.', 'warning');
        return;
    }

    await loadItemsFromJSON();
    await loadCashiersFromJSON();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todaySales = 0;
    let todayBills = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let itemsSold = {};
    let cashierSales = {};

    if (isFirebaseInitialized) {
        try {
            const billsRef = db.ref('bills');
            const snapshot = await billsRef.once('value');
            const bills = snapshot.val() || {};

            Object.values(bills).forEach(bill => {
                const billDate = new Date(bill.timestamp);
                billDate.setHours(0, 0, 0, 0);

                if (billDate.getTime() === today.getTime()) {
                    todaySales += bill.total || 0;
                    todayBills++;

                    if (bill.paymentMode === 'cash') {
                        cashTotal += bill.total || 0;
                    } else {
                        upiTotal += bill.total || 0;
                    }

                    if (bill.items) {
                        bill.items.forEach(item => {
                            const itemName = item.name || item.nameEn || 'Unknown';
                            if (!itemsSold[itemName]) {
                                itemsSold[itemName] = { quantity: 0, revenue: 0 };
                            }
                            itemsSold[itemName].quantity += item.quantity || 0;
                            const itemPrice = item.price || item.sellingPrice || 0;
                            itemsSold[itemName].revenue += (itemPrice * item.quantity) || 0;
                        });
                    }

                    if (bill.cashierName) {
                        if (!cashierSales[bill.cashierName]) {
                            cashierSales[bill.cashierName] = { bills: 0, total: 0 };
                        }
                        cashierSales[bill.cashierName].bills++;
                        cashierSales[bill.cashierName].total += bill.total || 0;
                    }
                }
            });
        } catch (error) {
            console.error('Error loading bills:', error);
        }
    }

    // Calculate profit
    let rawMaterials = [];
    if (isFirebaseInitialized) {
        try {
            const rmSnapshot = await db.ref('rawMaterials').once('value');
            const rmData = rmSnapshot.val() || {};
            rawMaterials = Object.values(rmData);
        } catch (error) {
            console.error('Error loading raw materials for profit calc:', error);
        }
    }

    const todayRawMaterialCost = rawMaterials
        .filter(rm => {
            const rmDate = new Date(rm.date);
            rmDate.setHours(0, 0, 0, 0);
            return rmDate.getTime() === today.getTime();
        })
        .reduce((sum, rm) => sum + (rm.price || 0), 0);

    let todayItemCosts = 0;
    Object.keys(itemsSold).forEach(itemName => {
        const item = state.items.find(i => i.nameEn === itemName);
        if (item) {
            todayItemCosts += (item.costPrice || 0) * itemsSold[itemName].quantity;
        }
    });

    const todayProfit = todaySales - todayItemCosts - todayRawMaterialCost;

    // Update dashboard metrics
    const todaySalesEl = document.getElementById('today-sales');
    const todayBillsEl = document.getElementById('today-bills');
    const todayProfitEl = document.getElementById('today-profit');

    if (todaySalesEl) todaySalesEl.textContent = formatCurrency(todaySales);
    if (todayBillsEl) todayBillsEl.textContent = todayBills;
    if (todayProfitEl) todayProfitEl.textContent = formatCurrency(todayProfit);

    // Calculate monthly sales
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    let monthSales = 0;

    if (isFirebaseInitialized) {
        try {
            const billsRef = db.ref('bills');
            const snapshot = await billsRef.once('value');
            const bills = snapshot.val() || {};

            Object.values(bills).forEach(bill => {
                const billDate = new Date(bill.timestamp);
                if (billDate >= monthStart) {
                    monthSales += bill.total || 0;
                }
            });
        } catch (error) {
            console.error('Error calculating monthly sales:', error);
        }
    }

    const monthSalesEl = document.getElementById('month-sales');
    if (monthSalesEl) monthSalesEl.textContent = formatCurrency(monthSales);

    await createMonthlyChart();
    createPaymentModeChart(cashTotal, upiTotal);
    createItemsChart(itemsSold);
    displayCashierPerformance(cashierSales);
    displayItemsSoldToday(itemsSold);
}

async function createMonthlyChart() {
    const ctx = document.getElementById('monthly-sales-chart');
    if (!ctx) return;

    if (monthlyChart) {
        monthlyChart.destroy();
    }

    const labels = [];
    const data = [];
    const today = new Date();

    // Get last 30 days of sales data
    const dailySales = {};

    if (isFirebaseInitialized) {
        try {
            const billsRef = db.ref('bills');
            const snapshot = await billsRef.once('value');
            const bills = snapshot.val() || {};

            Object.values(bills).forEach(bill => {
                const billDate = new Date(bill.timestamp);
                const dateKey = billDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                if (!dailySales[dateKey]) {
                    dailySales[dateKey] = 0;
                }
                dailySales[dateKey] += bill.total || 0;
            });
        } catch (error) {
            console.error('Error loading bills for chart:', error);
        }
    }

    // Build chart data for last 30 days
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        labels.push(dateKey);
        data.push(dailySales[dateKey] || 0);
    }

    monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Sales',
                data: data,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return '₹' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function createPaymentModeChart(cash, upi) {
    const ctx = document.getElementById('payment-mode-chart');
    if (!ctx) return;

    if (paymentChart) {
        paymentChart.destroy();
    }

    paymentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Cash', 'UPI'],
            datasets: [{
                data: [cash, upi],
                backgroundColor: ['#10b981', '#3b82f6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function createItemsChart(itemsSold) {
    const ctx = document.getElementById('items-chart');
    if (!ctx) return;

    if (itemsChart) {
        itemsChart.destroy();
    }

    const sortedItems = Object.entries(itemsSold)
        .sort((a, b) => b[1].quantity - a[1].quantity)
        .slice(0, 5);

    const labels = sortedItems.map(([name]) => name);
    const data = sortedItems.map(([, stats]) => stats.quantity);

    itemsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Quantity Sold',
                data: data,
                backgroundColor: '#8b5cf6',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function displayCashierPerformance(cashierSales) {
    const container = document.getElementById('cashier-performance-list');
    if (!container) return;

    const sortedCashiers = Object.entries(cashierSales)
        .sort((a, b) => b[1].total - a[1].total);

    if (sortedCashiers.length === 0) {
        container.innerHTML = '<p class="hint">No sales data for today</p>';
        return;
    }

    container.innerHTML = sortedCashiers.map(([name, stats]) => `
        <div class="cashier-stat">
            <div class="cashier-name">${name}</div>
            <div class="cashier-stats">
                <span>${stats.bills} bills</span>
                <span class="cashier-total">${formatCurrency(stats.total)}</span>
            </div>
        </div>
    `).join('');
}

function displayItemsSoldToday(itemsSold) {
    const tbody = document.getElementById('items-sold-today-body');
    const tfoot = document.getElementById('items-sold-today-footer');

    if (!tbody) return;

    const sortedItems = Object.entries(itemsSold)
        .sort((a, b) => b[1].quantity - a[1].quantity);

    if (sortedItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="hint">No items sold today</td></tr>';
        if (tfoot) tfoot.style.display = 'none';
        return;
    }

    let totalQuantity = 0;
    let totalRevenue = 0;

    tbody.innerHTML = sortedItems.map(([name, stats]) => {
        totalQuantity += stats.quantity;
        totalRevenue += stats.revenue;
        return `
            <tr>
                <td>${name}</td>
                <td>${stats.quantity}</td>
                <td>${formatCurrency(stats.revenue)}</td>
            </tr>
        `;
    }).join('');

    // Update footer totals
    const totalItemsSoldEl = document.getElementById('total-items-sold');
    const totalItemsRevenueEl = document.getElementById('total-items-revenue');

    if (totalItemsSoldEl) totalItemsSoldEl.textContent = totalQuantity;
    if (totalItemsRevenueEl) totalItemsRevenueEl.textContent = formatCurrency(totalRevenue);
    if (tfoot) tfoot.style.display = 'table-footer-group';
}

// ===================================
// Raw Materials Management (Firebase)
// ===================================

async function loadRawMaterialsTable() {
    const tbody = document.getElementById('raw-materials-table-body');
    if (!tbody) return;

    // Rate limiting check
    if (typeof rateLimiter !== 'undefined' && !rateLimiter.canProceed()) {
        showToast('Too many requests. Please wait a moment.', 'warning');
        return;
    }

    let rawMaterials = [];

    if (isFirebaseInitialized) {
        try {
            const snapshot = await db.ref('rawMaterials').once('value');
            const rmData = snapshot.val() || {};
            rawMaterials = Object.keys(rmData).map(key => ({
                id: key,
                ...rmData[key]
            }));

        } catch (error) {
            console.error('Error loading raw materials from Firebase:', error);
        }
    }

    if (rawMaterials.length === 0) {
        rawMaterials = await loadRawMaterialsFromJSON();

        if (isFirebaseInitialized && rawMaterials.length > 0) {
            try {
                for (const rm of rawMaterials) {
                    await db.ref('rawMaterials').push(rm);
                }

            } catch (error) {
                console.error('Error saving to Firebase:', error);
            }
        }
    }

    if (rawMaterials.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="hint">No purchases recorded</td></tr>';
        updateRawMaterialsSummary([]);
        return;
    }

    rawMaterials.sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = rawMaterials.map(rm => `
        <tr>
            <td>${new Date(rm.date).toLocaleDateString('en-IN')}</td>
            <td>${rm.itemName}</td>
            <td>${rm.quantity}</td>
            <td>${formatCurrency(rm.price)}</td>
            <td>${rm.notes || '-'}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="deleteRawMaterial('${rm.id}')">Delete</button>
            </td>
        </tr>
    `).join('');

    updateRawMaterialsSummary(rawMaterials);
}

function updateRawMaterialsSummary(rawMaterials) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayTotal = rawMaterials
        .filter(rm => {
            const rmDate = new Date(rm.date);
            rmDate.setHours(0, 0, 0, 0);
            return rmDate.getTime() === today.getTime();
        })
        .reduce((sum, rm) => sum + (rm.price || 0), 0);

    const monthTotal = rawMaterials
        .filter(rm => new Date(rm.date) >= monthStart)
        .reduce((sum, rm) => sum + (rm.price || 0), 0);

    const todayEl = document.getElementById('today-raw-materials');
    const monthEl = document.getElementById('month-raw-materials');

    if (todayEl) todayEl.textContent = formatCurrency(todayTotal);
    if (monthEl) monthEl.textContent = formatCurrency(monthTotal);
}

async function deleteRawMaterial(id) {
    if (!confirm('Delete this purchase record?')) return;

    // Rate limiting check
    if (typeof rateLimiter !== 'undefined' && !rateLimiter.canProceed()) {
        showToast('Too many requests. Please wait a moment.', 'warning');
        return;
    }

    if (isFirebaseInitialized) {
        try {
            await db.ref(`rawMaterials/${id}`).remove();
            showToast('Purchase deleted', 'success');
            await loadRawMaterialsTable();
        } catch (error) {
            console.error('Error deleting raw material:', error);
            showToast('Error deleting purchase', 'error');
        }
    } else {
        showToast('Firebase not initialized', 'error');
    }
}

// Raw Material Form
const rmModal = document.getElementById('raw-material-form-modal');
const rmForm = document.getElementById('raw-material-form');
const addRmBtn = document.getElementById('add-raw-material-btn');
const closeRmBtn = document.getElementById('close-raw-material-modal');
const cancelRmBtn = document.getElementById('cancel-rm-form');

if (addRmBtn) {
    addRmBtn.addEventListener('click', () => {
        const rmDateInput = document.getElementById('rm-date');
        if (rmDateInput) {
            rmDateInput.valueAsDate = new Date();
        }
        if (rmModal) {
            rmModal.classList.add('active');
        }
    });
}

if (closeRmBtn) {
    closeRmBtn.addEventListener('click', () => {
        if (rmModal) {
            rmModal.classList.remove('active');
        }
        if (rmForm) {
            rmForm.reset();
        }
    });
}

if (cancelRmBtn) {
    cancelRmBtn.addEventListener('click', () => {
        if (rmModal) {
            rmModal.classList.remove('active');
        }
        if (rmForm) {
            rmForm.reset();
        }
    });
}

if (rmForm) {
    rmForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Rate limiting check
        if (typeof rateLimiter !== 'undefined' && !rateLimiter.canProceed()) {
            showToast('Too many requests. Please wait a moment.', 'warning');
            return;
        }

        const newRM = {
            date: document.getElementById('rm-date').value,
            itemName: document.getElementById('rm-item-name').value,
            quantity: document.getElementById('rm-quantity').value,
            price: parseFloat(document.getElementById('rm-price').value),
            notes: document.getElementById('rm-notes').value,
            timestamp: new Date().toISOString()
        };

        if (isFirebaseInitialized) {
            try {
                await db.ref('rawMaterials').push(newRM);
                showToast('Purchase added successfully', 'success');

                if (rmModal) {
                    rmModal.classList.remove('active');
                }
                if (rmForm) {
                    rmForm.reset();
                }

                await loadRawMaterialsTable();
            } catch (error) {
                console.error('Error adding raw material:', error);
                showToast('Error adding purchase', 'error');
            }
        } else {
            showToast('Firebase not initialized', 'error');
        }
    });
}

// ===================================
// Reports Generation
// ===================================

let ownerReportType = 'item';
let ownerReportData = null;

document.querySelectorAll('.report-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        ownerReportType = e.target.dataset.report;
    });
});

const generateReportBtn = document.getElementById('generate-report-btn');
if (generateReportBtn) {
    generateReportBtn.addEventListener('click', async () => {
        const fromDate = document.getElementById('report-from-date').value;
        const toDate = document.getElementById('report-to-date').value;

        if (!fromDate || !toDate) {
            showToast('Please select date range', 'warning');
            return;
        }

        showLoading(true);

        try {
            const reportData = await generateReport(ownerReportType, fromDate, toDate);
            ownerReportData = reportData;
            displayReport(reportData, ownerReportType);
        } catch (error) {
            console.error('Error generating report:', error);
            showToast('Error generating report', 'error');
        } finally {
            showLoading(false);
        }
    });
}

async function generateReport(type, fromDate, toDate) {
    // Rate limiting check
    if (typeof rateLimiter !== 'undefined' && !rateLimiter.canProceed()) {
        showToast('Too many requests. Please wait a moment.', 'warning');
        return null;
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    let bills = [];

    if (isFirebaseInitialized) {
        try {
            const billsRef = db.ref('bills');
            const snapshot = await billsRef.once('value');
            const allBills = snapshot.val() || {};

            bills = Object.values(allBills).filter(bill => {
                const billDate = new Date(bill.timestamp);
                return billDate >= start && billDate <= end;
            });
        } catch (error) {
            console.error('Error fetching bills:', error);
        }
    }

    switch (type) {
        case 'item':
            return generateItemWiseReport(bills);
        case 'cashier':
            return generateCashierReport(bills);
        case 'profit':
            return await generateProfitReportAsync(bills, fromDate, toDate);
        case 'consolidated':
            return await generateConsolidatedReportAsync(bills, fromDate, toDate);
        default:
            return {};
    }
}

function generateItemWiseReport(bills) {
    const itemStats = {};

    bills.forEach(bill => {
        if (bill.items) {
            bill.items.forEach(item => {
                // Use item.name (how it's saved in bills) with fallback to item.nameEn
                const itemName = item.name || item.nameEn || 'Unknown Item';

                if (!itemStats[itemName]) {
                    itemStats[itemName] = {
                        quantity: 0,
                        revenue: 0,
                        cost: 0
                    };
                }

                itemStats[itemName].quantity += item.quantity || 0;
                // Use item.price (how it's saved in bills) with fallback to item.sellingPrice
                itemStats[itemName].revenue += ((item.price || item.sellingPrice || 0) * (item.quantity || 0));

                // Find menu item for cost calculation - check both name and nameEn
                const menuItem = state.items.find(i => i.nameEn === itemName || i.name === itemName);
                if (menuItem) {
                    itemStats[itemName].cost += ((menuItem.costPrice || 0) * (item.quantity || 0));
                }
            });
        }
    });

    return {
        type: 'item',
        items: Object.entries(itemStats).map(([name, stats]) => ({
            name,
            ...stats,
            profit: stats.revenue - stats.cost
        })).sort((a, b) => b.revenue - a.revenue)
    };
}

function generateCashierReport(bills) {
    const cashierStats = {};

    bills.forEach(bill => {
        const cashier = bill.cashierName || 'Unknown';

        if (!cashierStats[cashier]) {
            cashierStats[cashier] = {
                bills: 0,
                total: 0,
                cash: 0,
                upi: 0
            };
        }

        cashierStats[cashier].bills++;
        cashierStats[cashier].total += bill.total || 0;

        if (bill.paymentMode === 'cash') {
            cashierStats[cashier].cash += bill.total || 0;
        } else {
            cashierStats[cashier].upi += bill.total || 0;
        }
    });

    return {
        type: 'cashier',
        cashiers: Object.entries(cashierStats).map(([name, stats]) => ({
            name,
            ...stats
        })).sort((a, b) => b.total - a.total)
    };
}

async function generateProfitReportAsync(bills, fromDate, toDate) {
    const totalRevenue = bills.reduce((sum, bill) => sum + (bill.total || 0), 0);

    let totalItemCosts = 0;
    bills.forEach(bill => {
        if (bill.items) {
            bill.items.forEach(item => {
                const itemName = item.name || item.nameEn || '';
                const menuItem = state.items.find(i => i.nameEn === itemName || i.name === itemName);
                if (menuItem) {
                    totalItemCosts += ((menuItem.costPrice || 0) * (item.quantity || 0));
                }
            });
        }
    });

    let totalRawMaterialCosts = 0;
    if (isFirebaseInitialized) {
        try {
            const snapshot = await db.ref('rawMaterials').once('value');
            const rmData = snapshot.val() || {};
            const rawMaterials = Object.values(rmData);

            const start = new Date(fromDate);
            const end = new Date(toDate);

            totalRawMaterialCosts = rawMaterials
                .filter(rm => {
                    const rmDate = new Date(rm.date);
                    return rmDate >= start && rmDate <= end;
                })
                .reduce((sum, rm) => sum + (rm.price || 0), 0);
        } catch (error) {
            console.error('Error loading raw materials for profit report:', error);
        }
    }

    const totalProfit = totalRevenue - totalItemCosts - totalRawMaterialCosts;

    return {
        type: 'profit',
        revenue: totalRevenue,
        itemCosts: totalItemCosts,
        rawMaterialCosts: totalRawMaterialCosts,
        profit: totalProfit,
        profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue * 100) : 0
    };
}

async function generateConsolidatedReportAsync(bills, fromDate, toDate) {
    return {
        type: 'consolidated',
        summary: {
            totalBills: bills.length,
            totalRevenue: bills.reduce((sum, bill) => sum + (bill.total || 0), 0),
            cashSales: bills.filter(b => b.paymentMode === 'cash').reduce((sum, bill) => sum + (bill.total || 0), 0),
            upiSales: bills.filter(b => b.paymentMode === 'upi').reduce((sum, bill) => sum + (bill.total || 0), 0)
        },
        itemWise: generateItemWiseReport(bills),
        cashierWise: generateCashierReport(bills),
        profitLoss: await generateProfitReportAsync(bills, fromDate, toDate)
    };
}

function displayReport(data, type) {
    const container = document.getElementById('report-content');
    if (!container) return;

    let html = '';

    switch (type) {
        case 'item':
            html = `
                <div class="report-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th>Quantity Sold</th>
                                <th>Revenue</th>
                                <th>Cost</th>
                                <th>Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.items.map(item => `
                                <tr>
                                    <td>${item.name}</td>
                                    <td>${item.quantity}</td>
                                    <td>${formatCurrency(item.revenue)}</td>
                                    <td>${formatCurrency(item.cost)}</td>
                                    <td class="${item.profit >= 0 ? 'text-success' : 'text-danger'}">
                                        ${formatCurrency(item.profit)}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            break;

        case 'cashier':
            html = `
                <div class="report-table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Cashier Name</th>
                                <th>Total Bills</th>
                                <th>Cash Sales</th>
                                <th>UPI Sales</th>
                                <th>Total Sales</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.cashiers.map(cashier => `
                                <tr>
                                    <td>${cashier.name}</td>
                                    <td>${cashier.bills}</td>
                                    <td>${formatCurrency(cashier.cash)}</td>
                                    <td>${formatCurrency(cashier.upi)}</td>
                                    <td><strong>${formatCurrency(cashier.total)}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            break;

        case 'profit':
            html = `
                <div class="profit-report">
                    <div class="profit-summary">
                        <div class="profit-item">
                            <span class="label">Total Revenue:</span>
                            <span class="value">${formatCurrency(data.revenue)}</span>
                        </div>
                        <div class="profit-item">
                            <span class="label">Item Costs:</span>
                            <span class="value text-danger">-${formatCurrency(data.itemCosts)}</span>
                        </div>
                        <div class="profit-item">
                            <span class="label">Raw Material Costs:</span>
                            <span class="value text-danger">-${formatCurrency(data.rawMaterialCosts)}</span>
                        </div>
                        <div class="profit-item total">
                            <span class="label">Net Profit:</span>
                            <span class="value ${data.profit >= 0 ? 'text-success' : 'text-danger'}">
                                ${formatCurrency(data.profit)}
                            </span>
                        </div>
                        <div class="profit-item">
                            <span class="label">Profit Margin:</span>
                            <span class="value">${data.profitMargin.toFixed(2)}%</span>
                        </div>
                    </div>
                </div>
            `;
            break;

        case 'consolidated':
            html = `
                <div class="consolidated-report">
                    <h3>Summary</h3>
                    <div class="report-summary-grid">
                        <div class="summary-card">
                            <div class="summary-label">Total Bills</div>
                            <div class="summary-value">${data.summary.totalBills}</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Total Revenue</div>
                            <div class="summary-value">${formatCurrency(data.summary.totalRevenue)}</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">Cash Sales</div>
                            <div class="summary-value">${formatCurrency(data.summary.cashSales)}</div>
                        </div>
                        <div class="summary-card">
                            <div class="summary-label">UPI Sales</div>
                            <div class="summary-value">${formatCurrency(data.summary.upiSales)}</div>
                        </div>
                    </div>
                    
                    <h3>Profit & Loss</h3>
                    <div class="profit-summary">
                        <div class="profit-item">
                            <span class="label">Revenue:</span>
                            <span class="value">${formatCurrency(data.profitLoss.revenue)}</span>
                        </div>
                        <div class="profit-item">
                            <span class="label">Costs:</span>
                            <span class="value text-danger">-${formatCurrency(data.profitLoss.itemCosts + data.profitLoss.rawMaterialCosts)}</span>
                        </div>
                        <div class="profit-item total">
                            <span class="label">Net Profit:</span>
                            <span class="value ${data.profitLoss.profit >= 0 ? 'text-success' : 'text-danger'}">
                                ${formatCurrency(data.profitLoss.profit)}
                            </span>
                        </div>
                    </div>
                </div>
            `;
            break;
    }

    container.innerHTML = html;
}

// ===================================
// Export PDF Functionality
// ===================================

const exportPdfBtn = document.getElementById('export-pdf-btn');
if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
        if (!ownerReportData) {
            showToast('Please generate a report first', 'warning');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const fromDate = document.getElementById('report-from-date').value;
            const toDate = document.getElementById('report-to-date').value;

            // Title
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('Chai Time - Report', 105, 20, { align: 'center' });

            // Subtitle with date range
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            const reportTypeLabels = {
                'item': 'Item-wise Sales Report',
                'cashier': 'Cashier Performance Report',
                'profit': 'Profit & Loss Report',
                'consolidated': 'Consolidated Report'
            };
            doc.text(reportTypeLabels[ownerReportType] || 'Report', 105, 28, { align: 'center' });
            doc.text(`Period: ${fromDate} to ${toDate}`, 105, 35, { align: 'center' });

            doc.setDrawColor(139, 92, 246);
            doc.setLineWidth(0.5);
            doc.line(20, 38, 190, 38);

            let yPos = 45;

            switch (ownerReportType) {
                case 'item':
                    yPos = renderPdfTable(doc, yPos,
                        ['Item Name', 'Qty Sold', 'Revenue', 'Cost', 'Profit'],
                        ownerReportData.items.map(item => [
                            item.name,
                            item.quantity.toString(),
                            formatCurrencyPlain(item.revenue),
                            formatCurrencyPlain(item.cost),
                            formatCurrencyPlain(item.profit)
                        ]),
                        [40, 20, 35, 35, 35]
                    );
                    // Totals
                    const totalRevenue = ownerReportData.items.reduce((s, i) => s + i.revenue, 0);
                    const totalProfit = ownerReportData.items.reduce((s, i) => s + i.profit, 0);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(10);
                    doc.text(`Total Revenue: ${formatCurrencyPlain(totalRevenue)}   |   Total Profit: ${formatCurrencyPlain(totalProfit)}`, 20, yPos + 8);
                    break;

                case 'cashier':
                    yPos = renderPdfTable(doc, yPos,
                        ['Cashier', 'Bills', 'Cash Sales', 'UPI Sales', 'Total Sales'],
                        ownerReportData.cashiers.map(c => [
                            c.name,
                            c.bills.toString(),
                            formatCurrencyPlain(c.cash),
                            formatCurrencyPlain(c.upi),
                            formatCurrencyPlain(c.total)
                        ]),
                        [40, 20, 35, 35, 35]
                    );
                    break;

                case 'profit':
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Profit & Loss Summary', 20, yPos);
                    yPos += 10;

                    const profitRows = [
                        ['Total Revenue', formatCurrencyPlain(ownerReportData.revenue)],
                        ['Item Costs', '-' + formatCurrencyPlain(ownerReportData.itemCosts)],
                        ['Raw Material Costs', '-' + formatCurrencyPlain(ownerReportData.rawMaterialCosts)],
                        ['Net Profit', formatCurrencyPlain(ownerReportData.profit)],
                        ['Profit Margin', ownerReportData.profitMargin.toFixed(2) + '%']
                    ];

                    yPos = renderPdfTable(doc, yPos,
                        ['Description', 'Amount'],
                        profitRows,
                        [90, 70]
                    );
                    break;

                case 'consolidated':
                    // Summary section
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Summary', 20, yPos);
                    yPos += 8;

                    const summaryRows = [
                        ['Total Bills', ownerReportData.summary.totalBills.toString()],
                        ['Total Revenue', formatCurrencyPlain(ownerReportData.summary.totalRevenue)],
                        ['Cash Sales', formatCurrencyPlain(ownerReportData.summary.cashSales)],
                        ['UPI Sales', formatCurrencyPlain(ownerReportData.summary.upiSales)]
                    ];
                    yPos = renderPdfTable(doc, yPos, ['Metric', 'Value'], summaryRows, [90, 70]);
                    yPos += 10;

                    // Profit/Loss section
                    if (yPos > 250) { doc.addPage(); yPos = 20; }
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Profit & Loss', 20, yPos);
                    yPos += 8;

                    const plRows = [
                        ['Revenue', formatCurrencyPlain(ownerReportData.profitLoss.revenue)],
                        ['Total Costs', '-' + formatCurrencyPlain(ownerReportData.profitLoss.itemCosts + ownerReportData.profitLoss.rawMaterialCosts)],
                        ['Net Profit', formatCurrencyPlain(ownerReportData.profitLoss.profit)]
                    ];
                    yPos = renderPdfTable(doc, yPos, ['Description', 'Amount'], plRows, [90, 70]);
                    yPos += 10;

                    // Item-wise section
                    if (yPos > 220) { doc.addPage(); yPos = 20; }
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Item-wise Breakdown', 20, yPos);
                    yPos += 8;

                    if (ownerReportData.itemWise && ownerReportData.itemWise.items) {
                        yPos = renderPdfTable(doc, yPos,
                            ['Item', 'Qty', 'Revenue', 'Profit'],
                            ownerReportData.itemWise.items.map(item => [
                                item.name,
                                item.quantity.toString(),
                                formatCurrencyPlain(item.revenue),
                                formatCurrencyPlain(item.profit)
                            ]),
                            [50, 20, 45, 45]
                        );
                    }
                    break;
            }

            // Footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(150);
                doc.text(`Generated on ${new Date().toLocaleString('en-IN')}  |  Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
                doc.setTextColor(0);
            }

            doc.save(`ChaiTime_Report_${fromDate}_to_${toDate}.pdf`);
            showToast('PDF exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting PDF:', error);
            showToast('Error exporting PDF. Please try again.', 'error');
        }
    });
}

// Helper: Render a table in PDF
function renderPdfTable(doc, startY, headers, rows, colWidths) {
    const startX = 20;
    const rowHeight = 8;
    const fontSize = 9;
    let y = startY;

    // Header row
    doc.setFillColor(139, 92, 246);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'bold');

    let totalWidth = colWidths.reduce((a, b) => a + b, 0);
    doc.rect(startX, y - 5, totalWidth, rowHeight, 'F');

    let x = startX;
    headers.forEach((header, i) => {
        doc.text(header, x + 2, y);
        x += colWidths[i];
    });

    y += rowHeight;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    // Data rows
    rows.forEach((row, rowIndex) => {
        if (y > 275) {
            doc.addPage();
            y = 20;
            // Re-draw header on new page
            doc.setFillColor(139, 92, 246);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.rect(startX, y - 5, totalWidth, rowHeight, 'F');
            let hx = startX;
            headers.forEach((header, i) => {
                doc.text(header, hx + 2, y);
                hx += colWidths[i];
            });
            y += rowHeight;
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'normal');
        }

        // Alternating row colors
        if (rowIndex % 2 === 0) {
            doc.setFillColor(245, 243, 255);
            doc.rect(startX, y - 5, totalWidth, rowHeight, 'F');
        }

        x = startX;
        row.forEach((cell, i) => {
            const cellText = String(cell || '');
            // Truncate long text to fit column
            const maxChars = Math.floor(colWidths[i] / 2.2);
            const displayText = cellText.length > maxChars ? cellText.substring(0, maxChars - 2) + '..' : cellText;
            doc.text(displayText, x + 2, y);
            x += colWidths[i];
        });

        y += rowHeight;
    });

    // Bottom border
    doc.setDrawColor(200);
    doc.line(startX, y - 5, startX + totalWidth, y - 5);

    return y;
}

// Helper: Format currency without HTML entities (for PDF/Excel)
function formatCurrencyPlain(amount) {
    return '₹' + (amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ===================================
// Export Excel Functionality
// ===================================

const exportExcelBtn = document.getElementById('export-excel-btn');
if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => {
        if (!ownerReportData) {
            showToast('Please generate a report first', 'warning');
            return;
        }

        try {
            const fromDate = document.getElementById('report-from-date').value;
            const toDate = document.getElementById('report-to-date').value;
            const wb = XLSX.utils.book_new();

            switch (ownerReportType) {
                case 'item': {
                    const wsData = [
                        ['Chai Time - Item-wise Sales Report'],
                        [`Period: ${fromDate} to ${toDate}`],
                        [],
                        ['Item Name', 'Quantity Sold', 'Revenue (₹)', 'Cost (₹)', 'Profit (₹)'],
                        ...ownerReportData.items.map(item => [
                            item.name,
                            item.quantity,
                            item.revenue,
                            item.cost,
                            item.profit
                        ]),
                        [],
                        ['TOTAL',
                            ownerReportData.items.reduce((s, i) => s + i.quantity, 0),
                            ownerReportData.items.reduce((s, i) => s + i.revenue, 0),
                            ownerReportData.items.reduce((s, i) => s + i.cost, 0),
                            ownerReportData.items.reduce((s, i) => s + i.profit, 0)
                        ]
                    ];
                    const ws = XLSX.utils.aoa_to_sheet(wsData);
                    applyExcelColumnWidths(ws, [30, 15, 15, 15, 15]);
                    XLSX.utils.book_append_sheet(wb, ws, 'Item-wise Sales');
                    break;
                }

                case 'cashier': {
                    const wsData = [
                        ['Chai Time - Cashier Performance Report'],
                        [`Period: ${fromDate} to ${toDate}`],
                        [],
                        ['Cashier Name', 'Total Bills', 'Cash Sales (₹)', 'UPI Sales (₹)', 'Total Sales (₹)'],
                        ...ownerReportData.cashiers.map(c => [
                            c.name,
                            c.bills,
                            c.cash,
                            c.upi,
                            c.total
                        ]),
                        [],
                        ['TOTAL',
                            ownerReportData.cashiers.reduce((s, c) => s + c.bills, 0),
                            ownerReportData.cashiers.reduce((s, c) => s + c.cash, 0),
                            ownerReportData.cashiers.reduce((s, c) => s + c.upi, 0),
                            ownerReportData.cashiers.reduce((s, c) => s + c.total, 0)
                        ]
                    ];
                    const ws = XLSX.utils.aoa_to_sheet(wsData);
                    applyExcelColumnWidths(ws, [25, 15, 18, 18, 18]);
                    XLSX.utils.book_append_sheet(wb, ws, 'Cashier Performance');
                    break;
                }

                case 'profit': {
                    const wsData = [
                        ['Chai Time - Profit & Loss Report'],
                        [`Period: ${fromDate} to ${toDate}`],
                        [],
                        ['Description', 'Amount (₹)'],
                        ['Total Revenue', ownerReportData.revenue],
                        ['Item Costs', -ownerReportData.itemCosts],
                        ['Raw Material Costs', -ownerReportData.rawMaterialCosts],
                        [],
                        ['Net Profit', ownerReportData.profit],
                        ['Profit Margin (%)', parseFloat(ownerReportData.profitMargin.toFixed(2))]
                    ];
                    const ws = XLSX.utils.aoa_to_sheet(wsData);
                    applyExcelColumnWidths(ws, [30, 20]);
                    XLSX.utils.book_append_sheet(wb, ws, 'Profit & Loss');
                    break;
                }

                case 'consolidated': {
                    // Summary sheet
                    const summaryData = [
                        ['Chai Time - Consolidated Report'],
                        [`Period: ${fromDate} to ${toDate}`],
                        [],
                        ['Summary'],
                        ['Metric', 'Value'],
                        ['Total Bills', ownerReportData.summary.totalBills],
                        ['Total Revenue (₹)', ownerReportData.summary.totalRevenue],
                        ['Cash Sales (₹)', ownerReportData.summary.cashSales],
                        ['UPI Sales (₹)', ownerReportData.summary.upiSales],
                        [],
                        ['Profit & Loss'],
                        ['Revenue (₹)', ownerReportData.profitLoss.revenue],
                        ['Total Costs (₹)', -(ownerReportData.profitLoss.itemCosts + ownerReportData.profitLoss.rawMaterialCosts)],
                        ['Net Profit (₹)', ownerReportData.profitLoss.profit]
                    ];
                    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
                    applyExcelColumnWidths(summaryWs, [25, 20]);
                    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

                    // Item-wise sheet
                    if (ownerReportData.itemWise && ownerReportData.itemWise.items) {
                        const itemData = [
                            ['Item-wise Breakdown'],
                            [],
                            ['Item Name', 'Quantity Sold', 'Revenue (₹)', 'Cost (₹)', 'Profit (₹)'],
                            ...ownerReportData.itemWise.items.map(item => [
                                item.name,
                                item.quantity,
                                item.revenue,
                                item.cost,
                                item.profit
                            ])
                        ];
                        const itemWs = XLSX.utils.aoa_to_sheet(itemData);
                        applyExcelColumnWidths(itemWs, [30, 15, 15, 15, 15]);
                        XLSX.utils.book_append_sheet(wb, itemWs, 'Item-wise');
                    }

                    // Cashier-wise sheet
                    if (ownerReportData.cashierWise && ownerReportData.cashierWise.cashiers) {
                        const cashierData = [
                            ['Cashier-wise Breakdown'],
                            [],
                            ['Cashier Name', 'Total Bills', 'Cash Sales (₹)', 'UPI Sales (₹)', 'Total Sales (₹)'],
                            ...ownerReportData.cashierWise.cashiers.map(c => [
                                c.name,
                                c.bills,
                                c.cash,
                                c.upi,
                                c.total
                            ])
                        ];
                        const cashierWs = XLSX.utils.aoa_to_sheet(cashierData);
                        applyExcelColumnWidths(cashierWs, [25, 15, 18, 18, 18]);
                        XLSX.utils.book_append_sheet(wb, cashierWs, 'Cashier-wise');
                    }
                    break;
                }
            }

            XLSX.writeFile(wb, `ChaiTime_Report_${fromDate}_to_${toDate}.xlsx`);
            showToast('Excel exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting Excel:', error);
            showToast('Error exporting Excel. Please try again.', 'error');
        }
    });
}

// Helper: Apply column widths to Excel sheet
function applyExcelColumnWidths(ws, widths) {
    ws['!cols'] = widths.map(w => ({ wch: w }));
}

// ===================================
// Settings Module
// ===================================

function loadSettings() {
    const savedSettings = localStorage.getItem('chaiTimeSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        state.settings = settings;

        const cafeNameInput = document.getElementById('cafe-name');
        const billFooterInput = document.getElementById('bill-footer');
        const upiQrInput = document.getElementById('upi-qr-url');

        if (cafeNameInput) cafeNameInput.value = settings.cafeName || 'Chai Time';
        if (billFooterInput) billFooterInput.value = settings.billFooter || 'Thank you! Visit again ☕';
        if (upiQrInput) upiQrInput.value = settings.upiQR || '';
    }
}

const shopDetailsForm = document.getElementById('shop-details-form');
if (shopDetailsForm) {
    shopDetailsForm.addEventListener('submit', (e) => {
        e.preventDefault();

        state.settings.cafeName = document.getElementById('cafe-name').value;
        state.settings.billFooter = document.getElementById('bill-footer').value;

        localStorage.setItem('chaiTimeSettings', JSON.stringify(state.settings));
        showToast('Shop details saved', 'success');
    });
}

const upiSettingsForm = document.getElementById('upi-settings-form');
if (upiSettingsForm) {
    upiSettingsForm.addEventListener('submit', (e) => {
        e.preventDefault();

        state.settings.upiQR = document.getElementById('upi-qr-url').value;

        localStorage.setItem('chaiTimeSettings', JSON.stringify(state.settings));
        showToast('UPI settings saved', 'success');
    });
}

// ===================================
// Mobile Sidebar Toggle
// ===================================

const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const ownerSidebar = document.getElementById('owner-sidebar');

if (mobileMenuToggle && ownerSidebar) {
    mobileMenuToggle.addEventListener('click', () => {
        ownerSidebar.classList.toggle('active');
        mobileMenuToggle.classList.toggle('active');
    });

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                ownerSidebar.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!ownerSidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                ownerSidebar.classList.remove('active');
                mobileMenuToggle.classList.remove('active');
            }
        }
    });
}


