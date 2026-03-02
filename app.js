// App State
const AppState = {
    currentTab: 'catalog',
    products: [],
    cart: [],
    orders: [],
    selectedVenue: 'Мята',
    searchQuery: '',
    selectedCategory: null,
    selectedBrand: null
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Show loading immediately
    const loadingScreen = document.getElementById('loading-screen');
    const mainApp = document.getElementById('main-app');
    
    // Start initialization
    initializeApp();
});

async function initializeApp() {
    try {
        // Load data from storage first
        await loadFromStorage();
        
        // If no products, keep loading screen and wait
        if (AppState.products.length === 0) {
            console.log('No products found, loading demo data...');
            AppState.products = generateDemoProducts();
            await saveToStorage();
        }
        
        // Wait minimum 1.5 seconds for smooth experience
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Hide loading and show app
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        
        // Setup navigation
        setupNavigation();
        
        // Render current tab
        renderCurrentTab();
        updateCartBadge();
        
    } catch (error) {
        console.error('Initialization error:', error);
        // Show app anyway
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        setupNavigation();
        renderCurrentTab();
        updateCartBadge();
    }
}

// Navigation
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            switchTab(tab);
        });
    });
}

function switchTab(tab) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tab);
    });
    
    AppState.currentTab = tab;
    renderCurrentTab();
}

function renderCurrentTab() {
    const content = document.getElementById('app-content');
    const headerTitle = document.getElementById('header-title');
    const headerAction = document.getElementById('header-action');
    
    switch(AppState.currentTab) {
        case 'catalog':
            headerTitle.textContent = 'Каталог';
            headerAction.style.display = 'block';
            headerAction.innerHTML = '↻';
            headerAction.onclick = () => loadPriceList();
            renderCatalog(content);
            break;
        case 'cart':
            headerTitle.textContent = 'Корзина';
            headerAction.style.display = AppState.cart.length > 0 ? 'block' : 'none';
            headerAction.textContent = 'Очистить';
            headerAction.onclick = () => clearCart();
            renderCart(content);
            break;
        case 'history':
            headerTitle.textContent = 'История';
            headerAction.style.display = 'none';
            renderHistory(content);
            break;
        case 'analytics':
            headerTitle.textContent = 'Аналитика';
            headerAction.style.display = 'none';
            renderAnalytics(content);
            break;
        case 'settings':
            headerTitle.textContent = 'Настройки';
            headerAction.style.display = 'none';
            renderSettings(content);
            break;
    }
}

// Catalog View
function renderCatalog(container) {
    const filteredProducts = getFilteredProducts();
    
    // Group products by groupId (brand + weight)
    const grouped = {};
    filteredProducts.forEach(product => {
        const groupKey = product.groupId || `${product.brand} ${product.weight}`;
        if (!grouped[groupKey]) {
            grouped[groupKey] = [];
        }
        grouped[groupKey].push(product);
    });
    
    container.innerHTML = `
        <div class="search-container">
            <div class="search-wrapper">
                <svg class="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input type="text" class="search-bar" placeholder="Поиск товаров..." 
                       value="${AppState.searchQuery}" oninput="handleSearch(this.value)">
                ${AppState.searchQuery ? '<button class="clear-search" onclick="clearSearch()">×</button>' : ''}
            </div>
        </div>
        
        <div style="margin-bottom: 16px; display: flex; gap: 8px; overflow-x: auto;">
            <button class="btn btn-secondary" style="min-width: 100px;" onclick="showFilters()">
                🔍 Фильтры
                ${(AppState.selectedCategories?.length > 0 || AppState.selectedBrands?.length > 0) ? ` (${(AppState.selectedCategories?.length || 0) + (AppState.selectedBrands?.length || 0)})` : ''}
            </button>
            ${(AppState.selectedCategories?.length > 0 || AppState.selectedBrands?.length > 0) ? 
                '<button class="btn btn-secondary" style="min-width: 100px;" onclick="clearAllFilters()">Сбросить</button>' : ''}
        </div>
        
        <div id="products-list">
            ${Object.keys(grouped).length === 0 ? renderEmptyState() : ''}
        </div>
    `;
    
    const productsList = container.querySelector('#products-list');
    let index = 0;
    
    Object.entries(grouped).forEach(([groupName, products]) => {
        setTimeout(() => {
            productsList.innerHTML += renderProductGroup(groupName, products);
        }, index * 30);
        index++;
    });
}

function renderProductGroup(groupName, products) {
    const groupId = 'group_' + groupName.replace(/\s+/g, '_').replace(/[^\w-]/g, '');
    const isExpanded = AppState.expandedGroups?.[groupId] || false;
    
    // Calculate group info
    const minPrice = Math.min(...products.map(p => p.price));
    const maxPrice = Math.max(...products.map(p => p.price));
    const priceText = minPrice === maxPrice ? `${Math.round(minPrice)} ₽` : `от ${Math.round(minPrice)} ₽`;
    const firstProduct = products[0];
    
    return `
        <div class="card group-card fade-in" style="padding: 0; overflow: hidden; margin-bottom: 12px;">
            <div class="group-header" onclick="toggleGroup('${groupId}')" style="padding: 16px; cursor: pointer; user-select: none;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
                            ${groupName}
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                            ${firstProduct.isMarked ? '<span class="product-badge">Маркированный</span>' : ''}
                            <span style="font-size: 13px; color: var(--text-secondary);">${products.length} вкусов</span>
                            <span style="font-size: 13px; color: var(--text-secondary);">•</span>
                            <span style="font-size: 13px; color: var(--text-secondary);">${firstProduct.category}</span>
                        </div>
                    </div>
                    <div style="text-align: right; margin-left: 16px;">
                        <div style="font-size: 20px; font-weight: 700; color: var(--ios-blue); margin-bottom: 4px;">
                            ${priceText}
                        </div>
                        <div style="font-size: 20px; color: var(--ios-gray); transition: transform 0.3s ease; ${isExpanded ? 'transform: rotate(180deg);' : ''}">
                            ▼
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="${groupId}" class="group-content" style="display: ${isExpanded ? 'block' : 'none'}; border-top: 1px solid var(--ios-gray-light);">
                ${products.map(product => `
                    <div style="padding: 12px 16px; border-bottom: 1px solid var(--ios-gray-light); display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                            <div style="font-size: 15px; font-weight: 500; color: var(--text-primary);">
                                ${product.name}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="font-size: 17px; font-weight: 600; color: var(--text-primary);">
                                ${Math.round(product.price)} ₽
                            </div>
                            <button class="add-to-cart-btn" onclick="addToCart('${product.id}')" style="width: 36px; height: 36px; font-size: 20px;">+</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function toggleGroup(groupId) {
    if (!AppState.expandedGroups) {
        AppState.expandedGroups = {};
    }
    
    AppState.expandedGroups[groupId] = !AppState.expandedGroups[groupId];
    
    const element = document.getElementById(groupId);
    const arrow = element.previousElementSibling.querySelector('[style*="transform"]');
    
    if (AppState.expandedGroups[groupId]) {
        element.style.display = 'block';
        element.style.animation = 'slideDown 0.3s ease';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    } else {
        element.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => {
            element.style.display = 'none';
        }, 300);
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
    
    saveToStorage();
}

function getFilteredProducts() {
    // Initialize arrays if not exist
    if (!AppState.selectedCategories) AppState.selectedCategories = [];
    if (!AppState.selectedBrands) AppState.selectedBrands = [];
    
    // Memoization key
    const cacheKey = `${AppState.searchQuery}_${AppState.selectedCategories.join(',')}_${AppState.selectedBrands.join(',')}`;
    
    // Return cached result if available
    if (AppState.filteredCache && AppState.filteredCache.key === cacheKey) {
        return AppState.filteredCache.result;
    }
    
    let filtered = AppState.products;
    
    if (AppState.searchQuery) {
        const query = AppState.searchQuery.toLowerCase();
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(query) ||
            p.brand.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query)
        );
    }
    
    if (AppState.selectedCategories.length > 0) {
        filtered = filtered.filter(p => AppState.selectedCategories.includes(p.category));
    }
    
    if (AppState.selectedBrands.length > 0) {
        filtered = filtered.filter(p => AppState.selectedBrands.includes(p.brand));
    }
    
    // Cache result
    AppState.filteredCache = {
        key: cacheKey,
        result: filtered
    };
    
    return filtered;
}

function handleSearch(value) {
    AppState.searchQuery = value;
    
    // Debounce search to improve performance
    clearTimeout(AppState.searchTimeout);
    AppState.searchTimeout = setTimeout(() => {
        renderCurrentTab();
    }, 300);
}

function clearSearch() {
    AppState.searchQuery = '';
    renderCurrentTab();
}

// Cart View
function renderCart(container) {
    if (AppState.cart.length === 0) {
        container.innerHTML = renderEmptyState('cart', 'Корзина пуста', 'Добавьте товары из каталога');
        return;
    }
    
    // Group cart items by brand
    const brandGroups = {};
    AppState.cart.forEach(item => {
        const brandKey = `${item.product.brand} ${item.product.weight}`;
        if (!brandGroups[brandKey]) {
            brandGroups[brandKey] = {
                brand: item.product.brand,
                weight: item.product.weight,
                isMarked: item.product.isMarked,
                items: [],
                totalWeight: 0,
                totalPrice: 0
            };
        }
        brandGroups[brandKey].items.push(item);
        const weight = parseFloat(item.product.weight) || 0;
        brandGroups[brandKey].totalWeight += weight * item.quantity;
        brandGroups[brandKey].totalPrice += item.product.price * item.quantity;
    });
    
    const total = AppState.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const totalWeight = AppState.cart.reduce((sum, item) => {
        const weight = parseFloat(item.product.weight) || 0;
        return sum + (weight * item.quantity);
    }, 0);
    
    container.innerHTML = `
        <div class="card" style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div style="font-weight: 600;">Заведение:</div>
            </div>
            <button class="btn btn-secondary" onclick="showVenueSelector()">
                🏢 ${AppState.selectedVenue}
            </button>
        </div>
        
        <div id="cart-brands"></div>
        
        <div class="card" style="margin-bottom: 100px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span>Всего позиций:</span>
                <span style="font-weight: 600;">${AppState.cart.reduce((sum, item) => sum + item.quantity, 0)} шт.</span>
            </div>
            ${totalWeight > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span>Общий вес:</span>
                <span style="font-weight: 600;">${Math.round(totalWeight)} гр</span>
            </div>` : ''}
            <div style="height: 1px; background: var(--ios-gray-light); margin: 12px 0;"></div>
            <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 700;">
                <span>Итого:</span>
                <span style="color: var(--ios-blue);">${Math.round(total)} ₽</span>
            </div>
        </div>
        
        <div style="position: fixed; bottom: calc(var(--bottom-nav-height) + var(--safe-area-bottom) + 16px); left: 16px; right: 16px;">
            <button class="btn btn-primary" onclick="submitOrder()">
                Отправить заявку
            </button>
        </div>
    `;
    
    const brandsContainer = container.querySelector('#cart-brands');
    
    Object.values(brandGroups).forEach(group => {
        const marked = group.isMarked ? ' маркированный' : '';
        brandsContainer.innerHTML += `
            <div class="card" style="margin-bottom: 12px; padding: 0; overflow: hidden;">
                <div style="background: linear-gradient(135deg, var(--ios-blue), #5856d6); color: white; padding: 12px 16px;">
                    <div style="font-size: 16px; font-weight: 600; margin-bottom: 4px;">
                        ${group.brand} ${group.weight}${marked}
                    </div>
                    <div style="font-size: 13px; opacity: 0.9;">
                        ${group.items.length} вкусов • ${Math.round(group.totalWeight)} гр • ${Math.round(group.totalPrice)} ₽
                    </div>
                </div>
                
                <div style="padding: 8px;">
                    ${group.items.map(item => `
                        <div style="padding: 12px 8px; border-bottom: 1px solid var(--ios-gray-light); display: flex; justify-content: space-between; align-items: center;">
                            <div style="flex: 1;">
                                <div style="font-size: 15px; font-weight: 500; margin-bottom: 4px;">
                                    ${item.product.name}
                                </div>
                                <div style="font-size: 13px; color: var(--text-secondary);">
                                    ${Math.round(item.product.price)} ₽/шт
                                </div>
                            </div>
                            
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <button onclick="updateCartQuantity('${item.id}', ${item.quantity - 1})" 
                                        style="width: 28px; height: 28px; border-radius: 14px; border: none; background: var(--ios-blue); color: white; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;">−</button>
                                <span style="font-size: 16px; font-weight: 600; min-width: 24px; text-align: center;">${item.quantity}</span>
                                <button onclick="updateCartQuantity('${item.id}', ${item.quantity + 1})" 
                                        style="width: 28px; height: 28px; border-radius: 14px; border: none; background: var(--ios-blue); color: white; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;">+</button>
                                
                                <div style="min-width: 70px; text-align: right;">
                                    <div style="font-size: 16px; font-weight: 700; color: var(--ios-blue);">
                                        ${Math.round(item.product.price * item.quantity)} ₽
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
}

// History View
function renderHistory(container) {
    const selectedVenue = AppState.historyVenueFilter || null;
    const filteredOrders = selectedVenue 
        ? AppState.orders.filter(o => o.venue === selectedVenue)
        : AppState.orders;
    
    if (filteredOrders.length === 0) {
        container.innerHTML = renderEmptyState('doc.text', 'Нет заявок', 'История ваших заявок появится здесь');
        return;
    }
    
    // Group orders by month/year
    const groupedByMonth = {};
    filteredOrders.forEach(order => {
        const date = new Date(order.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!groupedByMonth[key]) {
            groupedByMonth[key] = [];
        }
        groupedByMonth[key].push(order);
    });
    
    // Sort months descending
    const sortedMonths = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));
    
    container.innerHTML = `
        <div style="margin-bottom: 16px; display: flex; gap: 8px;">
            <button class="btn ${!selectedVenue ? 'btn-primary' : 'btn-secondary'}" 
                    style="flex: 1;" 
                    onclick="filterHistoryByVenue(null)">
                Все
            </button>
            <button class="btn ${selectedVenue === 'Мята' ? 'btn-primary' : 'btn-secondary'}" 
                    style="flex: 1;" 
                    onclick="filterHistoryByVenue('Мята')">
                Мята
            </button>
            <button class="btn ${selectedVenue === 'Френдс' ? 'btn-primary' : 'btn-secondary'}" 
                    style="flex: 1;" 
                    onclick="filterHistoryByVenue('Френдс')">
                Френдс
            </button>
        </div>
        
        <div id="history-months"></div>
    `;
    
    const monthsContainer = container.querySelector('#history-months');
    
    sortedMonths.forEach((monthKey, index) => {
        const orders = groupedByMonth[monthKey];
        const [year, month] = monthKey.split('-');
        const date = new Date(year, month - 1);
        const monthName = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
        
        const totalAmount = orders.reduce((sum, o) => sum + o.total, 0);
        const totalOrders = orders.length;
        
        const isExpanded = AppState.expandedMonths?.[monthKey] || false;
        
        setTimeout(() => {
            monthsContainer.innerHTML += `
                <div class="card fade-in" style="padding: 0; margin-bottom: 12px;">
                    <div class="month-header" onclick="toggleMonth('${monthKey}')" style="padding: 16px; cursor: pointer;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 18px; font-weight: 600; text-transform: capitalize; margin-bottom: 4px;">
                                    ${monthName}
                                </div>
                                <div style="font-size: 13px; color: var(--text-secondary);">
                                    ${totalOrders} заявок • ${Math.round(totalAmount)} ₽
                                </div>
                            </div>
                            <div style="font-size: 20px; color: var(--ios-gray); transition: transform 0.3s ease; ${isExpanded ? 'transform: rotate(180deg);' : ''}">
                                ▼
                            </div>
                        </div>
                    </div>
                    
                    <div id="month-${monthKey}" style="display: ${isExpanded ? 'block' : 'none'}; border-top: 1px solid var(--ios-gray-light);">
                        ${orders.map(order => renderOrderCardGrouped(order)).join('')}
                    </div>
                </div>
            `;
        }, index * 50);
    });
}

function toggleMonth(monthKey) {
    if (!AppState.expandedMonths) {
        AppState.expandedMonths = {};
    }
    
    AppState.expandedMonths[monthKey] = !AppState.expandedMonths[monthKey];
    
    const element = document.getElementById(`month-${monthKey}`);
    const arrow = element.previousElementSibling.querySelector('[style*="transform"]');
    
    if (AppState.expandedMonths[monthKey]) {
        element.style.display = 'block';
        element.style.animation = 'slideDown 0.3s ease';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    } else {
        element.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => {
            element.style.display = 'none';
        }, 300);
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
    
    saveToStorage();
}

function filterHistoryByVenue(venue) {
    AppState.historyVenueFilter = venue;
    saveToStorage();
    renderCurrentTab();
}

function renderOrderCardGrouped(order) {
    const date = new Date(order.date);
    const dateStr = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' ' + 
                    date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    // Group items by brand
    const brandGroups = {};
    order.items.forEach(item => {
        const brandKey = `${item.product.brand} ${item.product.weight}`;
        if (!brandGroups[brandKey]) {
            brandGroups[brandKey] = {
                brand: item.product.brand,
                weight: item.product.weight,
                isMarked: item.product.isMarked,
                items: [],
                totalPrice: 0
            };
        }
        brandGroups[brandKey].items.push(item);
        brandGroups[brandKey].totalPrice += item.product.price * item.quantity;
    });
    
    return `
        <div class="order-card-grouped touchable" onclick="showOrderDetails('${order.id}')" style="padding: 16px; border-bottom: 1px solid var(--ios-gray-light);">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                <div style="flex: 1; min-width: 0; margin-right: 12px;">
                    <div style="font-size: 16px; font-weight: 600; word-break: break-word;">${order.venue}</div>
                    <div style="font-size: 13px; color: var(--text-tertiary); word-break: break-word;">${dateStr}</div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                    <div style="font-size: 18px; font-weight: 700; color: var(--ios-blue); white-space: nowrap;">${Math.round(order.total)} ₽</div>
                    <div style="font-size: 12px; color: var(--text-secondary); white-space: nowrap;">${Math.round(order.totalWeight)} гр</div>
                </div>
            </div>
            
            ${Object.values(brandGroups).map(group => {
                const marked = group.isMarked ? ' ⭐' : '';
                return `
                    <div style="margin-bottom: 8px; padding: 8px; background: var(--bg-tertiary); border-radius: 8px;">
                        <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px; word-break: break-word;">
                            ${group.brand} ${group.weight}${marked}
                        </div>
                        ${group.items.map(item => `
                            <div style="font-size: 13px; color: var(--text-secondary); padding-left: 8px; word-break: break-word;">
                                • ${item.product.name} (${item.quantity} шт.)
                            </div>
                        `).join('')}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Analytics View
function renderAnalytics(container) {
    renderAdvancedAnalytics(container);
}

// Settings View
function renderSettings(container) {
    container.innerHTML = `
        <div style="font-size: 13px; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 8px; padding: 0 4px;">Данные</div>
        <div class="card" style="margin-bottom: 24px;">
            <button class="btn btn-primary" onclick="loadPriceList()" style="margin-bottom: 12px;">
                <span>↻</span>
                <span>Обновить прайс-лист</span>
            </button>
            
            <a href="${TELEGRAM_CONFIG.priceListUrl}" target="_blank" class="btn btn-secondary" style="margin-bottom: 12px; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px;">
                <span>🔗</span>
                <span>Открыть ссылку на файл</span>
            </a>
            
            <button class="btn btn-secondary" onclick="uploadExcelFile()">
                <span>📄</span>
                <span>Загрузить Excel вручную</span>
            </button>
            
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 1px solid var(--ios-gray-light); margin-top: 16px;">
                <span>Товаров в каталоге</span>
                <span style="color: var(--text-tertiary);">${AppState.products.length}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 12px 0; border-top: 1px solid var(--ios-gray-light);">
                <span>Всего заявок</span>
                <span style="color: var(--text-tertiary);">${AppState.orders.length}</span>
            </div>
        </div>
        
        <div style="font-size: 13px; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 8px; padding: 0 4px;">Telegram настройки</div>
        <div class="card" style="margin-bottom: 24px;">
            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">
                    Telegram ID получателя:
                </label>
                <input 
                    type="text" 
                    id="manager-id-input" 
                    value="${TELEGRAM_CONFIG.managerChatId}" 
                    placeholder="426685886"
                    style="width: 100%; padding: 12px; border: 1px solid var(--ios-gray-light); border-radius: 8px; font-size: 15px;"
                    onkeypress="return event.charCode >= 48 && event.charCode <= 57"
                />
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">
                    Username Telegram:
                </label>
                <input 
                    type="text" 
                    id="manager-username-input" 
                    value="${TELEGRAM_CONFIG.managerUsername}" 
                    placeholder="@username"
                    style="width: 100%; padding: 12px; border: 1px solid var(--ios-gray-light); border-radius: 8px; font-size: 15px;"
                />
            </div>
            
            <button class="btn btn-primary" onclick="saveTelegramSettings()" style="margin-bottom: 12px;">
                💾 Сохранить настройки
            </button>
            
            <button class="btn btn-secondary" onclick="testTelegramConnection()">
                📤 Отправить тестовое сообщение
            </button>
        </div>
        
        <div style="font-size: 13px; color: var(--ios-blue); text-transform: uppercase; margin-bottom: 8px; padding: 0 4px;">📌 Инструкция</div>
        <div class="card" style="margin-bottom: 24px; background: rgba(0, 122, 255, 0.05);">
            <div style="font-size: 15px; font-weight: 600; margin-bottom: 8px; color: var(--ios-blue);">
                Как загрузить прайс-лист:
            </div>
            <ol style="margin: 0; padding-left: 20px; line-height: 1.6; color: var(--text-secondary);">
                <li><strong>Автоматически:</strong> Нажмите "Обновить прайс-лист"</li>
                <li><strong>Вручную:</strong><br/>
                    - Нажмите "Открыть ссылку на файл"<br/>
                    - Скачайте файл на устройство<br/>
                    - Нажмите "Загрузить Excel вручную"<br/>
                    - Выберите файл
                </li>
            </ol>
        </div>
        
        <div style="font-size: 13px; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 8px; padding: 0 4px;">О приложении</div>
        <div class="card" style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; padding: 12px 0;">
                <span>Версия</span>
                <span style="color: var(--text-tertiary);">3.0.1</span>
            </div>
        </div>
        
        <div style="font-size: 13px; color: var(--ios-red); text-transform: uppercase; margin-bottom: 8px; padding: 0 4px;">Опасная зона</div>
        <div class="card">
            <button class="btn btn-danger" onclick="confirmClearData()">
                Очистить все данные
            </button>
        </div>
    `;
}

// Save Telegram settings
function saveTelegramSettings() {
    const idInput = document.getElementById('manager-id-input');
    const usernameInput = document.getElementById('manager-username-input');
    
    const newId = idInput.value.trim();
    const newUsername = usernameInput.value.trim();
    
    if (!newId) {
        alert('❌ ID не может быть пустым');
        return;
    }
    
    if (!/^\d+$/.test(newId)) {
        alert('❌ ID должен содержать только цифры');
        return;
    }
    
    if (newUsername && !newUsername.startsWith('@')) {
        alert('❌ Username должен начинаться с @');
        return;
    }
    
    TELEGRAM_CONFIG.managerChatId = newId;
    TELEGRAM_CONFIG.managerUsername = newUsername || '@username';
    
    saveTelegramConfig();
    
    showSuccessAnimation('Настройки сохранены!');
}

// Test Telegram connection
async function testTelegramConnection() {
    try {
        showToast('Отправка тестового сообщения...');
        
        const message = `🧪 <b>Тестовое сообщение</b>\n\nПриложение OrderApp настроено правильно!\n\nВаш ID: ${TELEGRAM_CONFIG.managerChatId}\nВаш username: ${TELEGRAM_CONFIG.managerUsername}`;
        
        const apiUrl = `https://api.telegram.org/bot${TELEGRAM_CONFIG.botToken}/sendMessage`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: TELEGRAM_CONFIG.managerChatId,
                text: message,
                parse_mode: 'HTML'
            })
        });
        
        const data = await response.json();
        
        if (!data.ok) {
            throw new Error(data.description || 'Не удалось отправить сообщение');
        }
        
        showSuccessAnimation('Сообщение отправлено!');
        alert('✅ Успешно!\n\nТестовое сообщение отправлено в Telegram.\n\nПроверьте свои сообщения.');
        
    } catch (error) {
        console.error('Test message error:', error);
        alert('❌ Ошибка отправки:\n\n' + error.message + '\n\nПроверьте:\n1. ID правильный\n2. Вы написали боту /start\n3. Есть интернет');
    }
}

// Helper Functions
function renderEmptyState(icon, title, text) {
    const icons = {
        'cart': '🛒',
        'doc.text': '📄',
        'chart.bar': '📊'
    };
    return `
        <div class="empty-state">
            <div class="empty-icon">${icons[icon] || '📦'}</div>
            <div class="empty-title">${title || 'Пусто'}</div>
            <div class="empty-text">${text || ''}</div>
        </div>
    `;
}

function updateCartBadge() {
    const badge = document.getElementById('cart-badge');
    const count = AppState.cart.reduce((sum, item) => sum + item.quantity, 0);
    
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// Cart Operations
function addToCart(productId) {
    const product = AppState.products.find(p => p.id === productId);
    if (!product) return;
    
    // Always add as new item (not combine)
    AppState.cart.push({
        id: Date.now().toString() + Math.random(),
        product: product,
        quantity: 1
    });
    
    saveToStorage();
    updateCartBadge();
    
    // Show feedback
    showToast('Добавлено в корзину');
}

function updateCartQuantity(itemId, newQuantity) {
    if (newQuantity <= 0) {
        AppState.cart = AppState.cart.filter(item => item.id !== itemId);
    } else {
        const item = AppState.cart.find(item => item.id === itemId);
        if (item) item.quantity = newQuantity;
    }
    
    saveToStorage();
    updateCartBadge();
    renderCurrentTab();
}

function clearCart() {
    if (confirm('Очистить корзину?')) {
        AppState.cart = [];
        saveToStorage();
        updateCartBadge();
        renderCurrentTab();
    }
}

// Utility Functions
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: calc(var(--header-height) + var(--safe-area-top) + 16px);
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 12px 24px;
        border-radius: 20px;
        font-size: 15px;
        z-index: 9999;
        animation: fadeIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function confirmClearData() {
    if (confirm('Удалить все данные? Это действие нельзя отменить.')) {
        AppState.products = [];
        AppState.orders = [];
        AppState.cart = [];
        saveToStorage();
        updateCartBadge();
        renderCurrentTab();
        showToast('Данные удалены');
    }
}
