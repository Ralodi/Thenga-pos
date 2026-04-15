// ==================== DATA STRUCTURES ====================
let business = null;
let inventory = [];
let salesHistory = [];
let currentCart = [];
let creditCustomers = [];
let paymentMethods = [];

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    loadDataFromStorage();
    renderAuthScreen();
});

function loadDataFromStorage() {
    const storedBusiness = localStorage.getItem('thenga_business');
    if (storedBusiness) business = JSON.parse(storedBusiness);
    const storedInventory = localStorage.getItem('thenga_inventory');
    if (storedInventory) inventory = JSON.parse(storedInventory);
    const storedSales = localStorage.getItem('thenga_sales');
    if (storedSales) salesHistory = JSON.parse(storedSales);
    const storedCustomers = localStorage.getItem('thenga_credit_customers');
    if (storedCustomers) creditCustomers = JSON.parse(storedCustomers);
}

// ==================== AUTH ROUTER ====================
function renderAuthScreen() {
    if (business && business.registered && business.pin) {
        showLoginScreen();
    } else {
        showRegistrationModal();
    }
}

// ==================== REGISTRATION ====================
function showRegistrationModal() {
    document.getElementById('registrationModal').style.display = 'flex';
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';

    const form = document.getElementById('registrationForm');
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const pin = document.getElementById('regPin').value;
        const confirmPin = document.getElementById('regPinConfirm').value;
        if (pin.length < 4) { showAuthError('reg', 'PIN must be at least 4 digits.'); return; }
        if (pin !== confirmPin) { showAuthError('reg', 'PINs do not match. Please try again.'); return; }
        business = {
            businessName: document.getElementById('businessName').value.trim(),
            businessType: document.getElementById('businessType').value,
            ownerName: document.getElementById('ownerName').value.trim(),
            contact: document.getElementById('contact').value.trim(),
            pin: pin,
            registered: true,
            createdAt: new Date().toISOString()
        };
        saveBusiness();
        
        document.getElementById('registrationModal').style.display = 'none';
        setupMainApp();
    });
}
// After saveBusiness(), register in Supabase too
if (isOnline()) {
    try {
        const sbBusiness = await sbRegisterBusiness({
            business_name: business.businessName,
            business_type: business.businessType,
            owner_name: business.ownerName,
            contact: business.contact,
            pin_hash: business.pin // ideally hash this, but fine for MVP
        });
        business.sbId = sbBusiness.id;
        saveBusiness();
    } catch(e) { console.warn('Supabase registration failed:', e); }
}
// ==================== LOGIN ====================
function showLoginScreen() {
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('registrationModal').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginBusinessName').innerText = business.businessName;
    document.getElementById('loginOwnerName').innerText = `Welcome back, ${business.ownerName} 👋`;
    setTimeout(() => { const p = document.getElementById('loginPin'); if (p) p.focus(); }, 100);

    const form = document.getElementById('loginForm');
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const enteredPin = document.getElementById('loginPin').value;
        if (enteredPin === business.pin) {
            document.getElementById('loginModal').style.display = 'none';
            document.getElementById('loginPin').value = '';
            setupMainApp();
        } else {
            showAuthError('login', 'Incorrect PIN. Please try again.');
            document.getElementById('loginPin').value = '';
            document.getElementById('loginPin').focus();
        }
    });

    const switchBtn = document.getElementById('switchAccountBtn');
    if (switchBtn) {
        switchBtn.onclick = () => {
            if (confirm('Switch account? This will clear the current registration.')) {
                localStorage.clear();
                business = null; inventory = []; salesHistory = []; creditCustomers = []; currentCart = [];
                showRegistrationModal();
            }
        };
    }
}

function showAuthError(context, message) {
    const el = document.getElementById(context === 'login' ? 'loginError' : 'regError');
    if (el) {
        el.innerText = message;
        el.style.display = 'block';
        setTimeout(() => { el.style.display = 'none'; }, 3000);
    }
}

// ==================== SAVE FUNCTIONS ====================
async function saveCreditCustomers() {
    localStorage.setItem('thenga_credit_customers', JSON.stringify(creditCustomers));
    if (isOnline() && business.sbId) {
        try { await sbSaveCustomers(business.sbId, creditCustomers); } catch(e) { console.warn('Supabase sync failed:', e); }
    }
}
function saveBusiness() { localStorage.setItem('thenga_business', JSON.stringify(business)); }
async function saveInventory() {
    localStorage.setItem('thenga_inventory', JSON.stringify(inventory));
    if (isOnline() && business.sbId) {
        try { await sbSaveInventory(business.sbId, inventory); } catch(e) { console.warn('Supabase sync failed:', e); }
    }
}
async function saveSales(newSale) {
    localStorage.setItem('thenga_sales', JSON.stringify(salesHistory));
    if (isOnline() && business.sbId && newSale) {
        try { await sbSaveSale(business.sbId, newSale); } catch(e) { console.warn('Supabase sync failed:', e); }
    }
}

// ==================== MAIN APP SETUP ====================
function setupMainApp() {
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('businessNameDisplay').innerText = business.businessName;
    const typeSpan = document.getElementById('businessTypeDisplay');
    typeSpan.innerText = business.businessType === 'tavern' ? 'Tavern' : 'Tuckshop';
    if (inventory.length === 0) loadDefaultInventory();
    setupTabs();
    setupPOS();
    setupInventory();
    setupSettings();
    setupReports();
    setupCreditCustomers();
    refreshDashboard();
    updateLowStockBanner(); // ← add this
}
function updateLowStockBanner() {
    const lowItems = inventory.filter(p => p.stock < 10);
    const banner = document.getElementById('lowStockBanner');
    const count = document.getElementById('lowStockCount');
    if (!banner) return;
    if (lowItems.length > 0) {
        count.textContent = lowItems.length;
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
    }
}

function loadDefaultInventory() {
    inventory = [
        { id: 1, name: 'Coca-Cola', price: 12.0, cost: 7.0, stock: 50, category: 'drinks', icon: 'fa-wine-bottle', barcode: '6001234567890', packSize: 1 },
        { id: 2, name: 'Beer', price: 18.0, cost: 10.0, stock: 30, category: 'drinks', icon: 'fa-beer', barcode: '6001234567891', packSize: 1 },
        { id: 3, name: 'Chips', price: 10.0, cost: 5.0, stock: 40, category: 'snacks', icon: 'fa-cookie', barcode: '6001234567892', packSize: 1 },
        { id: 4, name: 'Bread', price: 14.0, cost: 8.0, stock: 20, category: 'essentials', icon: 'fa-bread-slice', barcode: '6001234567893', packSize: 1 }
    ];
    saveInventory();
}

// ==================== LOGOUT ====================
function logout() {
    if (confirm('Log out? Your data will be saved and you can log back in with your PIN.')) {
        document.getElementById('mainApp').style.display = 'none';
        currentCart = [];
        stopAllScanners();
        showLoginScreen();
    }
}

// ==================== TABS ====================
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            if (tabId !== 'pos') stopPosScanner();
            if (tabId !== 'inventory') stopInvScanner();
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            document.getElementById(`${tabId}Tab`).classList.add('active');
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (tabId === 'dashboard') refreshDashboard();
            if (tabId === 'inventory') renderInventoryList();
            if (tabId === 'credit') renderCreditCustomers();
            if (tabId === 'reports') generateReport(document.getElementById('reportPeriod')?.value || 'day');
        });
    });
}

// ==================== DASHBOARD ====================
function refreshDashboard() {
    const totalSales = salesHistory.reduce((sum, sale) => sum + sale.total, 0);
    const totalProfit = salesHistory.reduce((sum, sale) => sum + sale.profit, 0);
    const itemsSold = salesHistory.reduce((sum, sale) => sum + sale.items.reduce((s, i) => s + i.quantity, 0), 0);
    document.getElementById('totalSales').innerText = `R${totalSales.toFixed(2)}`;
    document.getElementById('totalProfit').innerText = `R${totalProfit.toFixed(2)}`;
    document.getElementById('itemsSold').innerText = itemsSold;

    const productSales = {};
    salesHistory.forEach(sale => { sale.items.forEach(item => { productSales[item.name] = (productSales[item.name] || 0) + item.quantity; }); });
    const topProducts = Object.entries(productSales).sort((a,b) => b[1]-a[1]).slice(0,5);
    document.getElementById('topProductsList').innerHTML = topProducts.map(([name, qty]) => `<li>${name}: ${qty} sold</li>`).join('') || '<li>No sales yet</li>';

    const lowStock = inventory.filter(p => p.stock < 10);
    document.getElementById('lowStockList').innerHTML = lowStock.map(p => `<li>${p.name}: only ${p.stock} left</li>`).join('') || '<li>All stock levels healthy ✅</li>';
}

// ==================== ADD / EDIT PRODUCT MODAL ====================
function openProductModal(existingProduct = null) {
    const old = document.getElementById('productModal');
    if (old) old.remove();

    const isEdit = !!existingProduct;
    const p = existingProduct || { name: '', price: '', cost: '', stock: '', category: 'drinks', barcode: '', packSize: 1, packCost: '' };

    const modal = document.createElement('div');
    modal.id = 'productModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content product-modal-content">
            <h2><i class="fas fa-${isEdit ? 'edit' : 'plus-circle'}"></i> ${isEdit ? 'Edit Product' : 'Add New Product'}</h2>

            <div class="pm-section-label">Product Details</div>
            <input type="text" id="pm_name" placeholder="Product Name *" value="${p.name}" required>
            <div class="pm-row">
                <div class="pm-field">
                    <label>Category</label>
                    <select id="pm_category">
                        <option value="drinks" ${p.category==='drinks'?'selected':''}>Drinks</option>
                        <option value="snacks" ${p.category==='snacks'?'selected':''}>Snacks</option>
                        <option value="essentials" ${p.category==='essentials'?'selected':''}>Essentials</option>
                        <option value="sweets" ${p.category==='sweets'?'selected':''}>Sweets</option>
                        <option value="tobacco" ${p.category==='tobacco'?'selected':''}>Tobacco</option>
                        <option value="other" ${p.category==='other'?'selected':''}>Other</option>
                    </select>
                </div>
                <div class="pm-field">
                    <label>Selling Price (R) *</label>
                    <input type="number" id="pm_price" placeholder="e.g. 2.00" step="0.01" min="0" value="${p.price}">
                </div>
            </div>

            <div class="pm-section-label">
                <i class="fas fa-box-open"></i> Pack / Bulk Pricing
                <span class="pm-hint">Buying in bulk? Enter pack details to auto-calculate cost per unit.</span>
            </div>
            <div class="pm-pack-toggle">
                <label class="toggle-label">
                    <input type="checkbox" id="pm_isBulk" ${(p.packSize > 1) ? 'checked' : ''}>
                    <span class="toggle-track"><span class="toggle-thumb"></span></span>
                    This product comes in a pack / bulk
                </label>
            </div>
            <div id="pm_bulkFields" class="pm-bulk-fields ${(p.packSize > 1) ? '' : 'hidden'}">
                <div class="pm-row">
                    <div class="pm-field">
                        <label>Units per Pack *</label>
                        <input type="number" id="pm_packSize" placeholder="e.g. 50" min="1" value="${p.packSize > 1 ? p.packSize : ''}">
                    </div>
                    <div class="pm-field">
                        <label>Pack Cost Price (R) *</label>
                        <input type="number" id="pm_packCost" placeholder="e.g. 45.00" step="0.01" min="0" value="${p.packSize > 1 ? (p.cost * p.packSize).toFixed(2) : ''}">
                    </div>
                </div>
                <div class="pm-cost-result" id="pm_costResult">
                    <i class="fas fa-calculator"></i>
                    <span id="pm_costDisplay">Enter pack size and cost to calculate unit cost</span>
                </div>
            </div>
            <div id="pm_singleCostField" class="pm-field ${(p.packSize > 1) ? 'hidden' : ''}">
                <label>Cost Price per Unit (R) *</label>
                <input type="number" id="pm_cost" placeholder="e.g. 1.50" step="0.01" min="0" value="${p.packSize <= 1 ? p.cost : ''}">
            </div>

            <div class="pm-section-label">Stock & Barcode</div>
            <div class="pm-row">
                <div class="pm-field">
                    <label>Initial Stock (units) *</label>
                    <input type="number" id="pm_stock" placeholder="e.g. 50" min="0" value="${p.stock}">
                </div>
                <div class="pm-field">
                    <label>Barcode (optional)</label>
                    <div class="barcode-input-row">
                        <input type="text" id="pm_barcode" placeholder="Scan or type" value="${p.barcode || ''}">
                        <button type="button" class="btn-scan-inline" id="pm_scanBarcodeBtn" title="Scan barcode">
                            <i class="fas fa-camera"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div id="pm_scannerContainer" class="pm-scanner-container hidden">
                <div id="pm_scannerPreviewBox"></div>
                <button type="button" class="btn-outline pm-stop-scan" id="pm_stopScanBtn"><i class="fas fa-stop"></i> Stop Camera</button>
            </div>

            <div id="pm_profitPreview" class="pm-profit-preview hidden">
                <span><i class="fas fa-chart-line"></i> Estimated profit per unit: <strong id="pm_profitVal">–</strong></span>
                <span><i class="fas fa-percentage"></i> Margin: <strong id="pm_marginVal">–</strong></span>
            </div>

            <div class="pm-actions">
                <button type="button" class="btn-outline" id="pm_cancelBtn">Cancel</button>
                <button type="button" class="btn-primary" id="pm_saveBtn">
                    <i class="fas fa-save"></i> ${isEdit ? 'Save Changes' : 'Add Product'}
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // ---- Wire up bulk/pack logic ----
    const isBulkCheck = modal.querySelector('#pm_isBulk');
    const bulkFields = modal.querySelector('#pm_bulkFields');
    const singleCostField = modal.querySelector('#pm_singleCostField');
    const packSizeInput = modal.querySelector('#pm_packSize');
    const packCostInput = modal.querySelector('#pm_packCost');
    const costDisplay = modal.querySelector('#pm_costDisplay');
    const costResult = modal.querySelector('#pm_costResult');
    const priceInput = modal.querySelector('#pm_price');
    const profitPreview = modal.querySelector('#pm_profitPreview');
    const profitVal = modal.querySelector('#pm_profitVal');
    const marginVal = modal.querySelector('#pm_marginVal');

    function recalculate() {
        const isBulk = isBulkCheck.checked;
        const packSize = parseFloat(packSizeInput.value) || 0;
        const packCost = parseFloat(packCostInput.value) || 0;
        const price = parseFloat(priceInput.value) || 0;

        let unitCost = 0;
        if (isBulk && packSize > 0 && packCost > 0) {
            unitCost = packCost / packSize;
            costDisplay.innerHTML = `<strong>Cost per unit: R${unitCost.toFixed(2)}</strong> &nbsp;(R${packCost.toFixed(2)} ÷ ${packSize} units)`;
            costResult.classList.add('active');
        }

        const directCost = parseFloat(modal.querySelector('#pm_cost')?.value) || 0;
        const effectiveCost = isBulk ? unitCost : directCost;

        if (price > 0 && effectiveCost > 0) {
            const profit = price - effectiveCost;
            const margin = (profit / price) * 100;
            profitVal.innerText = `R${profit.toFixed(2)}`;
            marginVal.innerText = `${margin.toFixed(1)}%`;
            profitPreview.classList.remove('hidden');
            profitVal.style.color = profit > 0 ? '#4CAF50' : '#dc3545';
        } else {
            profitPreview.classList.add('hidden');
        }
    }

    isBulkCheck.addEventListener('change', () => {
        if (isBulkCheck.checked) {
            bulkFields.classList.remove('hidden');
            singleCostField.classList.add('hidden');
        } else {
            bulkFields.classList.add('hidden');
            singleCostField.classList.remove('hidden');
            costResult.classList.remove('active');
        }
        recalculate();
    });

    packSizeInput.addEventListener('input', recalculate);
    packCostInput.addEventListener('input', recalculate);
    priceInput.addEventListener('input', recalculate);
    modal.querySelector('#pm_cost').addEventListener('input', recalculate);

    if (isEdit) recalculate();

    // ---- Inline barcode scanner for modal ----
    // FIX: Use a unique element ID each time to avoid html5-qrcode conflicts
    let pmScanner = null;
    const pmScannerId = 'pm_scannerPreviewBox';
    const scanBtn = modal.querySelector('#pm_scanBarcodeBtn');
    const scannerContainer = modal.querySelector('#pm_scannerContainer');
    const stopScanBtn = modal.querySelector('#pm_stopScanBtn');
    const barcodeInput = modal.querySelector('#pm_barcode');

    scanBtn.addEventListener('click', async () => {
        scannerContainer.classList.remove('hidden');
        scanBtn.disabled = true;

        // Clear the container so html5-qrcode gets a clean div
        const previewBox = modal.querySelector(`#${pmScannerId}`);
        previewBox.innerHTML = '';

        try {
            pmScanner = new Html5Qrcode(pmScannerId);
            const devices = await Html5Qrcode.getCameras();
            if (!devices || devices.length === 0) {
                alert('No camera found on this device.');
                scanBtn.disabled = false;
                return;
            }
            // Prefer back camera
            const cam = devices.find(d =>
                d.label.toLowerCase().includes('back') ||
                d.label.toLowerCase().includes('rear') ||
                d.label.toLowerCase().includes('environment')
            ) || devices[devices.length - 1];

            await pmScanner.start(
                cam.id,
                { fps: 10, qrbox: { width: 220, height: 120 } },
                (decoded) => {
                    barcodeInput.value = decoded;
                    if (navigator.vibrate) navigator.vibrate(100);
                    stopPmScanner();
                },
                () => {} // frame errors are normal, ignore
            );
        } catch (err) {
            console.error('Modal scanner error:', err);
            let msg = 'Could not start camera.';
            if (err.name === 'NotAllowedError' || String(err).includes('Permission')) {
                msg = 'Camera permission denied. Please allow camera access in your browser settings.';
            } else {
                msg = `Camera error: ${err.message || err}`;
            }
            alert(msg);
            scanBtn.disabled = false;
            scannerContainer.classList.add('hidden');
        }
    });

    function stopPmScanner() {
        if (pmScanner) {
            pmScanner.stop().catch(() => {}).finally(() => {
                try { pmScanner.clear(); } catch(e) {}
                pmScanner = null;
            });
        }
        scannerContainer.classList.add('hidden');
        scanBtn.disabled = false;
    }

    stopScanBtn.addEventListener('click', stopPmScanner);

    // ---- Cancel ----
    modal.querySelector('#pm_cancelBtn').addEventListener('click', () => {
        stopPmScanner();
        modal.remove();
    });

    // ---- Save ----
    modal.querySelector('#pm_saveBtn').addEventListener('click', () => {
        const name = modal.querySelector('#pm_name').value.trim();
        const price = parseFloat(modal.querySelector('#pm_price').value);
        const stock = parseInt(modal.querySelector('#pm_stock').value);
        const category = modal.querySelector('#pm_category').value;
        const barcode = modal.querySelector('#pm_barcode').value.trim();
        const isBulk = isBulkCheck.checked;
        const packSize = isBulk ? (parseInt(packSizeInput.value) || 1) : 1;
        const packCost = isBulk ? parseFloat(packCostInput.value) : 0;
        const directCost = parseFloat(modal.querySelector('#pm_cost').value) || 0;
        const unitCost = isBulk ? (packCost / packSize) : directCost;

        if (!name) { alert('Please enter a product name.'); return; }
        if (isNaN(price) || price < 0) { alert('Please enter a valid selling price.'); return; }
        if (isNaN(unitCost) || unitCost < 0) { alert('Please enter cost price details.'); return; }
        if (isNaN(stock) || stock < 0) { alert('Please enter a valid stock amount.'); return; }

        stopPmScanner();

        if (isEdit) {
            const product = inventory.find(p => p.id === existingProduct.id);
            if (product) {
                product.name = name;
                product.price = price;
                product.cost = unitCost;
                product.stock = stock;
                product.category = category;
                product.barcode = barcode || null;
                product.packSize = packSize;
            }
        } else {
            inventory.push({
                id: Date.now(),
                name, price,
                cost: unitCost,
                stock, category,
                barcode: barcode || null,
                packSize,
                icon: iconForCategory(category)
            });
        }

        saveInventory();
        renderInventoryList();
        setupPOS();
        modal.remove();
    });

    recalculate();
}

function iconForCategory(cat) {
    const icons = { drinks: 'fa-wine-bottle', snacks: 'fa-cookie', essentials: 'fa-bread-slice', sweets: 'fa-candy-cane', tobacco: 'fa-smoking', other: 'fa-box' };
    return icons[cat] || 'fa-box';
}

// ==================== INVENTORY MANAGEMENT ====================
function setupInventory() {
    document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());
    document.getElementById('searchProduct').addEventListener('input', renderInventoryList);
    document.getElementById('filterCategory').addEventListener('change', renderInventoryList);
    setupInvScanner();
    renderInventoryList();
}

function renderInventoryList() {
    const search = document.getElementById('searchProduct').value.toLowerCase();
    const category = document.getElementById('filterCategory').value;
    let filtered = inventory.filter(p => p.name.toLowerCase().includes(search));
    if (category) filtered = filtered.filter(p => p.category === category);

    const container = document.getElementById('inventoryList');
    container.innerHTML = filtered.length === 0
        ? '<div class="empty-cart">No products found</div>'
        : filtered.map(p => {
            const margin = p.cost > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(0) : '–';
            const packLabel = p.packSize > 1 ? `<span class="pack-badge">Pack of ${p.packSize}</span>` : '';
            return `
            <div class="inventory-item">
                <div class="inv-item-info">
                    <strong>${p.name}</strong> ${packLabel}<br>
                    <span class="inv-meta">Sell: R${p.price.toFixed(2)} &nbsp;|&nbsp; Cost: R${p.cost.toFixed(2)} &nbsp;|&nbsp; Margin: ${margin}% &nbsp;|&nbsp; Stock: <strong>${p.stock}</strong></span><br>
                    ${p.barcode ? `<small class="barcode-tag"><i class="fas fa-barcode"></i> ${p.barcode}</small>` : '<small class="no-barcode">No barcode</small>'}
                </div>
                <div class="inventory-actions">
                    <button onclick="editProduct(${p.id})" title="Edit"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteProduct(${p.id})" title="Delete" class="btn-delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        }).join('');

    const cats = [...new Set(inventory.map(p => p.category))];
    const filterSelect = document.getElementById('filterCategory');
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option value="${c}" ${c===currentVal?'selected':''}>${c}</option>`).join('');
}

function editProduct(id) {
    const product = inventory.find(p => p.id === id);
    if (!product) return;
    openProductModal(product);
}

function deleteProduct(id) {
    if (confirm('Delete this product?')) {
        inventory = inventory.filter(p => p.id !== id);
        saveInventory();
        renderInventoryList();
        setupPOS();
    }
}

// ==================== INVENTORY BARCODE SCANNER ====================
// FIX: Track scanner state with a proper object, not just an instance reference
let invScannerInstance = null;
let invScannerRunning = false;

function setupInvScanner() {
    const startBtn = document.getElementById('invScanBtn');
    const stopBtn = document.getElementById('invStopScanBtn');
    if (!startBtn) return;

    startBtn.addEventListener('click', async () => {
        if (invScannerRunning) return; // prevent double-start

        const preview = document.getElementById('invScannerPreview');
        const resultDiv = document.getElementById('invScanResult');
        resultDiv.className = 'scanned-result';
        resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting camera...';

        // FIX: Clear the preview div so html5-qrcode gets a blank slate
        preview.innerHTML = '';
        preview.style.display = 'block';
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-flex';

        try {
            invScannerInstance = new Html5Qrcode('invScannerPreview');
            const devices = await Html5Qrcode.getCameras();
            if (!devices || devices.length === 0) {
                throw new Error('No camera found on this device.');
            }
            // FIX: Prefer back/rear camera instead of always using devices[0] (front cam)
            const cam = devices.find(d =>
                d.label.toLowerCase().includes('back') ||
                d.label.toLowerCase().includes('rear') ||
                d.label.toLowerCase().includes('environment')
            ) || devices[devices.length - 1];

            await invScannerInstance.start(
                cam.id,
                { fps: 10, qrbox: { width: 260, height: 120 }, aspectRatio: 1.7 },
                (decoded) => {
                    if (navigator.vibrate) navigator.vibrate(100);
                    stopInvScanner();
                    handleInventoryBarcode(decoded, resultDiv);
                },
                () => {} // per-frame errors are normal, suppress them
            );
            invScannerRunning = true;
            resultDiv.innerHTML = '<i class="fas fa-camera"></i> Point camera at barcode...';
        } catch (err) {
            console.error('Inventory scanner error:', err);
            invScannerRunning = false;
            invScannerInstance = null;
            preview.style.display = 'none';
            preview.innerHTML = '';
            startBtn.style.display = 'inline-flex';
            stopBtn.style.display = 'none';

            let msg = 'Could not start camera.';
            if (err.name === 'NotAllowedError' || String(err).includes('Permission')) {
                msg = '📵 Camera permission denied. Allow camera access in your browser settings and try again.';
            } else if (String(err).includes('No camera')) {
                msg = '📷 No camera found on this device.';
            } else {
                msg = `⚠️ ${err.message || err}`;
            }
            resultDiv.className = 'scanned-result error';
            resultDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${msg}`;
        }
    });

    stopBtn.addEventListener('click', stopInvScanner);
}

function stopInvScanner() {
    if (invScannerInstance) {
        // FIX: Use .stop() promise chain instead of checking .isScanning (doesn't exist)
        invScannerInstance.stop().catch(() => {}).finally(() => {
            try { invScannerInstance.clear(); } catch(e) {}
            invScannerInstance = null;
            invScannerRunning = false;
        });
    } else {
        invScannerRunning = false;
    }
    const preview = document.getElementById('invScannerPreview');
    const startBtn = document.getElementById('invScanBtn');
    const stopBtn = document.getElementById('invStopScanBtn');
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    if (startBtn) startBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.style.display = 'none';
}

function handleInventoryBarcode(barcode, resultDiv) {
    const existing = inventory.find(p => p.barcode === barcode);
    if (existing) {
        resultDiv.className = 'scanned-result success';
        resultDiv.innerHTML = `<i class="fas fa-check-circle"></i> Found: <strong>${existing.name}</strong> — Stock: ${existing.stock} &nbsp;
            <button onclick="editProduct(${existing.id})" class="btn-primary" style="padding:0.3rem 0.8rem;font-size:0.8rem;">Edit</button>`;
    } else {
        resultDiv.className = 'scanned-result error';
        resultDiv.innerHTML = `<i class="fas fa-plus-circle"></i> Barcode <strong>${barcode}</strong> not found. &nbsp;
            <button onclick="openProductModal({barcode:'${barcode}',name:'',price:'',cost:'',stock:'',category:'drinks',packSize:1})" class="btn-primary" style="padding:0.3rem 0.8rem;font-size:0.8rem;">Add Product</button>`;
    }
}

// ==================== POS ====================
function setupPOS() {
    renderPOSProducts('all');
    const categories = [...new Set(inventory.map(p => p.category))];
    const catContainer = document.getElementById('posCategories');
    catContainer.innerHTML = `<button class="category-btn active" data-cat="all">All</button>` +
        categories.map(cat => `<button class="category-btn" data-cat="${cat}">${cat.charAt(0).toUpperCase()+cat.slice(1)}</button>`).join('');
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderPOSProducts(btn.getAttribute('data-cat'));
        });
    });
    setupPosScanner();
}

function renderPOSProducts(category) {
    const grid = document.getElementById('productsGrid');
    let filtered = category === 'all' ? inventory : inventory.filter(p => p.category === category);
    grid.innerHTML = filtered.map(p => `
        <div class="product-card ${p.stock <= 0 ? 'out-of-stock' : ''}" onclick="${p.stock > 0 ? `addToCart(${p.id})` : ''}">
            <i class="fas ${p.icon || 'fa-box'}"></i>
            <div class="product-name">${p.name}</div>
            <div class="product-price">R${p.price.toFixed(2)}</div>
            <div class="product-stock">${p.stock <= 0 ? '❌ Out of stock' : `${p.stock} left`}</div>
        </div>
    `).join('') || '<div class="empty-cart">No products in this category</div>';
}

// ==================== POS BARCODE SCANNER ====================
// FIX: Same pattern — track running state separately from instance
let posScannerInstance = null;
let posScannerRunning = false;

function setupPosScanner() {
    // FIX: Don't clone buttons — just add listeners once and guard with the running flag
    const startBtn = document.getElementById('startScannerBtn');
    const stopBtn = document.getElementById('stopScannerBtn');
    const manualInput = document.getElementById('manualBarcode');
    const manualBtn = document.getElementById('manualBarcodeBtn');

    if (!startBtn) return;

    // Remove old listeners by replacing only if not already set up
    if (!startBtn.dataset.scannerSetup) {
        startBtn.dataset.scannerSetup = '1';

        startBtn.addEventListener('click', async () => {
            if (posScannerRunning) return; // prevent double-start

            const preview = document.getElementById('scannerPreview');
            const resultDiv = document.getElementById('scannedResult');
            resultDiv.className = 'scanned-result';
            resultDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting camera...';

            // FIX: Clear the preview div before creating a new scanner instance
            preview.innerHTML = '';
            preview.style.display = 'block';
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-flex';

            try {
                posScannerInstance = new Html5Qrcode('scannerPreview');
                const devices = await Html5Qrcode.getCameras();
                if (!devices || devices.length === 0) {
                    throw new Error('No camera found on this device.');
                }
                // FIX: Prefer back/rear camera
                const cam = devices.find(d =>
                    d.label.toLowerCase().includes('back') ||
                    d.label.toLowerCase().includes('rear') ||
                    d.label.toLowerCase().includes('environment')
                ) || devices[devices.length - 1];

                await posScannerInstance.start(
                    cam.id,
                    { fps: 10, qrbox: { width: 260, height: 120 }, aspectRatio: 1.7 },
                    (decoded) => {
                        if (navigator.vibrate) navigator.vibrate(100);
                        handleScannedBarcode(decoded);
                        stopPosScanner();
                    },
                    () => {} // per-frame errors are normal, suppress them
                );
                posScannerRunning = true;
                resultDiv.innerHTML = '<i class="fas fa-camera"></i> Point camera at barcode...';
            } catch (err) {
                console.error('POS scanner error:', err);
                posScannerRunning = false;
                posScannerInstance = null;
                preview.style.display = 'none';
                preview.innerHTML = '';
                startBtn.style.display = 'inline-flex';
                stopBtn.style.display = 'none';

                let msg = 'Could not start camera.';
                if (err.name === 'NotAllowedError' || String(err).includes('Permission')) {
                    msg = '📵 Camera permission denied. Allow camera access in your browser settings and try again.';
                } else if (String(err).includes('No camera')) {
                    msg = '📷 No camera found on this device.';
                } else {
                    msg = `⚠️ ${err.message || err}`;
                }
                const resultDiv2 = document.getElementById('scannedResult');
                resultDiv2.className = 'scanned-result error';
                resultDiv2.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${msg}`;
            }
        });

        stopBtn.addEventListener('click', stopPosScanner);

        manualBtn.addEventListener('click', () => {
            const barcode = manualInput.value.trim();
            if (barcode) { handleScannedBarcode(barcode); manualInput.value = ''; }
            else alert('Please enter a barcode');
        });

        manualInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const barcode = manualInput.value.trim();
                if (barcode) { handleScannedBarcode(barcode); manualInput.value = ''; }
            }
        });
    }
}

function stopPosScanner() {
    if (posScannerInstance) {
        // FIX: Use .stop() promise — never check .isScanning
        posScannerInstance.stop().catch(() => {}).finally(() => {
            try { posScannerInstance.clear(); } catch(e) {}
            posScannerInstance = null;
            posScannerRunning = false;
        });
    } else {
        posScannerRunning = false;
    }
    const preview = document.getElementById('scannerPreview');
    const startBtn = document.getElementById('startScannerBtn');
    const stopBtn = document.getElementById('stopScannerBtn');
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    if (startBtn) startBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.style.display = 'none';
}

function stopAllScanners() {
    stopPosScanner();
    stopInvScanner();
}

function handleScannedBarcode(barcode) {
    const resultDiv = document.getElementById('scannedResult');
    const product = inventory.find(p => p.barcode === barcode);
    if (product) {
        addToCart(product.id);
        resultDiv.className = 'scanned-result success';
        resultDiv.innerHTML = `<i class="fas fa-check-circle"></i> Added <strong>${product.name}</strong> to cart! (R${product.price.toFixed(2)})`;
        setTimeout(() => { resultDiv.className = 'scanned-result'; resultDiv.innerHTML = ''; }, 2500);
    } else {
        resultDiv.className = 'scanned-result error';
        resultDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i> Barcode <strong>"${barcode}"</strong> not found. &nbsp;
            <button onclick="quickAddProduct('${barcode}')" class="btn-primary" style="padding:0.3rem 0.8rem;font-size:0.8rem;">Add Product</button>`;
    }
}

// ==================== CART ====================
function addToCart(productId) {
    const product = inventory.find(p => p.id === productId);
    if (!product || product.stock <= 0) { alert('Product out of stock'); return; }
    const existing = currentCart.find(item => item.id === productId);
    if (existing) {
        if (existing.quantity + 1 > product.stock) { alert('Not enough stock'); return; }
        existing.quantity++;
    } else {
        currentCart.push({ ...product, quantity: 1 });
    }
    renderCart();
}

function renderCart() {
    const cartDiv = document.getElementById('cartItems');
    cartDiv.innerHTML = currentCart.length === 0
        ? '<div class="empty-cart">No items added</div>'
        : currentCart.map(item => `
            <div class="cart-item">
                <div class="cart-item-name">${item.name}<br><small>R${item.price.toFixed(2)} each</small></div>
                <div class="cart-item-total">R${(item.price * item.quantity).toFixed(2)}</div>
                <div class="cart-item-controls">
                    <button onclick="updateCartQty(${item.id}, -1)">−</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateCartQty(${item.id}, 1)">+</button>
                    <button onclick="removeFromCart(${item.id})" class="btn-remove">×</button>
                </div>
            </div>
        `).join('');
    updateCartTotals();
}

function updateCartQty(id, delta) {
    const item = currentCart.find(i => i.id === id);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) { removeFromCart(id); return; }
    const product = inventory.find(p => p.id === id);
    if (newQty > product.stock) { alert('Not enough stock'); return; }
    item.quantity = newQty;
    renderCart();
}

function removeFromCart(id) { currentCart = currentCart.filter(i => i.id !== id); renderCart(); }
function clearCart() { currentCart = []; renderCart(); }

function updateCartTotals() {
    const subtotal = currentCart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const vat = subtotal * 0.15;
    const total = subtotal + vat;
    document.getElementById('subtotal').innerText = `R${subtotal.toFixed(2)}`;
    document.getElementById('vat').innerText = `R${vat.toFixed(2)}`;
    document.getElementById('total').innerText = `R${total.toFixed(2)}`;
}

function processPayment() {
    if (currentCart.length === 0) { alert('Cart is empty'); return; }
    const total = parseFloat(document.getElementById('total').innerText.replace('R',''));
    const cash = parseFloat(document.getElementById('cashAmount').value);
    if (isNaN(cash) || cash < total) { alert(`Please enter at least R${total.toFixed(2)}`); return; }
    const change = cash - total;
    for (const cartItem of currentCart) {
        const product = inventory.find(p => p.id === cartItem.id);
        if (product) product.stock -= cartItem.quantity;
    }
    const profit = currentCart.reduce((sum, item) => {
        const product = inventory.find(p => p.id === item.id);
        return sum + ((product ? product.price - product.cost : 0) * item.quantity);
    }, 0);
    const sale = {
        id: Date.now(), date: new Date().toISOString(),
        items: currentCart.map(i => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price })),
        total, profit
    };
    salesHistory.unshift(sale);
    saveInventory(); saveSales(sale);
    alert(`Sale complete! ✅\nTotal: R${total.toFixed(2)}\nCash: R${cash.toFixed(2)}\nChange: R${change.toFixed(2)}`);
    clearCart();
    document.getElementById('cashAmount').value = '';
    renderPOSProducts('all');
    refreshDashboard();
}

function quickAddProduct(barcode) {
    openProductModal({ id: null, name: '', price: '', cost: '', stock: '', category: 'drinks', barcode: barcode, packSize: 1 });
    const resultDiv = document.getElementById('scannedResult');
    resultDiv.className = 'scanned-result'; resultDiv.innerHTML = '';
}

// ==================== CREDIT CUSTOMERS ====================
function setupCreditCustomers() {
    const addBtn = document.getElementById('addCustomerBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const name = prompt('Customer name:');
            if (!name) return;
            const phone = prompt('Phone number (optional):') || '';
            creditCustomers.push({ id: Date.now(), name: name.trim(), phone, balance: 0, createdAt: new Date().toISOString() });
            saveCreditCustomers();
            renderCreditCustomers();
        });
    }
    renderCreditCustomers();
}

function renderCreditCustomers() {
    const totalOwed = creditCustomers.reduce((sum, c) => sum + c.balance, 0);
    const el1 = document.getElementById('totalCustomers');
    const el2 = document.getElementById('totalOwed');
    if (el1) el1.innerText = creditCustomers.length;
    if (el2) el2.innerText = `R${totalOwed.toFixed(2)}`;
    const list = document.getElementById('customerList');
    if (!list) return;
    list.innerHTML = creditCustomers.length === 0
        ? '<div class="empty-cart">No credit customers yet</div>'
        : creditCustomers.map(c => `
            <div class="inventory-item">
                <div class="inv-item-info">
                    <strong>${c.name}</strong> &nbsp; 📞 ${c.phone || '–'}<br>
                    Owes: <strong style="color:${c.balance > 0 ? '#FFD966' : '#4CAF50'}">R${c.balance.toFixed(2)}</strong>
                </div>
                <div class="inventory-actions">
                    <button onclick="addCredit(${c.id})"><i class="fas fa-plus"></i></button>
                    <button onclick="recordPayment(${c.id})"><i class="fas fa-money-bill-wave"></i></button>
                    <button onclick="deleteCustomer(${c.id})" class="btn-delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>`).join('');
}

function addCredit(id) {
    const customer = creditCustomers.find(c => c.id === id);
    if (!customer) return;
    const amount = parseFloat(prompt(`Add credit for ${customer.name} (R):`));
    if (isNaN(amount) || amount <= 0) return;
    customer.balance += amount;
    saveCreditCustomers(); renderCreditCustomers();
}
function recordPayment(id) {
    const customer = creditCustomers.find(c => c.id === id);
    if (!customer) return;
    const amount = parseFloat(prompt(`Payment from ${customer.name}. Balance: R${customer.balance.toFixed(2)}\nAmount (R):`));
    if (isNaN(amount) || amount <= 0) return;
    customer.balance = Math.max(0, customer.balance - amount);
    saveCreditCustomers(); renderCreditCustomers();
}
function deleteCustomer(id) {
    if (confirm('Remove this customer?')) {
        creditCustomers = creditCustomers.filter(c => c.id !== id);
        saveCreditCustomers(); renderCreditCustomers();
    }
}

// ==================== SETTINGS ====================
function setupSettings() {
    document.getElementById('settingsBusinessName').value = business.businessName;
    document.getElementById('settingsBusinessType').value = business.businessType;
    document.getElementById('settingsOwnerName').value = business.ownerName;
    document.getElementById('settingsContact').value = business.contact;

    const settingsForm = document.getElementById('settingsForm');
    const newForm = settingsForm.cloneNode(true);
    settingsForm.parentNode.replaceChild(newForm, settingsForm);
    newForm.addEventListener('submit', (e) => {
        e.preventDefault();
        business.businessName = document.getElementById('settingsBusinessName').value;
        business.businessType = document.getElementById('settingsBusinessType').value;
        business.ownerName = document.getElementById('settingsOwnerName').value;
        business.contact = document.getElementById('settingsContact').value;
        saveBusiness();
        document.getElementById('businessNameDisplay').innerText = business.businessName;
        document.getElementById('businessTypeDisplay').innerText = business.businessType === 'tavern' ? 'Tavern' : 'Tuckshop';
        alert('Settings saved ✅');
    });

    const changePinBtn = document.getElementById('changePinBtn');
    if (changePinBtn) {
        changePinBtn.addEventListener('click', () => {
            const current = prompt('Enter current PIN:');
            if (current !== business.pin) { alert('Incorrect PIN.'); return; }
            const newPin = prompt('Enter new PIN (min 4 digits):');
            if (!newPin || newPin.length < 4) { alert('PIN must be at least 4 digits.'); return; }
            const confirmPin = prompt('Confirm new PIN:');
            if (newPin !== confirmPin) { alert('PINs do not match.'); return; }
            business.pin = newPin; saveBusiness();
            alert('PIN changed ✅');
        });
    }

    document.getElementById('resetDataBtn').addEventListener('click', () => {
        if (confirm('⚠️ Reset ALL data? This cannot be undone.')) { localStorage.clear(); location.reload(); }
    });
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

// ==================== REPORTS ====================
function generateReport(period) {
    const now = new Date();
    let filtered, startDate;
    switch(period) {
        case 'day': startDate = new Date(now.setHours(0,0,0,0)); filtered = salesHistory.filter(s => new Date(s.date) >= startDate); break;
        case 'week': startDate = new Date(now); startDate.setDate(now.getDate()-now.getDay()); startDate.setHours(0,0,0,0); filtered = salesHistory.filter(s => new Date(s.date) >= startDate); break;
        case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); filtered = salesHistory.filter(s => new Date(s.date) >= startDate); break;
        case 'year': startDate = new Date(now.getFullYear(), 0, 1); filtered = salesHistory.filter(s => new Date(s.date) >= startDate); break;
        default: filtered = salesHistory;
    }
    const totalSales = filtered.reduce((sum, s) => sum + s.total, 0);
    const totalProfit = filtered.reduce((sum, s) => sum + s.profit, 0);
    const itemsSold = filtered.reduce((sum, s) => sum + s.items.reduce((a, i) => a + i.quantity, 0), 0);
    document.getElementById('reportTotalSales').innerText = `R${totalSales.toFixed(2)}`;
    document.getElementById('reportTotalProfit').innerText = `R${totalProfit.toFixed(2)}`;
    document.getElementById('reportItemsSold').innerText = itemsSold;
    document.getElementById('reportTransactions').innerText = filtered.length;

    const productSales = {};
    filtered.forEach(s => s.items.forEach(i => { productSales[i.name] = (productSales[i.name] || 0) + i.quantity; }));
    document.getElementById('reportTopProducts').innerHTML = Object.entries(productSales).sort((a,b)=>b[1]-a[1]).slice(0,5)
        .map(([name, qty]) => `<div class="top-product">${name}: ${qty} sold</div>`).join('') || '<div>No sales in this period</div>';

    const dailySales = {};
    filtered.forEach(s => { const d = new Date(s.date).toLocaleDateString(); dailySales[d] = (dailySales[d]||0)+s.total; });
    document.getElementById('reportDailySales').innerHTML = Object.entries(dailySales)
        .map(([date, total]) => `<div class="daily-sale">${date}: R${total.toFixed(2)}</div>`).join('') || '<div>No sales in this period</div>';
}

function exportToCSV() {
    let csv = "Date,Total,Profit,Items\n";
    salesHistory.forEach(s => {
        const itemsCount = s.items.reduce((sum, i) => sum + i.quantity, 0);
        csv += `${s.date},${s.total},${s.profit},${itemsCount}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `thenga_sales_${new Date().toISOString()}.csv`; a.click();
    URL.revokeObjectURL(url);
}

function setupReports() {
    const generateBtn = document.getElementById('generateReportBtn');
    const exportBtn = document.getElementById('exportReportBtn');
    const periodSelect = document.getElementById('reportPeriod');
    if (generateBtn) generateBtn.addEventListener('click', () => generateReport(periodSelect.value));
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
    generateReport('day');
}

// ==================== GLOBAL BINDINGS ====================
window.addToCart = addToCart;
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.processPayment = processPayment;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.quickAddProduct = quickAddProduct;
window.addCredit = addCredit;
window.recordPayment = recordPayment;
window.deleteCustomer = deleteCustomer;
window.logout = logout;
function orderStock() {
    window.open('https://thenga-v2.vercel.app/', '_blank');
}
window.orderStock = orderStock;

window.openProductModal = openProductModal;