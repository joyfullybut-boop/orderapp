// Local Storage Management with IndexedDB support

const STORAGE_KEYS = {
    PRODUCTS: 'orderapp_products',
    CART: 'orderapp_cart',
    ORDERS: 'orderapp_orders',
    VENUE: 'orderapp_venue'
};

// Save to storage (tries IndexedDB first, falls back to localStorage)
async function saveToStorage() {
    try {
        // Try IndexedDB for products (large dataset)
        if (idbStorage && AppState.products.length > 100) {
            await idbStorage.clear('products');
            for (const product of AppState.products) {
                await idbStorage.set('products', product);
            }
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, 'indexeddb'); // Flag
        } else {
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(AppState.products));
        }
        
        // Use localStorage for smaller data
        localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(AppState.cart));
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(AppState.orders));
        localStorage.setItem(STORAGE_KEYS.VENUE, AppState.selectedVenue);
        
        // Save expanded states
        if (AppState.expandedGroups) {
            localStorage.setItem('expandedGroups', JSON.stringify(AppState.expandedGroups));
        }
        if (AppState.expandedMonths) {
            localStorage.setItem('expandedMonths', JSON.stringify(AppState.expandedMonths));
        }
        
    } catch (error) {
        console.error('Error saving to storage:', error);
    }
}

// Load from storage
async function loadFromStorage() {
    try {
        // Load products
        const productsFlag = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
        if (productsFlag === 'indexeddb' && idbStorage) {
            AppState.products = await idbStorage.getAll('products');
        } else if (productsFlag && productsFlag !== 'indexeddb') {
            AppState.products = JSON.parse(productsFlag);
        }
        
        // Load other data
        const cart = localStorage.getItem(STORAGE_KEYS.CART);
        const orders = localStorage.getItem(STORAGE_KEYS.ORDERS);
        const venue = localStorage.getItem(STORAGE_KEYS.VENUE);
        
        if (cart) AppState.cart = JSON.parse(cart);
        if (orders) AppState.orders = JSON.parse(orders);
        if (venue) AppState.selectedVenue = venue;
        
        // Load expanded states
        const expandedGroups = localStorage.getItem('expandedGroups');
        const expandedMonths = localStorage.getItem('expandedMonths');
        
        if (expandedGroups) AppState.expandedGroups = JSON.parse(expandedGroups);
        if (expandedMonths) AppState.expandedMonths = JSON.parse(expandedMonths);
        
        // If no products, load demo data
        if (AppState.products.length === 0) {
            AppState.products = generateDemoProducts();
            await saveToStorage();
        }
        
    } catch (error) {
        console.error('Error loading from storage:', error);
    }
}

// Clear all storage
async function clearStorage() {
    try {
        if (idbStorage) {
            await idbStorage.clear('products');
            await idbStorage.clear('orders');
        }
        
        localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
        localStorage.removeItem(STORAGE_KEYS.CART);
        localStorage.removeItem(STORAGE_KEYS.ORDERS);
        localStorage.removeItem(STORAGE_KEYS.VENUE);
        localStorage.removeItem('expandedGroups');
        localStorage.removeItem('expandedMonths');
    } catch (error) {
        console.error('Error clearing storage:', error);
    }
}

// Export data as JSON (for backup)
function exportData() {
    const data = {
        products: AppState.products,
        cart: AppState.cart,
        orders: AppState.orders,
        venue: AppState.selectedVenue,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orderapp-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Import data from JSON
function importData(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.products) AppState.products = data.products;
            if (data.cart) AppState.cart = data.cart;
            if (data.orders) AppState.orders = data.orders;
            if (data.venue) AppState.selectedVenue = data.venue;
            
            await saveToStorage();
            updateCartBadge();
            renderCurrentTab();
            showToast('✓ Данные импортированы');
            
        } catch (error) {
            alert('Ошибка импорта данных: ' + error.message);
        }
    };
    reader.readAsText(file);
}
