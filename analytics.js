// Advanced Analytics Module

// Render advanced analytics with all features
function renderAdvancedAnalytics(container) {
    const selectedVenue = AppState.analyticsVenueFilter || null;
    const filteredOrders = selectedVenue 
        ? AppState.orders.filter(o => o.venue === selectedVenue)
        : AppState.orders;
    
    if (filteredOrders.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-title">Нет данных</div></div>';
        return;
    }
    
    const totalSpent = filteredOrders.reduce((sum, order) => sum + order.total, 0);
    const totalWeight = filteredOrders.reduce((sum, order) => sum + order.totalWeight, 0);
    const pricePerGram = totalWeight > 0 ? totalSpent / totalWeight : 0;
    
    container.innerHTML = `
        <div style="display: flex; gap: 8px; margin-bottom: 16px;">
            <button class="btn ${!selectedVenue ? 'btn-primary' : 'btn-secondary'}" style="flex: 1;" onclick="AppState.analyticsVenueFilter=null;renderCurrentTab()">Все</button>
            <button class="btn ${selectedVenue === 'Мята' ? 'btn-primary' : 'btn-secondary'}" style="flex: 1;" onclick="AppState.analyticsVenueFilter='Мята';renderCurrentTab()">Мята</button>
            <button class="btn ${selectedVenue === 'Френдс' ? 'btn-primary' : 'btn-secondary'}" style="flex: 1;" onclick="AppState.analyticsVenueFilter='Френдс';renderCurrentTab()">Френдс</button>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div class="card" style="background: linear-gradient(135deg, #007AFF, #5856d6); color: white; text-align: center;">
                <div style="font-size: 13px; opacity: 0.9;">Всего</div>
                <div style="font-size: 24px; font-weight: 700;">${Math.round(totalSpent).toLocaleString()} ₽</div>
            </div>
            <div class="card" style="background: linear-gradient(135deg, #34C759, #30d158); color: white; text-align: center;">
                <div style="font-size: 13px; opacity: 0.9;">За грамм</div>
                <div style="font-size: 24px; font-weight: 700;">${pricePerGram.toFixed(1)} ₽/гр</div>
            </div>
        </div>
        
        <div class="card"><canvas id="chart1" style="max-height:200px"></canvas></div>
        <div class="card"><canvas id="chart2" style="max-height:200px"></canvas></div>
        <div class="card" id="topProducts"></div>
        <div id="monthlyDetails"></div>
    `;
    
    setTimeout(() => {
        if (typeof Chart !== 'undefined') {
            createCharts(filteredOrders);
        }
        showTopProducts(filteredOrders);
        showMonthlyDetails(filteredOrders);
    }, 100);
}

function createCharts(orders) {
    const monthly = {};
    orders.forEach(o => {
        const m = new Date(o.date).toLocaleDateString('ru', {month:'short', year:'2-digit'});
        monthly[m] = (monthly[m] || {t:0, w:0});
        monthly[m].t += o.total;
        monthly[m].w += o.totalWeight;
    });
    
    const labels = Object.keys(monthly);
    const totals = labels.map(k => Math.round(monthly[k].t));
    const perGram = labels.map(k => (monthly[k].w > 0 ? (monthly[k].t / monthly[k].w).toFixed(2) : 0));
    
    new Chart(document.getElementById('chart1'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Расходы, ₽',
                data: totals,
                backgroundColor: '#34C759'
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false }, title: { display: true, text: 'Расходы по месяцам' } }
        }
    });
    
    new Chart(document.getElementById('chart2'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: '₽/гр',
                data: perGram,
                borderColor: '#007AFF',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(0,122,255,0.1)'
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false }, title: { display: true, text: 'Цена за грамм' } }
        }
    });
}

function showTopProducts(orders) {
    const products = {};
    orders.forEach(o => {
        o.items.forEach(i => {
            const k = `${i.product.brand} ${i.product.weight} - ${i.product.name}`;
            products[k] = (products[k] || 0) + (i.product.price * i.quantity);
        });
    });
    
    const top = Object.entries(products).sort((a, b) => b[1] - a[1]).slice(0, 5);
    document.getElementById('topProducts').innerHTML = `
        <div style="font-weight:600; margin-bottom:12px">Топ товаров</div>
        ${top.map(([name, total], i) => `
            <div style="padding:8px 0; border-bottom:1px solid #eee; display:flex; justify-content:space-between">
                <span>${i+1}. ${name}</span>
                <span style="font-weight:600; color:#007AFF">${Math.round(total)} ₽</span>
            </div>
        `).join('')}
    `;
}

function showMonthlyDetails(orders) {
    const monthly = {};
    orders.forEach(o => {
        const m = new Date(o.date).toLocaleDateString('ru', {month:'long', year:'numeric'});
        monthly[m] = (monthly[m] || {t:0, w:0, c:0});
        monthly[m].t += o.total;
        monthly[m].w += o.totalWeight;
        monthly[m].c++;
    });
    
    document.getElementById('monthlyDetails').innerHTML = Object.entries(monthly).map(([month, d]) => `
        <div class="card">
            <div style="font-size:16px; font-weight:600; text-transform:capitalize; margin-bottom:8px">${month}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px">
                <div><div style="font-size:12px; color:#888">Заявок</div><div style="font-size:18px; font-weight:600">${d.c}</div></div>
                <div><div style="font-size:12px; color:#888">₽/гр</div><div style="font-size:18px; font-weight:600; color:#34C759">${(d.t/d.w).toFixed(1)}</div></div>
                <div style="text-align:right"><div style="font-size:12px; color:#888">Сумма</div><div style="font-size:18px; font-weight:600; color:#007AFF">${Math.round(d.t)} ₽</div></div>
            </div>
        </div>
    `).join('');
}
