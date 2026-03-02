// Excel Parser using SheetJS (xlsx.js)
// Подключите библиотеку: <script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"></script>

async function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const products = [];
                
                // Parse all sheets
                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    let currentBrand = null;
                    
                    // Start from row 6 (after headers)
                    for (let i = 5; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        
                        // Column A: Brand + weight (e.g., "Bonche 120 гр маркированный")
                        // Column B: Flavor (e.g., "Barberry (Барбарис)")
                        // Column C: Price
                        
                        const brandText = row[0];
                        const flavor = row[1];
                        const price = parseFloat(row[2]);
                        
                        // Skip empty rows
                        if (!brandText && !flavor) continue;
                        
                        // If column B is empty, this is a brand header
                        if (brandText && !flavor) {
                            currentBrand = brandText;
                            continue;
                        }
                        
                        // If we have flavor and price, it's a product
                        if (flavor && price > 0 && currentBrand) {
                            // Parse brand info
                            const brandParts = currentBrand.split(' ');
                            let brand = brandParts[0] || 'Без бренда';
                            let weight = '';
                            let isMarked = currentBrand.toLowerCase().includes('маркированн');
                            
                            // Extract weight (e.g., "40 гр", "120 гр")
                            for (let j = 1; j < brandParts.length; j++) {
                                if (brandParts[j].match(/\d+/) && brandParts[j+1]?.includes('гр')) {
                                    weight = `${brandParts[j]} ${brandParts[j+1]}`;
                                    break;
                                }
                            }
                            
                            products.push({
                                id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                name: String(flavor),
                                brand: String(brand),
                                weight: weight || '0 гр',
                                category: sheetName,
                                price: price,
                                isMarked: isMarked,
                                groupId: currentBrand // For grouping in UI
                            });
                        }
                    }
                });
                
                resolve(products);
                
            } catch (error) {
                reject(new Error('Ошибка парсинга Excel файла: ' + error.message));
            }
        };
        
        reader.onerror = () => {
            reject(new Error('Ошибка чтения файла'));
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// Alternative: Parse from Blob (for Telegram downloads)
async function parseExcelBlob(blob) {
    return parseExcelFile(blob);
}

// Manual file upload for testing
function uploadExcelFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            showToast('Парсинг файла...');
            
            // Check if XLSX library is loaded
            if (typeof XLSX === 'undefined') {
                throw new Error('Библиотека XLSX не загружена. Проверьте интернет-соединение и перезагрузите страницу.');
            }
            
            const products = await parseExcelFile(file);
            
            if (products.length === 0) {
                throw new Error('В файле не найдено товаров. Проверьте структуру файла.');
            }
            
            AppState.products = products;
            AppState.expandedGroups = {}; // Reset expanded state
            saveToStorage();
            renderCurrentTab();
            showToast(`✓ Загружено ${products.length} товаров`);
            
            // Show success dialog
            setTimeout(() => {
                alert(`✅ Успешно загружено!\n\n${products.length} товаров из файла ${file.name}\n\nПерейдите в каталог чтобы увидеть товары.`);
            }, 500);
            
        } catch (error) {
            console.error('Upload error:', error);
            alert('Ошибка загрузки файла:\n\n' + error.message + '\n\nПопробуйте:\n1. Перезагрузить страницу\n2. Проверить интернет\n3. Использовать другой файл');
        }
    };
    
    input.click();
}
