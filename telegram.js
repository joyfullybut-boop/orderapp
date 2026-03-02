// Telegram Bot Configuration
const TELEGRAM_CONFIG = {
    botToken: '8307692946:AAHMivN622WMGGsk50IAO9a-JZhyWUw7-bE',
    managerChatId: '426685886', // Default, can be changed in settings
    managerUsername: '@Akuma8', // Default, can be changed in settings
    priceListUrl: 'https://disk.yandex.ru/i/HPfnJ8OPM-ZEYg' // Yandex.Disk link
};

// Save Telegram config to storage
function saveTelegramConfig() {
    localStorage.setItem('telegram_config', JSON.stringify(TELEGRAM_CONFIG));
}

// Load Telegram config from storage
function loadTelegramConfig() {
    const saved = localStorage.getItem('telegram_config');
    if (saved) {
        const config = JSON.parse(saved);
        TELEGRAM_CONFIG.managerChatId = config.managerChatId;
        TELEGRAM_CONFIG.managerUsername = config.managerUsername;
    }
}

// Initialize config on load
loadTelegramConfig();

// Load Price List from Yandex.Disk via Netlify Function
async function loadPriceList() {
    // Show loading overlay
    showFullScreenLoading('Загрузка прайс-листа...');
    
    try {
        // Check if XLSX library is loaded
        if (typeof XLSX === 'undefined') {
            throw new Error('Библиотека XLSX не загружена.\n\nПерезагрузите страницу.');
        }
        
        updateLoadingText('Подключение к серверу...');
        
        // Check if we're on Netlify (has function endpoint)
        const isNetlify = window.location.hostname.includes('netlify') || 
                         window.location.hostname.includes('localhost');
        
        let excelBlob;
        
                if (isNetlify) {
    updateLoadingText('Получаем ссылку на файл...');
    
    const response = await fetch('/.netlify/functions/getExcel');
    
    if (!response.ok) {
        throw new Error('Netlify Function вернула ошибку: ' + response.status);
    }
    
    const data = await response.json();
    
    if (!data.success) {
        throw new Error(data.error || 'Function не сработала');
    }
    
    updateLoadingText('Скачивание прайс-листа через прокси...');
    
    // ← Новый прокси-запрос к той же функции с параметром url
    const proxyResponse = await fetch(`/.netlify/functions/getExcel?url=${encodeURIComponent(data.downloadUrl)}`);
    
    if (!proxyResponse.ok) {
        throw new Error('Прокси скачивание не удалось: ' + proxyResponse.status);
    }
    
    excelBlob = await proxyResponse.blob();
    
    console.log('✅ Загружено через прокси Netlify, размер:', excelBlob.size, 'bytes');
}
            // Fallback to direct methods (for other hosts)
            updateLoadingText('Подключение к Яндекс.Диску...');
            
            const publicUrl = TELEGRAM_CONFIG.priceListUrl;
            const directUrl = publicUrl.replace('/i/', '/d/');
            
            updateLoadingText('Скачивание файла...');
            
            try {
                // Try direct download first
                const response = await fetch(directUrl);
                if (!response.ok) throw new Error('Direct download failed');
                excelBlob = await response.blob();
            } catch (e) {
                console.log('Direct download failed, trying API method...');
                
                // Try API method
                try {
                    const apiUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(publicUrl)}`;
                    
                    const apiResponse = await fetch(apiUrl);
                    if (!apiResponse.ok) throw new Error('API request failed');
                    
                    const data = await apiResponse.json();
                    const downloadUrl = data.href;
                    
                    const fileResponse = await fetch(downloadUrl);
                    if (!fileResponse.ok) throw new Error('File download failed');
                    
                    excelBlob = await fileResponse.blob();
                } catch (apiError) {
                    console.error('All methods failed:', apiError);
                    throw new Error('НЕ УДАЛОСЬ ЗАГРУЗИТЬ\n\nИспользуйте "Загрузить Excel вручную"');
                }
            }
        }
        
        updateLoadingText('Обработка данных...');
        
        // Parse Excel file
        const products = await parseExcelFile(excelBlob);
        
        if (products.length === 0) {
            throw new Error('В файле не найдено товаров.\n\nПроверьте формат файла.');
        }
        
        updateLoadingText('Сохранение данных...');
        
        AppState.products = products;
        AppState.expandedGroups = {};
        AppState.filteredCache = null; // Clear cache
        await saveToStorage();
        
        updateLoadingText('Готово!');
        
        // Hide loading and show success
        setTimeout(() => {
            hideFullScreenLoading();
            showSuccessAnimation(`Загружено ${products.length} товаров`);
            switchTab('catalog');
        }, 500);
        
    } catch (error) {
        console.error('Error loading price list:', error);
        hideFullScreenLoading();
        
        // Show error with instructions
        const errorMsg = `❌ ОШИБКА ЗАГРУЗКИ\n\n${error.message}\n\n💡 РЕШЕНИЕ:\n\n1. Используйте "Загрузить Excel вручную"\n2. Или откройте ссылку в браузере и скачайте файл\n\nСсылка: ${TELEGRAM_CONFIG.priceListUrl}`;
        
        alert(errorMsg);
    }
}

// Submit Order to Telegram with new format
async function submitOrder() {
    if (AppState.cart.length === 0) {
        alert('Корзина пуста');
        return;
    }
    
    const confirmed = confirm(`Отправить заявку в ${AppState.selectedVenue}?`);
    if (!confirmed) return;
    
    try {
        showToast('Отправка заявки...');
        
        // Create order
        const order = createOrder();
        
        // Format message with new grouped format
        const message = formatOrderForTelegramGrouped(order);
        
        // Send to Telegram
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
            console.error('Telegram error:', data);
            throw new Error(data.description || 'Telegram API вернул ошибку');
        }
        
        // Save order to history
        AppState.orders.unshift(order);
        AppState.cart = [];
        saveToStorage();
        updateCartBadge();
        
        showSuccessAnimation('Заявка отправлена!');
        
        setTimeout(() => {
            switchTab('history');
        }, 1500);
        
    } catch (error) {
        console.error('Error submitting order:', error);
        
        let errorMsg = 'Ошибка отправки заявки:\n\n';
        errorMsg += error.message;
        
        alert(errorMsg);
    }
}

// Format Order for Telegram with grouped brands
function formatOrderForTelegramGrouped(order) {
    let message = `<b>Заявка ${order.venue}</b>\n`;
    
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
                totalWeight: 0,
                totalPrice: 0
            };
        }
        
        brandGroups[brandKey].items.push(item);
        const weight = parseFloat(item.product.weight) || 0;
        brandGroups[brandKey].totalWeight += weight * item.quantity;
        brandGroups[brandKey].totalPrice += item.product.price * item.quantity;
    });
    
    // Format each brand group
    Object.values(brandGroups).forEach(group => {
        const marked = group.isMarked ? ' маркированный' : '';
        message += `${group.brand} ${group.weight}${marked} (всего ${Math.round(group.totalWeight)}гр/${Math.round(group.totalPrice)}р)\n`;
        
        // List flavors
        group.items.forEach(item => {
            message += `${item.product.name} (${item.quantity} шт.)\n`;
        });
    });
    
    message += `<b>Итого: ${Math.round(order.total)} руб.</b>\n`;
    message += `<b>Общий вес ${Math.round(order.totalWeight)}гр</b>`;
    
    return message;
}

// Create Order Object
function createOrder() {
    const total = AppState.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const totalWeight = AppState.cart.reduce((sum, item) => {
        const weight = parseFloat(item.product.weight) || 0;
        return sum + (weight * item.quantity);
    }, 0);
    
    return {
        id: Date.now().toString(),
        venue: AppState.selectedVenue,
        items: AppState.cart.map(item => ({
            product: item.product,
            quantity: item.quantity
        })),
        date: new Date().toISOString(),
        total: total,
        totalWeight: totalWeight
    };
}

// Show full-screen loading overlay
function showFullScreenLoading(text) {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner-large"></div>
            <div class="loading-text">${text}</div>
            <div class="loading-progress">
                <div class="loading-progress-bar"></div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function updateLoadingText(text) {
    const textEl = document.querySelector('#loading-overlay .loading-text');
    if (textEl) {
        textEl.textContent = text;
        // Animate progress bar
        const progressBar = document.querySelector('.loading-progress-bar');
        const currentWidth = parseInt(progressBar.style.width) || 0;
        progressBar.style.width = Math.min(currentWidth + 20, 90) + '%';
    }
}

function hideFullScreenLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => overlay.remove(), 300);
    }
}

// Show success animation
function showSuccessAnimation(text) {
    const overlay = document.createElement('div');
    overlay.className = 'success-overlay';
    overlay.innerHTML = `
        <div class="success-content">
            <div class="success-checkmark">✓</div>
            <div class="success-text">${text}</div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    setTimeout(() => {
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => overlay.remove(), 300);
    }, 2000);
}

// Demo Products Generator (for first load)
function generateDemoProducts() {
    return [
        {
            id: 'demo_1',
            name: 'Pan Raas (Легенда)',
            brand: 'Afzal',
            weight: '40 гр',
            category: 'Товары без НДС',
            price: 330,
            isMarked: true,
            groupId: 'Afzal 40 гр маркированный'
        },
        {
            id: 'demo_2',
            name: 'Barberry (Барбарис)',
            brand: 'Bonche',
            weight: '120 гр',
            category: 'Товары без НДС',
            price: 1900,
            isMarked: true,
            groupId: 'Bonche 120 гр маркированный'
        }
    ];
}

// Show Venue Selector
function showVenueSelector() {
    const venues = ['Мята', 'Френдс'];
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    modal.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">Выберите заведение</div>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">Готово</button>
            </div>
            ${venues.map(venue => `
                <div class="card touchable" onclick="selectVenue('${venue}')">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 17px;">${venue}</span>
                        ${AppState.selectedVenue === venue ? '<span style="color: var(--ios-blue); font-size: 20px;">✓</span>' : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    document.getElementById('modal-container').appendChild(modal);
}

function selectVenue(venue) {
    AppState.selectedVenue = venue;
    saveToStorage();
    document.querySelector('.modal-overlay').remove();
    renderCurrentTab();
}

// Show Filters
function showFilters() {
    const categories = [...new Set(AppState.products.map(p => p.category))];
    const brands = [...new Set(AppState.products.map(p => p.brand))];
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    modal.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <button class="modal-close" onclick="clearFilters(); this.closest('.modal-overlay').remove();">Сбросить</button>
                <div class="modal-title">Фильтры</div>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">Готово</button>
            </div>
            
            <div style="font-size: 13px; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 8px;">Категория</div>
            ${categories.map(cat => `
                <div class="card touchable" onclick="selectCategory('${cat}')">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${cat}</span>
                        ${AppState.selectedCategory === cat ? '<span style="color: var(--ios-blue);">✓</span>' : ''}
                    </div>
                </div>
            `).join('')}
            
            <div style="font-size: 13px; color: var(--text-tertiary); text-transform: uppercase; margin: 24px 0 8px;">Бренд</div>
            ${brands.map(brand => `
                <div class="card touchable" onclick="selectBrand('${brand}')">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${brand}</span>
                        ${AppState.selectedBrand === brand ? '<span style="color: var(--ios-blue);">✓</span>' : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    document.getElementById('modal-container').appendChild(modal);
}

function selectCategory(category) {
    AppState.selectedCategory = AppState.selectedCategory === category ? null : category;
    renderCurrentTab();
    document.querySelector('.modal-overlay').remove();
}

function selectBrand(brand) {
    AppState.selectedBrand = AppState.selectedBrand === brand ? null : brand;
    renderCurrentTab();
    document.querySelector('.modal-overlay').remove();
}

function clearFilters() {
    AppState.selectedCategory = null;
    AppState.selectedBrand = null;
    renderCurrentTab();
}

// Show Order Details
function showOrderDetails(orderId) {
    const order = AppState.orders.find(o => o.id === orderId);
    if (!order) return;
    
    const date = new Date(order.date);
    const formattedDate = date.toLocaleDateString('ru-RU', { 
        day: 'numeric',
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    modal.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div></div>
                <div class="modal-title">Детали заявки</div>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
            </div>
            
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">${order.venue}</div>
                <div style="font-size: 14px; color: var(--text-tertiary);">${formattedDate}</div>
            </div>
            
            <div style="font-size: 15px; font-weight: 600; margin-bottom: 12px;">Товары</div>
            ${order.items.map(item => {
                const totalPrice = item.product.price * item.quantity;
                const weight = parseFloat(item.product.weight) || 0;
                const totalWeight = weight * item.quantity;
                
                return `
                    <div class="card">
                        <div class="product-name">${item.product.brand} ${item.product.weight} - ${item.product.name}</div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                            <div style="color: var(--text-secondary); font-size: 14px;">
                                ${item.quantity} шт. × ${Math.round(item.product.price)} ₽
                                ${totalWeight > 0 ? ` • ${Math.round(totalWeight)} гр` : ''}
                            </div>
                            <div style="font-weight: 600; color: var(--ios-blue);">${Math.round(totalPrice)} ₽</div>
                        </div>
                    </div>
                `;
            }).join('')}
            
            <div class="card" style="background: var(--bg-tertiary); margin-top: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Всего позиций:</span>
                    <span style="font-weight: 600;">${order.items.length}</span>
                </div>
                ${order.totalWeight > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span>Общий вес:</span>
                    <span style="font-weight: 600;">${Math.round(order.totalWeight)} гр</span>
                </div>` : ''}
                <div style="height: 1px; background: var(--ios-gray-light); margin: 12px 0;"></div>
                <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 700;">
                    <span>Итого:</span>
                    <span style="color: var(--ios-blue);">${Math.round(order.total)} ₽</span>
                </div>
            </div>
            
            <div style="font-size: 15px; font-weight: 600; margin: 24px 0 12px;">Текст заявки</div>
            <div class="card" style="background: var(--bg-tertiary); font-family: monospace; font-size: 13px; white-space: pre-wrap;">
${formatOrderForTelegram(order).replace(/<[^>]*>/g, '')}
            </div>
        </div>
    `;
    
    document.getElementById('modal-container').appendChild(modal);
}

function filterHistory(venue) {
    // This would filter the history view
    renderCurrentTab();
}

// Submit Order to Telegram
async function submitOrder() {
    if (AppState.cart.length === 0) {
        alert('Корзина пуста');
        return;
    }
    
    if (!TELEGRAM_CONFIG.botToken) {
        alert('⚠️ Ошибка: Bot Token не настроен!\n\nОткройте файл telegram.js и вставьте ваш токен от @BotFather');
        return;
    }
    
    const confirmed = confirm(`Отправить заявку в ${AppState.selectedVenue}?`);
    if (!confirmed) return;
    
    try {
        showToast('Отправка заявки...');
        
        // Create order
        const order = createOrder();
        
        // Format message
        const message = formatOrderForTelegram(order);
        
        // Send to Telegram
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
            throw new Error('Telegram API вернул ошибку');
        }
        
        // Save order to history
        AppState.orders.unshift(order);
        AppState.cart = [];
        saveToStorage();
        updateCartBadge();
        
        showToast('✓ Заявка отправлена!');
        switchTab('history');
        
    } catch (error) {
        console.error('Error submitting order:', error);
        alert('Ошибка отправки заявки:\n' + error.message + '\n\nПроверьте Bot Token и ID менеджера');
    }
}

// Create Order Object
function createOrder() {
    const total = AppState.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const totalWeight = AppState.cart.reduce((sum, item) => {
        const weight = parseFloat(item.product.weight) || 0;
        return sum + (weight * item.quantity);
    }, 0);
    
    return {
        id: Date.now().toString(),
        venue: AppState.selectedVenue,
        items: AppState.cart.map(item => ({
            product: item.product,
            quantity: item.quantity
        })),
        date: new Date().toISOString(),
        total: total,
        totalWeight: totalWeight
    };
}

// Format Order for Telegram
function formatOrderForTelegram(order) {
    let message = `<b>Заявка ${order.venue}</b>\n`;
    
    order.items.forEach(item => {
        const p = item.product;
        const name = p.isMarked ? `${p.brand} ${p.weight} маркированный - ${p.name}` : `${p.brand} ${p.weight} - ${p.name}`;
        const totalPrice = Math.round(p.price * item.quantity);
        const weight = parseFloat(p.weight) || 0;
        const totalWeight = weight * item.quantity;
        
        message += `${name} (${item.quantity} шт.) - ${totalPrice} руб.`;
        if (totalWeight > 0) {
            message += ` Всего ${Math.round(totalWeight)}гр`;
        }
        message += '\n';
    });
    
    message += `\n<b>Итого: ${Math.round(order.total)} руб.</b>`;
    if (order.totalWeight > 0) {
        message += `\n<b>Общий вес ${Math.round(order.totalWeight)}гр</b>`;
    }
    
    return message;
}

// Demo Products Generator (для тестирования)
function generateDemoProducts() {
    const brands = ['Afzal', 'Adalya', 'Darkside', 'Fumari', 'Starbuzz', 'Al Fakher'];
    const flavors = ['Cherry', 'Mint', 'Grape', 'Apple', 'Melon', 'Peach', 'Berry', 'Orange', 'Lemon'];
    const categories = ['Табак', 'Уголь', 'Аксессуары', 'Жидкости'];
    const weights = ['40 гр', '50 гр', '100 гр', '250 гр', '1 кг'];
    
    const products = [];
    
    for (let i = 0; i < 50; i++) {
        const brand = brands[Math.floor(Math.random() * brands.length)];
        const flavor = flavors[Math.floor(Math.random() * flavors.length)];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const weight = weights[Math.floor(Math.random() * weights.length)];
        const price = Math.floor(Math.random() * 500) + 200;
        const isMarked = Math.random() > 0.7;
        
        products.push({
            id: `product_${i}`,
            name: flavor,
            brand: brand,
            weight: weight,
            category: category,
            price: price,
            isMarked: isMarked
        });
    }
    
    return products;
}

// Show Venue Selector
function showVenueSelector() {
    const venues = ['Мята', 'Френдс'];
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    modal.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div class="modal-title">Выберите заведение</div>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">Готово</button>
            </div>
            ${venues.map(venue => `
                <div class="card touchable" onclick="selectVenue('${venue}')">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 17px;">${venue}</span>
                        ${AppState.selectedVenue === venue ? '<span style="color: var(--ios-blue); font-size: 20px;">✓</span>' : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    document.getElementById('modal-container').appendChild(modal);
}

function selectVenue(venue) {
    AppState.selectedVenue = venue;
    saveToStorage();
    document.querySelector('.modal-overlay').remove();
    renderCurrentTab();
}

// Show Filters
function showFilters() {
    const categories = [...new Set(AppState.products.map(p => p.category))];
    const brands = [...new Set(AppState.products.map(p => p.brand))];
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    modal.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <button class="modal-close" onclick="clearFilters(); this.closest('.modal-overlay').remove();">Сбросить</button>
                <div class="modal-title">Фильтры</div>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">Готово</button>
            </div>
            
            <div style="font-size: 13px; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 8px;">Категория</div>
            ${categories.map(cat => `
                <div class="card touchable" onclick="selectCategory('${cat}')">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${cat}</span>
                        ${AppState.selectedCategory === cat ? '<span style="color: var(--ios-blue);">✓</span>' : ''}
                    </div>
                </div>
            `).join('')}
            
            <div style="font-size: 13px; color: var(--text-tertiary); text-transform: uppercase; margin: 24px 0 8px;">Бренд</div>
            ${brands.map(brand => `
                <div class="card touchable" onclick="selectBrand('${brand}')">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${brand}</span>
                        ${AppState.selectedBrand === brand ? '<span style="color: var(--ios-blue);">✓</span>' : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    
    document.getElementById('modal-container').appendChild(modal);
}

function selectCategory(category) {
    AppState.selectedCategory = AppState.selectedCategory === category ? null : category;
    renderCurrentTab();
    document.querySelector('.modal-overlay').remove();
}

function selectBrand(brand) {
    AppState.selectedBrand = AppState.selectedBrand === brand ? null : brand;
    renderCurrentTab();
    document.querySelector('.modal-overlay').remove();
}

function clearFilters() {
    AppState.selectedCategory = null;
    AppState.selectedBrand = null;
    renderCurrentTab();
}

// Show Order Details
function showOrderDetails(orderId) {
    const order = AppState.orders.find(o => o.id === orderId);
    if (!order) return;
    
    const date = new Date(order.date);
    const formattedDate = date.toLocaleDateString('ru-RU', { 
        day: 'numeric',
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    modal.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div></div>
                <div class="modal-title">Детали заявки</div>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
            </div>
            
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="font-size: 24px; font-weight: 700; margin-bottom: 4px;">${order.venue}</div>
                <div style="font-size: 14px; color: var(--text-tertiary);">${formattedDate}</div>
            </div>
            
            <div style="font-size: 15px; font-weight: 600; margin-bottom: 12px;">Товары</div>
            ${order.items.map(item => {
                const totalPrice = item.product.price * item.quantity;
                const weight = parseFloat(item.product.weight) || 0;
                const totalWeight = weight * item.quantity;
                
                return `
                    <div class="card">
                        <div class="product-name">${item.product.brand} - ${item.product.name}</div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                            <div style="color: var(--text-secondary); font-size: 14px;">
                                ${item.quantity} шт. × ${Math.round(item.product.price)} ₽
                                ${totalWeight > 0 ? ` • ${Math.round(totalWeight)} гр` : ''}
                            </div>
                            <div style="font-weight: 600; color: var(--ios-blue);">${Math.round(totalPrice)} ₽</div>
                        </div>
                    </div>
                `;
            }).join('')}
            
            <div class="card" style="background: var(--bg-tertiary); margin-top: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span>Всего позиций:</span>
                    <span style="font-weight: 600;">${order.items.length}</span>
                </div>
                ${order.totalWeight > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span>Общий вес:</span>
                    <span style="font-weight: 600;">${Math.round(order.totalWeight)} гр</span>
                </div>` : ''}
                <div style="height: 1px; background: var(--ios-gray-light); margin: 12px 0;"></div>
                <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 700;">
                    <span>Итого:</span>
                    <span style="color: var(--ios-blue);">${Math.round(order.total)} ₽</span>
                </div>
            </div>
            
            <div style="font-size: 15px; font-weight: 600; margin: 24px 0 12px;">Текст заявки</div>
            <div class="card" style="background: var(--bg-tertiary); font-family: monospace; font-size: 13px; white-space: pre-wrap;">
${formatOrderForTelegram(order).replace(/<[^>]*>/g, '')}
            </div>
        </div>
    `;
    
    document.getElementById('modal-container').appendChild(modal);
}

function filterHistory(venue) {
    // This would filter the history view
    renderCurrentTab();
}

// Filter functions (moved here from app.js for organization)
function showFilters() {
    const categories = [...new Set(AppState.products.map(p => p.category))];
    const brands = [...new Set(AppState.products.map(p => p.brand))];
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    // Initialize selected filters if not exist
    if (!AppState.selectedCategories) AppState.selectedCategories = [];
    if (!AppState.selectedBrands) AppState.selectedBrands = [];
    
    modal.innerHTML = `
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
                <button class="modal-close" onclick="clearAllFilters(); this.closest('.modal-overlay').remove();">Сбросить</button>
                <div class="modal-title">Фильтры</div>
                <button class="modal-close" onclick="applyFilters(); this.closest('.modal-overlay').remove();">Готово</button>
            </div>
            
            <div style="font-size: 13px; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 8px;">Категории ${AppState.selectedCategories.length > 0 ? `(${AppState.selectedCategories.length})` : ''}</div>
            ${categories.map(cat => {
                const isSelected = AppState.selectedCategories.includes(cat);
                return `
                    <div class="card touchable" onclick="toggleCategoryFilter('${cat.replace(/'/g, "\\'")}'); updateFilterUI();" style="margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>${cat}</span>
                            <span class="checkmark-${cat.replace(/\s/g, '_')}" style="color: var(--ios-blue); font-size: 18px; font-weight: 600;">${isSelected ? '✓' : ''}</span>
                        </div>
                    </div>
                `;
            }).join('')}
            
            <div style="font-size: 13px; color: var(--text-tertiary); text-transform: uppercase; margin: 24px 0 8px;">Бренды ${AppState.selectedBrands.length > 0 ? `(${AppState.selectedBrands.length})` : ''}</div>
            ${brands.map(brand => {
                const isSelected = AppState.selectedBrands.includes(brand);
                return `
                    <div class="card touchable" onclick="toggleBrandFilter('${brand.replace(/'/g, "\\'")}'); updateFilterUI();" style="margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span>${brand}</span>
                            <span class="checkmark-brand-${brand.replace(/\s/g, '_')}" style="color: var(--ios-blue); font-size: 18px; font-weight: 600;">${isSelected ? '✓' : ''}</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    document.getElementById('modal-container').appendChild(modal);
}

function toggleCategoryFilter(category) {
    if (!AppState.selectedCategories) AppState.selectedCategories = [];
    
    const index = AppState.selectedCategories.indexOf(category);
    if (index > -1) {
        AppState.selectedCategories.splice(index, 1);
    } else {
        AppState.selectedCategories.push(category);
    }
}

function toggleBrandFilter(brand) {
    if (!AppState.selectedBrands) AppState.selectedBrands = [];
    
    const index = AppState.selectedBrands.indexOf(brand);
    if (index > -1) {
        AppState.selectedBrands.splice(index, 1);
    } else {
        AppState.selectedBrands.push(brand);
    }
}

function updateFilterUI() {
    // Update checkmarks in modal
    const categories = [...new Set(AppState.products.map(p => p.category))];
    const brands = [...new Set(AppState.products.map(p => p.brand))];
    
    categories.forEach(cat => {
        const elem = document.querySelector(`.checkmark-${cat.replace(/\s/g, '_')}`);
        if (elem) {
            elem.textContent = AppState.selectedCategories.includes(cat) ? '✓' : '';
        }
    });
    
    brands.forEach(brand => {
        const elem = document.querySelector(`.checkmark-brand-${brand.replace(/\s/g, '_')}`);
        if (elem) {
            elem.textContent = AppState.selectedBrands.includes(brand) ? '✓' : '';
        }
    });
}

function applyFilters() {
    // Clear cache when filters change
    AppState.filteredCache = null;
    saveToStorage();
    renderCurrentTab();
}

function clearAllFilters() {
    AppState.selectedCategories = [];
    AppState.selectedBrands = [];
    AppState.filteredCache = null;
    saveToStorage();
    renderCurrentTab();
}
