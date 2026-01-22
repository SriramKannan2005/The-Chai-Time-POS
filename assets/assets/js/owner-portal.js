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
        console.log('✅ Loaded items from JSON:', items.length);
    }
    return items;
}

async function loadCashiersFromJSON() {
    const cashiers = await loadJSONData('cashiers.json');
    if (cashiers.length > 0) {
        state.cashiers = cashiers;
        console.log('✅ Loaded cashiers from JSON:', cashiers.length);
    }
    return cashiers;
}

async function loadRawMaterialsFromJSON() {
    const rawMaterials = await loadJSONData('raw-materials.json');
    console.log('✅ Loaded raw materials from JSON:', rawMaterials.length);
    return rawMaterials;
}

// ===================================
// Dashboard Analytics
// ===================================

let monthlyChart, paymentChart, itemsChart;

async function loadDashboard() {
    console.log('Loading dashboard...');

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

    let rawMaterials = [];

    if (isFirebaseInitialized) {
        try {
            const snapshot = await db.ref('rawMaterials').once('value');
            const rmData = snapshot.val() || {};
            rawMaterials = Object.keys(rmData).map(key => ({
                id: key,
                ...rmData[key]
            }));
            console.log('✅ Loaded raw materials from Firebase:', rawMaterials.length);
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
                console.log('✅ Saved initial raw materials to Firebase');
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
                if (!itemStats[item.nameEn]) {
                    itemStats[item.nameEn] = {
                        quantity: 0,
                        revenue: 0,
                        cost: 0
                    };
                }

                itemStats[item.nameEn].quantity += item.quantity || 0;
                itemStats[item.nameEn].revenue += (item.sellingPrice * item.quantity) || 0;

                const menuItem = state.items.find(i => i.nameEn === item.nameEn);
                if (menuItem) {
                    itemStats[item.nameEn].cost += (menuItem.costPrice * item.quantity) || 0;
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
                const menuItem = state.items.find(i => i.nameEn === item.nameEn);
                if (menuItem) {
                    totalItemCosts += (menuItem.costPrice * item.quantity) || 0;
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

console.log('✅ Owner Portal initialized');
