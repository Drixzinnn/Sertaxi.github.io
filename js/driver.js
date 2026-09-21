// =========================================
// SERTAXI – Lógica do Painel do Motorista
// =========================================

document.addEventListener('DOMContentLoaded', () => {
    const user = Auth.requireAuth('driver');
    if (!user) return;

    // Atualizar perfil do motorista na tela
    document.getElementById('driverName').textContent = user.name;
    document.getElementById('driverAvatar').textContent = Utils.getInitials(user.name);
    document.getElementById('statDriverRating').textContent = user.rating || '4.9';

    // Elementos DOM
    const menuButtons = document.querySelectorAll('.sidebar-menu .menu-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileToggleBtn = document.getElementById('mobileToggleBtn');
    const sidebar = document.getElementById('sidebar');

    const onlineCheckbox = document.getElementById('onlineCheckbox');
    const driverStatusDot = document.getElementById('driverStatusDot');
    const driverStatusLabel = document.getElementById('driverStatusLabel');
    const driverStatusBadge = document.getElementById('driverStatusBadge');
    const offlineNotice = document.getElementById('offlineNotice');
    const availableRidesContainer = document.getElementById('availableRidesContainer');

    // Inicializar estado Online/Offline
    let isOnline = user.online !== false;
    onlineCheckbox.checked = isOnline;
    updateOnlineUI(isOnline);

    window.setDriverOnline = function(status) {
        onlineCheckbox.checked = status;
        handleOnlineToggle(status);
    };

    function handleOnlineToggle(status) {
        isOnline = status;
        Auth.updateStats(user.id, { online: isOnline });
        updateOnlineUI(isOnline);
        Utils.showToast(isOnline ? 'Você está ONLINE para corridas!' : 'Você está OFFLINE.', isOnline ? 'success' : 'info');
        renderDriverDashboard();
    }

    onlineCheckbox.addEventListener('change', (e) => {
        handleOnlineToggle(e.target.checked);
    });

    function updateOnlineUI(online) {
        if (online) {
            driverStatusDot.className = 'status-dot online';
            driverStatusLabel.textContent = 'Online';
            driverStatusBadge.className = 'badge badge-success';
            driverStatusBadge.textContent = 'Disponível para corridas';
            offlineNotice.style.display = 'none';
            availableRidesContainer.style.display = 'block';
        } else {
            driverStatusDot.className = 'status-dot offline';
            driverStatusLabel.textContent = 'Offline';
            driverStatusBadge.className = 'badge badge-neutral';
            driverStatusBadge.textContent = 'Indisponível (Offline)';
            offlineNotice.style.display = 'block';
            availableRidesContainer.style.display = 'none';
        }
    }

    // Formulário de Perfil do Motorista
    const drvName = document.getElementById('drvName');
    const drvEmail = document.getElementById('drvEmail');
    const drvPhone = document.getElementById('drvPhone');
    const drvCpf = document.getElementById('drvCpf');
    const drvCarModel = document.getElementById('drvCarModel');
    const drvCarPlate = document.getElementById('drvCarPlate');
    const drvCarColor = document.getElementById('drvCarColor');

    drvName.value = user.name || '';
    drvEmail.value = user.email || '';
    drvPhone.value = user.phone || '';
    drvCpf.value = user.cpf || '';
    drvCarModel.value = user.carModel || '';
    drvCarPlate.value = user.carPlate || '';
    drvCarColor.value = user.carColor || '';

    Utils.applyMask(drvPhone, Utils.phoneMask);
    Utils.applyMask(drvCarPlate, Utils.plateMask);

    document.getElementById('driverProfileForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const updated = {
            name: drvName.value.trim(),
            email: drvEmail.value.trim(),
            phone: drvPhone.value.trim(),
            carModel: drvCarModel.value.trim(),
            carPlate: drvCarPlate.value.trim(),
            carColor: drvCarColor.value.trim()
        };

        if (!Utils.isValidEmail(updated.email)) {
            Utils.showToast('E-mail inválido.', 'error');
            return;
        }

        const res = Auth.updateProfile(user.id, updated);
        if (res.success) {
            Utils.showToast('Perfil e veículo atualizados com sucesso!', 'success');
            document.getElementById('driverName').textContent = updated.name;
            document.getElementById('driverAvatar').textContent = Utils.getInitials(updated.name);
        } else {
            Utils.showToast(res.error || 'Erro ao salvar.', 'error');
        }
    });

    // Abas
    window.switchTab = function(tabId) {
        menuButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });

        tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabId}`);
        });

        const titles = {
            'inicio': { title: 'Painel do Motorista', sub: 'Visão geral das suas atividades' },
            'disponiveis': { title: 'Corridas Disponíveis', sub: 'Aceite chamados de passageiros próximos' },
            'minhas-corridas': { title: 'Minhas Viagens', sub: 'Histórico de serviços prestados' },
            'ganhos': { title: 'Meus Ganhos', sub: 'Acompanhe seu faturamento financeiro' },
            'perfil': { title: 'Meu Perfil', sub: 'Informações do motorista e veículo' }
        };

        if (titles[tabId]) {
            pageTitle.textContent = titles[tabId].title;
            pageSubtitle.textContent = titles[tabId].sub;
        }

        if (window.innerWidth <= 900) {
            sidebar.classList.remove('mobile-open');
        }

        renderDriverDashboard();
    };

    menuButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.getAttribute('data-tab'));
        });
    });

    if (mobileToggleBtn) {
        mobileToggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
        });
    }

    logoutBtn.addEventListener('click', () => {
        if (confirm('Deseja realmente sair?')) {
            Auth.logout();
        }
    });

    // Ações de Corrida (Aceitar, Iniciar, Finalizar)
    window.acceptRide = function(rideId) {
        const res = Rides.accept(rideId, user.id, user.name, user.carModel, user.carPlate);
        if (res.success) {
            Utils.showToast('Corrida aceita! Dirija-se ao local de embarque.', 'success');
            switchTab('inicio');
        } else {
            Utils.showToast(res.error || 'Não foi possível aceitar esta corrida.', 'error');
            renderDriverDashboard();
        }
    };

    window.startRide = function(rideId) {
        const res = Rides.start(rideId);
        if (res.success) {
            Utils.showToast('Corrida iniciada! Boa viagem!', 'info');
            renderDriverDashboard();
        } else {
            Utils.showToast(res.error || 'Erro ao iniciar.', 'error');
        }
    };

    window.completeRide = function(rideId) {
        const res = Rides.complete(rideId);
        if (res.success) {
            Utils.showToast('Corrida concluída com sucesso! Valor creditado.', 'success');
            renderDriverDashboard();
        } else {
            Utils.showToast(res.error || 'Erro ao finalizar.', 'error');
        }
    };

    // Renderização do Painel do Motorista
    function renderDriverDashboard() {
        const driverRides = Rides.getByDriver(user.id);
        const availableRides = Rides.getAvailable();
        const earnings = Rides.getEarnings(user.id);

        // Atualizar estatísticas principais
        document.getElementById('statEarningsToday').textContent = Utils.formatCurrency(earnings.today.total);
        document.getElementById('statRidesCount').textContent = driverRides.filter(r => r.status === 'completed').length;

        // Atualizar aba de ganhos
        document.getElementById('earningsTodayBox').textContent = Utils.formatCurrency(earnings.today.total);
        document.getElementById('earningsWeekBox').textContent = Utils.formatCurrency(earnings.week.total);
        document.getElementById('earningsTotalBox').textContent = Utils.formatCurrency(earnings.allTime.total);

        // Verificar se tem corrida ativa no momento
        const activeRide = driverRides.find(r => ['accepted', 'in_progress'].includes(r.status));
        const activeContainer = document.getElementById('driverActiveRideContainer');

        if (activeRide) {
            activeContainer.style.display = 'block';
            document.getElementById('driverRidePassenger').textContent = activeRide.passengerName || 'Passageiro SerTaxi';
            document.getElementById('driverRideOrigin').textContent = activeRide.origin;
            document.getElementById('driverRideDest').textContent = activeRide.destination;
            document.getElementById('driverRidePrice').textContent = Utils.formatCurrency(activeRide.price);

            const badge = document.getElementById('driverRideBadge');
            const statusText = document.getElementById('driverRideStatusText');
            const actionsDiv = document.getElementById('driverRideActions');

            if (activeRide.status === 'accepted') {
                badge.className = 'badge badge-warning';
                badge.textContent = 'A caminho do passageiro';
                statusText.textContent = 'Corrida Aceita! Vá até a origem.';
                actionsDiv.innerHTML = `
                    <button class="btn btn-primary btn-sm" onclick="startRide('${activeRide.id}')">
                        ▶ Iniciar Corrida (Passageiro a bordo)
                    </button>
                `;
            } else if (activeRide.status === 'in_progress') {
                badge.className = 'badge badge-info';
                badge.textContent = 'Em trânsito com passageiro';
                statusText.textContent = 'Viagem em andamento para o destino!';
                actionsDiv.innerHTML = `
                    <button class="btn btn-success btn-sm" onclick="completeRide('${activeRide.id}')">
                        🏁 Finalizar Corrida & Receber Pagamento
                    </button>
                `;
            }
        } else {
            activeContainer.style.display = 'none';
        }

        // Renderizar chamadas rápidas e disponíveis
        renderAvailableRidesList(availableRides, 'quickAvailableRides', true);
        renderAvailableRidesList(availableRides, 'availableRidesList', false);

        // Renderizar histórico do motorista
        renderDriverHistory(driverRides);
        renderEarningsHistory(driverRides.filter(r => r.status === 'completed'));
    }

    function renderAvailableRidesList(rides, elementId, isShort) {
        const container = document.getElementById(elementId);
        if (!container) return;

        if (!isOnline) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Fique online para ver as solicitações de passageiros.</p>
                </div>
            `;
            return;
        }

        if (rides.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🟢</div>
                    <h3>Tudo calmo por aqui</h3>
                    <p>Nenhuma nova corrida aguardando no momento. Assim que um passageiro pedir, ela aparecerá aqui instantaneamente!</p>
                </div>
            `;
            return;
        }

        const displayList = isShort ? rides.slice(0, 2) : rides;

        container.innerHTML = displayList.map(ride => `
            <div class="ride-card">
                <div class="ride-card-top">
                    <div class="flex items-center gap-1">
                        <span class="badge badge-warning">Aguardando Motorista</span>
                        <span class="text-xs text-muted">Solicitado ${Utils.timeAgo(ride.createdAt)}</span>
                    </div>
                    <span class="ride-price text-success">${Utils.formatCurrency(ride.price)}</span>
                </div>
                <div class="ride-route">
                    <div class="route-item">
                        <span class="route-badge origem">A</span>
                        <span><strong>Passageiro:</strong> ${ride.passengerName}</span>
                    </div>
                    <div class="route-item">
                        <span class="route-badge origem">📍</span>
                        <span><strong>Origem:</strong> ${ride.origin}</span>
                    </div>
                    <div class="route-item">
                        <span class="route-badge destino">🏁</span>
                        <span><strong>Destino:</strong> ${ride.destination}</span>
                    </div>
                </div>
                <div class="ride-card-bottom">
                    <div class="text-xs text-muted">
                        Pagamento no local (PIX, Dinheiro ou Cartão)
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="acceptRide('${ride.id}')">
                        ⚡ Aceitar Corrida (${Utils.formatCurrency(ride.price)})
                    </button>
                </div>
            </div>
        `).join('');
    }

    function renderDriverHistory(rides) {
        const container = document.getElementById('driverHistoryList');
        if (!container) return;

        const filter = document.querySelector('#tab-minhas-corridas .filter-tab.active')?.getAttribute('data-filter') || 'all';
        let list = rides;
        if (filter === 'completed') {
            list = rides.filter(r => r.status === 'completed');
        }

        if (list.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📂</div>
                    <h3>Nenhuma viagem encontrada</h3>
                    <p>As corridas que você aceitar e concluir ficarão gravadas aqui.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(ride => `
            <div class="ride-card">
                <div class="ride-card-top">
                    <span class="badge ${Utils.statusBadge(ride.status)}">${Utils.statusLabel(ride.status)}</span>
                    <span class="text-xs text-muted">${Utils.formatDateTime(ride.createdAt)}</span>
                </div>
                <div class="ride-route">
                    <div class="route-item">
                        <span class="route-badge origem">A</span>
                        <span><strong>Passageiro:</strong> ${ride.passengerName}</span>
                    </div>
                    <div class="route-item">
                        <span class="route-badge origem">📍</span>
                        <span><strong>Origem:</strong> ${ride.origin}</span>
                    </div>
                    <div class="route-item">
                        <span class="route-badge destino">🏁</span>
                        <span><strong>Destino:</strong> ${ride.destination}</span>
                    </div>
                </div>
                <div class="ride-card-bottom">
                    <div>
                        <span class="text-xs text-muted">Valor recebido: </span>
                        <strong class="ride-price text-success">${Utils.formatCurrency(ride.price)}</strong>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderEarningsHistory(completedRides) {
        const container = document.getElementById('earningsDetailedList');
        if (!container) return;

        if (completedRides.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Nenhuma corrida finalizada para gerar extrato.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = completedRides.map(ride => `
            <div class="ride-card">
                <div class="flex justify-between items-center">
                    <div>
                        <strong>Corrida com ${ride.passengerName}</strong>
                        <div class="text-xs text-muted">${Utils.formatDateTime(ride.completedAt || ride.createdAt)}</div>
                    </div>
                    <div class="ride-price text-success">
                        + ${Utils.formatCurrency(ride.price)}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Filtros de histórico
    document.querySelectorAll('#tab-minhas-corridas .filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#tab-minhas-corridas .filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderDriverDashboard();
        });
    });

    renderDriverDashboard();
    setInterval(renderDriverDashboard, 3000);
});
