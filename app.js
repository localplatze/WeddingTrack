const firebaseConfig = {
  apiKey: "AIzaSyCyNun_qwKh9h0J7vUHFegljoQVu-coxEg",
  authDomain: "otica-prime.firebaseapp.com",
  databaseURL: "https://otica-prime-default-rtdb.firebaseio.com",
  projectId: "otica-prime",
  storageBucket: "otica-prime.firebasestorage.app",
  messagingSenderId: "1051940639563",
  appId: "1:1051940639563:web:81a4a89fc856f8b73a0ece",
  measurementId: "G-4YNVJEQN8J"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const expensesRef = database.ref('weddingExpenses/items');

// Elementos do DOM - Formulário e Dialog
const expenseForm = document.getElementById('expenseForm');
const itemNameInput = document.getElementById('itemName');
const itemCategoryInput = document.getElementById('itemCategory');
const categorySuggestionsDatalist = document.getElementById('categorySuggestions');
const estimatedPriceInput = document.getElementById('estimatedPrice');
const actualPriceInput = document.getElementById('actualPrice');
const itemNotesInput = document.getElementById('itemNotes');
const expenseIdInput = document.getElementById('expenseId');
const addVendorBtn = document.getElementById('addVendorBtn');
const vendorsContainer = document.getElementById('vendorsContainer');
const addPaymentBtn = document.getElementById('addPaymentBtn');
const paymentScheduleContainer = document.getElementById('paymentScheduleContainer');
const clearFormBtn = document.getElementById('clearFormBtn');
const openExpenseModalBtn = document.getElementById('openExpenseModalBtn');
const expenseDialog = document.getElementById('expenseDialog');
const cancelFormBtn = document.getElementById('cancelFormBtn');

// Elementos do DOM - Lista de Despesas e Filtro
const expensesListDiv = document.getElementById('expensesList');
const categoryFilterSelect = document.getElementById('categoryFilter');

// Elementos do DOM - Resumo Global
const totalEstimatedEl = document.getElementById('totalEstimated');
const totalActualEl = document.getElementById('totalActual');
const totalPaidEl = document.getElementById('totalPaid');
const totalRemainingEl = document.getElementById('totalRemaining');

// Elementos do DOM - Abas
const tabsNav = document.querySelector('.tabs-nav');
const tabPanes = document.querySelectorAll('.tab-pane');

// Elementos do DOM - Aba Calendário/Pagamentos
const filterStartDateInput = document.getElementById('filterStartDate');
const filterEndDateInput = document.getElementById('filterEndDate');
const paymentStatusFilterSelect = document.getElementById('paymentStatusFilter');
const applyDateFilterBtn = document.getElementById('applyDateFilterBtn');
const upcomingPaymentsListDiv = document.getElementById('upcomingPaymentsList');
const upcomingPaymentsTotalEl = document.getElementById('upcomingPaymentsTotal');

// Elementos do DOM - Aba Gráficos
const categoryChartCanvas = document.getElementById('categoryChart').getContext('2d'); // Importante pegar o contexto 2d
const paymentStatusChartCanvas = document.getElementById('paymentStatusChart').getContext('2d');
const paymentsOverTimeChartCanvas = document.getElementById('paymentsOverTimeChart').getContext('2d');

// Variáveis Globais
let vendorCount = 0;
let paymentCount = 0;
let allExpensesData = {};
let categoryChartInstance, paymentStatusChartInstance, paymentsOverTimeChartInstance;

// --- CONTROLE DO DIALOG ---
openExpenseModalBtn.addEventListener('click', () => {
    resetForm();
    expenseDialog.showModal();
});
cancelFormBtn.addEventListener('click', () => {
    expenseDialog.close();
    resetForm();
});
expenseDialog.addEventListener('click', (event) => {
    if (event.target === expenseDialog) {
        expenseDialog.close();
        resetForm();
    }
});

// --- CONTROLE DAS ABAS ---
tabsNav.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-button')) {
        const targetTab = e.target.dataset.tab;
        tabsNav.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === `${targetTab}Tab`);
        });
        if (targetTab === 'charts' && Object.keys(allExpensesData).length > 0) renderAllCharts();
        else if (targetTab === 'calendar' && Object.keys(allExpensesData).length > 0) renderUpcomingPayments();
    }
});

// --- CARREGAMENTO E PROCESSAMENTO PRINCIPAL DE DADOS ---
expensesRef.on('value', (snapshot) => {
    allExpensesData = {};
    let totalEstimated = 0, totalActual = 0, totalPaidGlobally = 0;
    const categories = new Set();

    if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
            const expense = childSnapshot.val();
            const expenseKey = childSnapshot.key;
            allExpensesData[expenseKey] = { ...expense, id: expenseKey };
            if (expense.category) categories.add(expense.category.trim());
            totalEstimated += expense.estimatedPrice || 0;
            totalActual += expense.actualPrice || expense.estimatedPrice || 0;
            totalPaidGlobally += expense.amountPaid || 0;
        });
    }
    populateCategoryFilter(categories);
    applyCategoryFilter(); // Renderiza lista de despesas com filtro
    updateSummary(totalEstimated, totalActual, totalPaidGlobally);

    // Atualiza abas ativas se houver dados
    if (Object.keys(allExpensesData).length > 0) {
        if (document.getElementById('chartsTab').classList.contains('active')) renderAllCharts();
        if (document.getElementById('calendarTab').classList.contains('active')) renderUpcomingPayments();
    } else { // Limpa se não houver dados
        expensesListDiv.innerHTML = '<p>Nenhuma despesa cadastrada ainda.</p>';
        upcomingPaymentsListDiv.innerHTML = '<p>Nenhum pagamento para exibir.</p>';
        upcomingPaymentsTotalEl.textContent = 'Total no Período: R$ 0,00';
        // Poderia limpar gráficos também
    }
});

// --- FILTRO DE CATEGORIA NA LISTA DE DESPESAS ---
function populateCategoryFilter(categoriesSet) {
    const currentCategoryValue = categoryFilterSelect.value;
    while (categoryFilterSelect.options.length > 1) categoryFilterSelect.remove(1);
    categorySuggestionsDatalist.innerHTML = '';
    const sortedCategories = Array.from(categoriesSet).sort((a,b) => a.localeCompare(b));
    sortedCategories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilterSelect.appendChild(option.cloneNode(true));
        categorySuggestionsDatalist.appendChild(option);
    });
    // Tenta manter o filtro selecionado anteriormente, se ainda existir
    if (Array.from(categoryFilterSelect.options).some(opt => opt.value === currentCategoryValue)) {
        categoryFilterSelect.value = currentCategoryValue;
    } else {
        categoryFilterSelect.value = "all"; // Default para "all" se a categoria sumiu
    }
}
categoryFilterSelect.addEventListener('change', applyCategoryFilter);

function applyCategoryFilter() {
    const selectedCategory = categoryFilterSelect.value;
    expensesListDiv.innerHTML = '';
    let count = 0;
    Object.values(allExpensesData)
        .sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0)) // Ordena por data de criação
        .forEach(expense => {
        if (selectedCategory === 'all' || expense.category === selectedCategory) {
            displayExpense(expense, expense.id);
            count++;
        }
    });
    if (count === 0 && Object.keys(allExpensesData).length > 0) {
        expensesListDiv.innerHTML = `<p>Nenhuma despesa encontrada para a categoria "${selectedCategory}".</p>`;
    } else if (Object.keys(allExpensesData).length === 0) {
        expensesListDiv.innerHTML = '<p>Nenhuma despesa cadastrada ainda.</p>';
    }
}

// --- DISPLAY DE DESPESAS (COM COLAPSO) ---
function displayExpense(expense, key) {
    const itemDiv = document.createElement('div');
    itemDiv.classList.add('expense-item');
    itemDiv.dataset.id = key;
    const finalPrice = expense.actualPrice || expense.estimatedPrice;
    const percentagePaid = finalPrice > 0 ? (expense.amountPaid / finalPrice) * 100 : 0;

    let vendorsHTML = '<h4>Fornecedores:</h4><ul>';
    if (expense.vendors && expense.vendors.length > 0) {
        expense.vendors.forEach(v => {
            vendorsHTML += `<li class="vendor-item"><strong>${v.name}</strong> ${v.contact ? `- ${v.contact}` : ''} <em>${v.notes || ''}</em></li>`;
        });
    } else { vendorsHTML += '<li>Nenhum fornecedor listado.</li>'; }
    vendorsHTML += '</ul>';

    let paymentsHTML = '<h4>Cronograma de Pagamentos:</h4><ul>';
    if (expense.paymentSchedule && expense.paymentSchedule.length > 0) {
        expense.paymentSchedule.forEach((p, index) => {
            paymentsHTML += `
                <li class="payment-item ${p.status === 'pago' ? 'paid' : ''}">
                    ${p.description}: R$ ${p.amount.toFixed(2)} (Venc: ${formatDate(p.dueDate)}) - Status: ${p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    <button class="payment-status-toggle ${p.status}" onclick="togglePaymentStatus('${key}', ${index})">
                        ${p.status === 'pago' ? 'Marcar Pendente' : 'Marcar Pago'}
                    </button>
                </li>`;
        });
    } else { paymentsHTML += '<li>Nenhum pagamento agendado.</li>'; }
    paymentsHTML += '</ul>';

    itemDiv.innerHTML = `
        <div class="expense-summary">
            <h3>
                ${expense.name}
                ${expense.category ? `<span class="category">${expense.category}</span>` : ''}
            </h3>
            <div class="price-info">
                Estimado: <strong>R$ ${expense.estimatedPrice.toFixed(2)}</strong> |
                Real: <strong>R$ ${(expense.actualPrice || expense.estimatedPrice).toFixed(2)}</strong>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${percentagePaid.toFixed(2)}%;">
                    ${percentagePaid.toFixed(0)}% Pago (R$ ${expense.amountPaid.toFixed(2)})
                </div>
            </div>
            <button class="toggle-details-btn" aria-expanded="false" aria-controls="details-${key}">
                Mostrar Detalhes
            </button>
        </div>
        <div class="expense-details" id="details-${key}">
            <div class="details-section">
                ${vendorsHTML}
                ${paymentsHTML}
                ${expense.notes ? `<p><strong>Obs:</strong> ${expense.notes}</p>` : ''}
            </div>
        </div>
        <div class="item-actions">
            <button class="edit-btn" onclick="editExpense('${key}')">Editar</button>
            <button class="delete-btn" onclick="deleteExpense('${key}')">Excluir</button>
        </div>`;
    expensesListDiv.appendChild(itemDiv);
    const toggleButton = itemDiv.querySelector('.toggle-details-btn');
    toggleButton.addEventListener('click', () => {
        const isExpanded = itemDiv.classList.toggle('expanded');
        toggleButton.setAttribute('aria-expanded', isExpanded);
        toggleButton.textContent = isExpanded ? 'Ocultar Detalhes' : 'Mostrar Detalhes';
    });
}

// --- ABA CALENDÁRIO/PAGAMENTOS FUTUROS ---
applyDateFilterBtn.addEventListener('click', renderUpcomingPayments);
paymentStatusFilterSelect.addEventListener('change', renderUpcomingPayments);
filterStartDateInput.addEventListener('change', renderUpcomingPayments);
filterEndDateInput.addEventListener('change', renderUpcomingPayments);

function renderUpcomingPayments() {
    const startDateStr = filterStartDateInput.value;
    const endDateStr = filterEndDateInput.value;
    const statusFilter = paymentStatusFilterSelect.value;
    let paymentsToDisplay = [];
    let totalInPeriod = 0;

    Object.values(allExpensesData).forEach(expense => {
        if (expense.paymentSchedule) {
            expense.paymentSchedule.forEach(payment => {
                if (!payment.dueDate || !payment.amount) return;
                let include = true;
                if (statusFilter !== 'all' && payment.status !== statusFilter) include = false;
                const paymentDate = new Date(payment.dueDate + 'T00:00:00Z'); // Usar Z para UTC e evitar problemas de fuso na comparação
                if (startDateStr) {
                    const filterStart = new Date(startDateStr + 'T00:00:00Z');
                    if (paymentDate < filterStart) include = false;
                }
                if (endDateStr) {
                    const filterEnd = new Date(endDateStr + 'T00:00:00Z');
                    if (paymentDate > filterEnd) include = false;
                }
                if (include) {
                    paymentsToDisplay.push({ expenseName: expense.name, ...payment });
                    totalInPeriod += payment.amount; // Soma todos que passam no filtro de data, independente do status para "Total no Período"
                }
            });
        }
    });
    paymentsToDisplay.sort((a, b) => new Date(a.dueDate + 'T00:00:00Z') - new Date(b.dueDate + 'T00:00:00Z'));
    upcomingPaymentsListDiv.innerHTML = '';
    if (paymentsToDisplay.length > 0) {
        paymentsToDisplay.forEach(p => {
            const entryDiv = document.createElement('div');
            entryDiv.classList.add('payment-entry');
            entryDiv.innerHTML = `
                <h4>${p.expenseName} - ${p.description}</h4>
                <p>Valor: <strong>R$ ${p.amount.toFixed(2)}</strong></p>
                <p>Vencimento: ${formatDate(p.dueDate)}</p>
                <p>Status: <span class="status-${p.status}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span></p>`;
            upcomingPaymentsListDiv.appendChild(entryDiv);
        });
    } else {
        upcomingPaymentsListDiv.innerHTML = '<p>Nenhum pagamento encontrado para o período/status selecionado.</p>';
    }
    upcomingPaymentsTotalEl.textContent = `Total no Período: R$ ${totalInPeriod.toFixed(2)}`;
}

// --- ABA GRÁFICOS (CHART.JS) ---
function renderAllCharts() {
    if (Object.keys(allExpensesData).length === 0) {
        // Limpar canvases ou mostrar mensagem se não houver dados
        if (categoryChartInstance) categoryChartInstance.destroy();
        if (paymentStatusChartInstance) paymentStatusChartInstance.destroy();
        if (paymentsOverTimeChartInstance) paymentsOverTimeChartInstance.destroy();
        // Poderia adicionar <p> tags dentro dos .chart-container com "Sem dados para exibir"
        return;
    }
    renderCategoryChart();
    renderPaymentStatusChart();
    renderPaymentsOverTimeChart();
}

function renderCategoryChart() {
    const categoriesData = {};
    Object.values(allExpensesData).forEach(expense => {
        const category = expense.category || 'Sem Categoria';
        const price = expense.actualPrice || expense.estimatedPrice || 0;
        categoriesData[category] = (categoriesData[category] || 0) + price;
    });
    const labels = Object.keys(categoriesData);
    const data = Object.values(categoriesData);
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(categoryChartCanvas, {
        type: 'pie',
        data: { labels: labels, datasets: [{ label: 'Gasto por Categoria', data: data, backgroundColor: getRandomColors(labels.length) }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }}}
    });
}

function renderPaymentStatusChart() {
    let totalPaid = 0, totalPending = 0;
    Object.values(allExpensesData).forEach(expense => {
        if (expense.paymentSchedule) {
            expense.paymentSchedule.forEach(payment => {
                if (payment.status === 'pago') totalPaid += payment.amount;
                else if (payment.status === 'pendente') totalPending += payment.amount;
            });
        }
    });
    if (paymentStatusChartInstance) paymentStatusChartInstance.destroy();
    paymentStatusChartInstance = new Chart(paymentStatusChartCanvas, {
        type: 'bar',
        data: { labels: ['Pago', 'Pendente'], datasets: [{ label: 'Status de Pagamento (R$)', data: [totalPaid, totalPending], backgroundColor: ['#27ae60', '#f39c12'] }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false }}}
    });
}

function renderPaymentsOverTimeChart() {
    const paymentsByMonth = {};
    Object.values(allExpensesData).forEach(expense => {
        if (expense.paymentSchedule) {
            expense.paymentSchedule.forEach(payment => {
                if (payment.status === 'pago' && payment.dueDate) {
                    const monthYear = payment.dueDate.substring(0, 7);
                    paymentsByMonth[monthYear] = (paymentsByMonth[monthYear] || 0) + payment.amount;
                }
            });
        }
    });
    const sortedMonths = Object.keys(paymentsByMonth).sort();
    const labels = sortedMonths.map(my => { const [year, month] = my.split('-'); return `${month}/${year.slice(-2)}`; });
    const data = sortedMonths.map(my => paymentsByMonth[my]);
    if (paymentsOverTimeChartInstance) paymentsOverTimeChartInstance.destroy();
    paymentsOverTimeChartInstance = new Chart(paymentsOverTimeChartCanvas, {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Pagamentos Realizados por Mês (R$)', data: data, borderColor: '#3498db', backgroundColor: 'rgba(52, 152, 219, 0.1)', fill: true, tension: 0.1 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'top' }}}
    });
}

function getRandomColors(count) {
    const colors = ['#3498db', '#2ecc71', '#e74c3c', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#7f8c8d', '#27ae60'];
    // Se precisar de mais cores do que o array, gera aleatórias
    if (count > colors.length) {
        for (let i = colors.length; i < count; i++) {
            colors.push(`hsl(${Math.random() * 360}, 70%, 60%)`);
        }
    }
    return colors.slice(0, count);
}

// --- FUNÇÕES DE CRUD, FORMULÁRIO DINÂMICO E UTILITÁRIAS ---
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}
function createVendorInputGroup(vendor = {}) {
    vendorCount++;
    const div = document.createElement('div');
    div.classList.add('dynamic-input-group', 'vendor-group');
    div.innerHTML = `
        <label for="vendorName${vendorCount}">Nome:</label>
        <input type="text" id="vendorName${vendorCount}" value="${vendor.name || ''}" placeholder="Nome Fornecedor">
        <label for="vendorContact${vendorCount}">Contato:</label>
        <input type="text" id="vendorContact${vendorCount}" value="${vendor.contact || ''}" placeholder="Telefone/Email">
        <label for="vendorNotes${vendorCount}">Obs.:</label>
        <textarea id="vendorNotes${vendorCount}" rows="2">${vendor.notes || ''}</textarea>
        <button type="button" class="remove-btn" onclick="this.parentElement.remove()">X</button>`;
    vendorsContainer.insertBefore(div, addVendorBtn);
}
function createPaymentInputGroup(payment = {}) {
    paymentCount++;
    const div = document.createElement('div');
    div.classList.add('dynamic-input-group', 'payment-group');
    div.innerHTML = `
        <label for="paymentDesc${paymentCount}">Descrição:</label>
        <input type="text" id="paymentDesc${paymentCount}" value="${payment.description || ''}" placeholder="Ex: Entrada">
        <label for="paymentDueDate${paymentCount}">Venc.:</label>
        <input type="date" id="paymentDueDate${paymentCount}" value="${payment.dueDate || ''}">
        <label for="paymentAmount${paymentCount}">Valor:</label>
        <input type="number" id="paymentAmount${paymentCount}" step="0.01" value="${payment.amount || ''}">
        <label for="paymentStatus${paymentCount}">Status:</label>
        <select id="paymentStatus${paymentCount}">
            <option value="pendente" ${payment.status === 'pendente' ? 'selected' : ''}>Pendente</option>
            <option value="pago" ${payment.status === 'pago' ? 'selected' : ''}>Pago</option>
        </select>
        <button type="button" class="remove-btn" onclick="this.parentElement.remove()">X</button>`;
    paymentScheduleContainer.insertBefore(div, addPaymentBtn);
}
addVendorBtn.addEventListener('click', () => createVendorInputGroup());
addPaymentBtn.addEventListener('click', () => createPaymentInputGroup());

expenseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = itemNameInput.value;
    const category = itemCategoryInput.value.trim();
    const estimatedPrice = parseFloat(estimatedPriceInput.value) || 0;
    const actualPrice = parseFloat(actualPriceInput.value) || 0;
    const notes = itemNotesInput.value;
    const id = expenseIdInput.value;
    const vendors = Array.from(document.querySelectorAll('.vendor-group')).map(g => ({ name: g.querySelector('[id^="vendorName"]').value, contact: g.querySelector('[id^="vendorContact"]').value, notes: g.querySelector('[id^="vendorNotes"]').value })).filter(v => v.name);
    const paymentSchedule = Array.from(document.querySelectorAll('.payment-group')).map(g => ({ description: g.querySelector('[id^="paymentDesc"]').value, dueDate: g.querySelector('[id^="paymentDueDate"]').value, amount: parseFloat(g.querySelector('[id^="paymentAmount"]').value) || 0, status: g.querySelector('[id^="paymentStatus"]').value })).filter(p => p.description && p.amount > 0);
    const amountPaid = paymentSchedule.reduce((sum, p) => (p.status === 'pago' ? sum + p.amount : sum), 0);
    const expenseData = { name, category, estimatedPrice, actualPrice: actualPrice || estimatedPrice, amountPaid, vendors, paymentSchedule, notes, createdAt: id ? allExpensesData[id].createdAt : firebase.database.ServerValue.TIMESTAMP, updatedAt: firebase.database.ServerValue.TIMESTAMP };

    if (id) expensesRef.child(id).update(expenseData).catch(err => console.error("Update Error:", err));
    else expensesRef.push(expenseData).catch(err => console.error("Push Error:", err));
    expenseDialog.close(); resetForm();
});
clearFormBtn.addEventListener('click', () => {
    const idToKeep = expenseIdInput.value; expenseForm.reset(); expenseIdInput.value = idToKeep;
    document.querySelectorAll('.vendor-group, .payment-group').forEach(el => el.remove());
    vendorCount = 0; paymentCount = 0; itemNameInput.focus();
});
function resetForm() {
    expenseForm.reset(); expenseIdInput.value = ''; clearFormBtn.style.display = 'none';
    document.querySelectorAll('.vendor-group, .payment-group').forEach(el => el.remove());
    vendorCount = 0; paymentCount = 0; itemNameInput.focus();
}
window.editExpense = (key) => {
    const expense = allExpensesData[key]; if (!expense) return;
    expenseIdInput.value = key; itemNameInput.value = expense.name; itemCategoryInput.value = expense.category || '';
    estimatedPriceInput.value = expense.estimatedPrice; actualPriceInput.value = expense.actualPrice || ''; itemNotesInput.value = expense.notes || '';
    document.querySelectorAll('.vendor-group, .payment-group').forEach(el => el.remove());
    vendorCount = 0; paymentCount = 0;
    if (expense.vendors) expense.vendors.forEach(v => createVendorInputGroup(v));
    if (expense.paymentSchedule) expense.paymentSchedule.forEach(p => createPaymentInputGroup(p));
    clearFormBtn.style.display = 'inline-block'; expenseDialog.showModal(); itemNameInput.focus();
};
window.deleteExpense = (key) => {
    if (confirm('Tem certeza que deseja excluir esta despesa?')) {
        expensesRef.child(key).remove().catch(err => console.error("Delete Error:", err));
    }
};
window.togglePaymentStatus = (expenseKey, paymentIndex) => {
    const paymentRef = expensesRef.child(expenseKey).child('paymentSchedule').child(paymentIndex);
    paymentRef.once('value', (snapshot) => {
        const payment = snapshot.val(); if (!payment) return;
        const newStatus = payment.status === 'pago' ? 'pendente' : 'pago';
        paymentRef.child('status').set(newStatus)
            .then(() => expensesRef.child(expenseKey).once('value'))
            .then((expenseSnapshot) => {
                const expenseData = expenseSnapshot.val(); if (!expenseData || !expenseData.paymentSchedule) return;
                const newAmountPaid = expenseData.paymentSchedule.reduce((s, p) => (p.status === 'pago' ? s + p.amount : s), 0);
                return expensesRef.child(expenseKey).child('amountPaid').set(newAmountPaid);
            }).catch(err => console.error("Toggle Status Error:", err));
    });
};
function updateSummary(estimated, actual, paid) {
    totalEstimatedEl.textContent = `R$ ${estimated.toFixed(2)}`;
    totalActualEl.textContent = `R$ ${actual.toFixed(2)}`;
    totalPaidEl.textContent = `R$ ${paid.toFixed(2)}`;
    totalRemainingEl.textContent = `R$ ${(actual - paid).toFixed(2)}`;
}

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    tabsNav.querySelector('.tab-button[data-tab="expenses"]').click(); // Ativa a primeira aba
    // Opcional: Configurar datas padrão para o filtro de calendário
    // const today = new Date();
    // const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    // const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    // filterStartDateInput.value = firstDayOfMonth;
    // filterEndDateInput.value = lastDayOfMonth;
});