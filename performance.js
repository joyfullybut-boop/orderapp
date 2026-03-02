// Performance Optimization Utilities

// Virtual scrolling for large lists
class VirtualScroller {
    constructor(container, items, renderItem, itemHeight = 100) {
        this.container = container;
        this.items = items;
        this.renderItem = renderItem;
        this.itemHeight = itemHeight;
        this.visibleStart = 0;
        this.visibleEnd = 0;
        
        this.init();
    }
    
    init() {
        const viewportHeight = window.innerHeight;
        const itemsToRender = Math.ceil(viewportHeight / this.itemHeight) + 5; // Buffer
        
        this.container.style.position = 'relative';
        this.container.style.height = `${this.items.length * this.itemHeight}px`;
        
        this.render(0, itemsToRender);
        
        // Add scroll listener
        const parent = this.container.parentElement;
        parent.addEventListener('scroll', () => this.onScroll());
    }
    
    onScroll() {
        const parent = this.container.parentElement;
        const scrollTop = parent.scrollTop;
        
        const start = Math.floor(scrollTop / this.itemHeight);
        const viewportHeight = parent.clientHeight;
        const end = start + Math.ceil(viewportHeight / this.itemHeight) + 5;
        
        if (start !== this.visibleStart || end !== this.visibleEnd) {
            this.render(start, end);
        }
    }
    
    render(start, end) {
        this.visibleStart = start;
        this.visibleEnd = Math.min(end, this.items.length);
        
        const fragment = document.createDocumentFragment();
        
        for (let i = this.visibleStart; i < this.visibleEnd; i++) {
            const item = this.items[i];
            const element = this.renderItem(item);
            element.style.position = 'absolute';
            element.style.top = `${i * this.itemHeight}px`;
            element.style.width = '100%';
            fragment.appendChild(element);
        }
        
        this.container.innerHTML = '';
        this.container.appendChild(fragment);
    }
}

// Request Animation Frame wrapper for smooth animations
function smoothScroll(element, targetY, duration = 300) {
    const startY = element.scrollTop;
    const distance = targetY - startY;
    const startTime = performance.now();
    
    function animation(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        element.scrollTop = startY + distance * easeProgress;
        
        if (progress < 1) {
            requestAnimationFrame(animation);
        }
    }
    
    requestAnimationFrame(animation);
}

// Throttle function for scroll events
function throttle(func, wait) {
    let timeout;
    let previous = 0;
    
    return function(...args) {
        const now = Date.now();
        const remaining = wait - (now - previous);
        
        if (remaining <= 0) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            func.apply(this, args);
        } else if (!timeout) {
            timeout = setTimeout(() => {
                previous = Date.now();
                timeout = null;
                func.apply(this, args);
            }, remaining);
        }
    };
}

// Lazy load images
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// Batch DOM updates
function batchDOMUpdates(updates) {
    requestAnimationFrame(() => {
        updates.forEach(update => update());
    });
}

// Memory efficient storage using IndexedDB
class IndexedDBStorage {
    constructor(dbName = 'OrderAppDB', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }
    
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('products')) {
                    db.createObjectStore('products', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('orders')) {
                    db.createObjectStore('orders', { keyPath: 'id' });
                }
            };
        });
    }
    
    async set(storeName, data) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    async get(storeName, key) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async getAll(storeName) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    async clear(storeName) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Initialize IndexedDB storage (optional, fallback to localStorage)
let idbStorage = null;

async function initIndexedDB() {
    try {
        idbStorage = new IndexedDBStorage();
        await idbStorage.init();
        console.log('IndexedDB initialized');
        return true;
    } catch (error) {
        console.warn('IndexedDB failed, using localStorage:', error);
        return false;
    }
}

// Try to init on load
if ('indexedDB' in window) {
    initIndexedDB();
}
