// =========================================
// SERTAXI – Lógica do Painel do Passageiro
// =========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar autenticação
    const user = Auth.requireAuth('passenger');
    if (!user) return;

    // Inicializar dados do usuário no cabeçalho e sidebar
    document.getElementById('userName').textContent = user.name;
    document.getElementById('userAvatar').textContent = Utils.getInitials(user.name);
    document.getElementById('statRating').textContent = user.rating || '5.0';

    // 2. Elementos DOM
    const menuButtons = document.querySelectorAll('.sidebar-menu .menu-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileToggleBtn = document.getElementById('mobileToggleBtn');
    const sidebar = document.getElementById('sidebar');

    const newRideForm = document.getElementById('newRideForm');
    const rideOriginInput = document.getElementById('rideOrigin');
    const rideDestInput = document.getElementById('rideDestination');
    const btnCalculatePrice = document.getElementById('btnCalculatePrice');
    const rideEstimateBox = document.getElementById('rideEstimateBox');
    const estimatedPriceText = document.getElementById('estimatedPriceText');

    const profileForm = document.getElementById('profileForm');
    const profName = document.getElementById('profName');
    const profEmail = document.getElementById('profEmail');
    const profPhone = document.getElementById('profPhone');
    const profCpf = document.getElementById('profCpf');

    // Preencher formulário de perfil
    profName.value = user.name || '';
    profEmail.value = user.email || '';
    profPhone.value = user.phone || '';
    profCpf.value = user.cpf || '';
    Utils.applyMask(profPhone, Utils.phoneMask);

    // 3. Gerenciamento de Abas
    window.switchTab = function(tabId) {
        menuButtons.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        tabContents.forEach(content => {
            if (content.id === `tab-${tabId}`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        const titles = {
            'inicio': { title: 'Visão Geral', sub: 'Acompanhe suas corridas e status' },
            'nova-corrida': { title: 'Pedir Corrida', sub: 'Chame um motorista SerTaxi para sua viagem' },
            'minhas-corridas': { title: 'Histórico de Corridas', sub: 'Todas as viagens solicitadas por você' },
            'perfil': { title: 'Meu Perfil', sub: 'Gerencie suas informações de cadastro' }
        };

        if (titles[tabId]) {
            pageTitle.textContent = titles[tabId].title;
            pageSubtitle.textContent = titles[tabId].sub;
        }

        if (window.innerWidth <= 900) {
            sidebar.classList.remove('mobile-open');
        }

        renderDashboard();
    };

    menuButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    if (mobileToggleBtn) {
        mobileToggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
    }

    logoutBtn.addEventListener('click', () => {
        if (confirm('Tem certeza de que deseja sair?')) {
            Auth.logout();
        }
    });

    // 4. Calcular Preço
    function calculatePriceEstimate() {
        const origin = rideOriginInput.value.trim();
        const dest = rideDestInput.value.trim();

        if (!origin || !dest) {
            Utils.showToast('Por favor, digite o local de embarque e o destino.', 'error');
            return null;
        }

        const price = Utils.calculatePrice(origin, dest);
        estimatedPriceText.textContent = Utils.formatCurrency(price);
        rideEstimateBox.style.display = 'block';
        return price;
    }

    btnCalculatePrice.addEventListener('click', calculatePriceEstimate);

    // 5. Solicitar Corrida
    newRideForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const origin = rideOriginInput.value.trim();
        const dest = rideDestInput.value.trim();

        if (!origin || !dest) {
            Utils.showToast('Preencha os campos de origem e destino.', 'error');
            return;
        }

        const activeRide = Rides.getByPassenger(user.id).find(r => ['waiting', 'accepted', 'in_progress'].includes(r.status));
        if (activeRide) {
            Utils.showToast('Você já tem uma corrida em andamento. Aguarde a finalização.', 'error');
            switchTab('inicio');
            return;
        }

        const ride = Rides.create(user.id, user.name, origin, dest);
        Utils.showToast('Corrida solicitada com sucesso! Aguardando motorista...', 'success');

        newRideForm.reset();
        rideEstimateBox.style.display = 'none';

        switchTab('inicio');
    });

    // 6. Atualizar Perfil
    profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const updatedName = profName.value.trim();
        const updatedEmail = profEmail.value.trim();
        const updatedPhone = profPhone.value.trim();

        if (!Utils.isValidEmail(updatedEmail)) {
            Utils.showToast('E-mail inválido.', 'error');
            return;
        }

        const result = Auth.updateProfile(user.id, {
            name: updatedName,
            email: updatedEmail,
            phone: updatedPhone
        });

        if (result.success) {
            Utils.showToast('Perfil atualizado com sucesso!', 'success');
            document.getElementById('userName').textContent = updatedName;
            document.getElementById('userAvatar').textContent = Utils.getInitials(updatedName);
        } else {
            Utils.showToast(result.error || 'Erro ao atualizar dados.', 'error');
        }
    });

    // 7. Renderização e Atualizações periódicas
    function renderDashboard() {
        const rides = Rides.getByPassenger(user.id);
        document.getElementById('statTotalRides').textContent = rides.filter(r => r.status === 'completed').length;

        // Corrida ativa
        const activeRide = rides.find(r => ['waiting', 'accepted', 'in_progress'].includes(r.status));
        const activeRideContainer = document.getElementById('activeRideContainer');

        if (activeRide) {
            document.getElementById('statActiveRideStatus').textContent = Utils.statusLabel(activeRide.status);
            activeRideContainer.style.display = 'block';

            document.getElementById('activeRideOrigin').textContent = activeRide.origin;
            document.getElementById('activeRideDest').textContent = activeRide.destination;
            document.getElementById('activeRidePrice').textContent = Utils.formatCurrency(activeRide.price);

            const badge = document.getElementById('activeRideBadge');
            badge.className = `badge ${Utils.statusBadge(activeRide.status)}`;
            badge.textContent = Utils.statusLabel(activeRide.status);

            const statusText = document.getElementById('activeRideStatusText');
            const driverSection = document.getElementById('activeRideDriverSection');

            if (activeRide.status === 'waiting') {
                statusText.textContent = 'Procurando motoristas próximos...';
                driverSection.style.display = 'none';
            } else if (activeRide.status === 'accepted') {
                statusText.textContent = 'Motorista a caminho do local de embarque!';
                driverSection.style.display = 'block';
                document.getElementById('activeRideDriverName').textContent = activeRide.driverName || 'Motorista SerTaxi';
                document.getElementById('activeRideDriverCar').textContent = `${activeRide.driverCar || ''} (${activeRide.driverPlate || ''})`;
            } else if (activeRide.status === 'in_progress') {
                statusText.textContent = 'Viagem em andamento! Tenha um ótimo trajeto.';
                driverSection.style.display = 'block';
            }

            const cancelBtn = document.getElementById('cancelActiveRideBtn');
            if (activeRide.status === 'waiting') {
                cancelBtn.style.display = 'inline-block';
                cancelBtn.onclick = () => {
                    if (confirm('Deseja realmente cancelar esta solicitação?')) {
                        Rides.cancel(activeRide.id);
                        Utils.showToast('Corrida cancelada.', 'info');
                        renderDashboard();
                    }
                };
            } else {
                cancelBtn.style.display = 'none';
            }
        } else {
            document.getElementById('statActiveRideStatus').textContent = 'Nenhuma';
            activeRideContainer.style.display = 'none';
        }

        // Renderizar lista recente
        renderRidesList(rides.slice(0, 3), 'recentRidesList');

        // Renderizar lista completa (com filtros)
        const activeFilter = document.querySelector('.filter-tab.active')?.getAttribute('data-filter') || 'all';
        let filtered = rides;
        if (activeFilter === 'active') {
            filtered = rides.filter(r => ['waiting', 'accepted', 'in_progress'].includes(r.status));
        } else if (activeFilter === 'completed') {
            filtered = rides.filter(r => r.status === 'completed');
        }
        renderRidesList(filtered, 'allRidesList');
    }

    function renderRidesList(list, elementId) {
        const container = document.getElementById(elementId);
        if (!container) return;

        if (list.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🚖</div>
                    <h3>Nenhuma corrida encontrada</h3>
                    <p>Quando você pedir uma corrida, ela aparecerá detalhada nesta lista.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(ride => `
            <div class="ride-card">
                <div class="ride-card-top">
                    <span class="badge ${Utils.statusBadge(ride.status)}">${Utils.statusLabel(ride.status)}</span>
                    <span class="text-xs text-muted">${Utils.timeAgo(ride.createdAt)}</span>
                </div>
                <div class="ride-route">
                    <div class="route-item">
                        <span class="route-badge origem">A</span>
                        <span><strong>Embarque:</strong> ${ride.origin}</span>
                    </div>
                    <div class="route-item">
                        <span class="route-badge destino">B</span>
                        <span><strong>Destino:</strong> ${ride.destination}</span>
                    </div>
                </div>
                <div class="ride-card-bottom">
                    <div>
                        <span class="text-xs text-muted">Total: </span>
                        <span class="ride-price">${Utils.formatCurrency(ride.price)}</span>
                    </div>
                    ${ride.driverName ? `
                        <div class="text-sm">
                            👨‍✈️ <strong>${ride.driverName}</strong> · <span class="text-muted">${ride.driverCar || ''}</span>
                        </div>
                    ` : `
                        <div class="text-xs text-muted">Aguardando motorista</div>
                    `}
                </div>
            </div>
        `).join('');
    }

    // Filtros de histórico
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderDashboard();
        });
    });

    // Loop de auto-atualização para acompanhar o motorista aceitando a corrida em tempo real
    renderDashboard();
    setInterval(renderDashboard, 3000);
});
