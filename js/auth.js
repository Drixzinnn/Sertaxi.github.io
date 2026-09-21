// =========================================
// SERTAXI – Auth (Cadastro, Login, Sessão)
// =========================================

const STORAGE = {
    USERS: 'sertaxi_users',
    RIDES: 'sertaxi_rides',
    SESSION: 'sertaxi_session'
};

const Auth = {
    // Get all users
    getUsers() {
        return JSON.parse(localStorage.getItem(STORAGE.USERS) || '[]');
    },

    // Save users
    saveUsers(users) {
        localStorage.setItem(STORAGE.USERS, JSON.stringify(users));
    },

    // Register a new user
    register(userData) {
        const users = this.getUsers();

        // Check if email already exists
        if (users.find(u => u.email === userData.email)) {
            return { success: false, error: 'Este e-mail já está cadastrado.' };
        }

        // Check if CPF already exists
        if (users.find(u => u.cpf === userData.cpf)) {
            return { success: false, error: 'Este CPF já está cadastrado.' };
        }

        // Se for motorista, validar se é 17+
        if (userData.type === 'driver' && userData.birthDate) {
            const birth = new Date(userData.birthDate);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                age--;
            }

            if (age < 17) {
                return { success: false, error: 'Cadastro recusado: O motorista parceiro precisa ter no mínimo 17 anos completos de idade com documento oficial.' };
            }
        }

        const user = {
            id: Utils.generateId(),
            createdAt: new Date().toISOString(),
            rating: '5.0',
            totalRides: 0,
            totalEarnings: 0,
            online: false,
            ...userData
        };

        users.push(user);
        this.saveUsers(users);
        this.setSession(user);

        return { success: true, user };
    },

    // Login com Google
    loginWithGoogle(userType = 'passenger') {
        // Redirect to fake Google login page
        sessionStorage.setItem('sertaxi_social_type', userType);
        window.location.href = 'google-login.html';
        return { success: true };
    },

    // Login com Apple / iPhone
    loginWithApple(userType = 'passenger') {
        // Redirect to fake Apple login page
        sessionStorage.setItem('sertaxi_social_type', userType);
        window.location.href = 'apple-login.html';
        return { success: true };
    },

    // Login Tradicional
    login(email, password, expectedType = null) {
        const users = this.getUsers();
        let user = users.find(u => u.email === email && u.password === password);

        if (!user) {
            return { success: false, error: 'E-mail ou senha incorretos.' };
        }

        if (user.status === 'pending') {
            return { success: false, error: '⏳ Conta aguardando aprovação. Seu comprovante PIX está sendo verificado. Aguarde até 24h.' };
        }

        if (user.status === 'rejected') {
            return { success: false, error: '❌ Seu pagamento não foi confirmado. Entre em contato pelo WhatsApp (87) 99205-4060.' };
        }

        if (user.banned) {
            return { success: false, error: '🚫 Conta banida. Entre em contato com o suporte.' };
        }

        if (expectedType && user.type !== expectedType) {
            return {
                success: false,
                error: expectedType === 'driver'
                    ? 'Esta conta é de Passageiro. Para acessar como motorista parceiro, utilize uma conta de motorista.'
                    : 'Esta conta é de Motorista. Redirecionando para o painel de motorista...'
            };
        }

        this.setSession(user);
        return { success: true, user };
    },

    // Validates registration data without saving (for pre-payment check)
    validateRegistrationData(userData) {
        if (userData.type === 'driver' && userData.birthDate) {
            const birth = new Date(userData.birthDate);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
            if (age < 17) {
                return { error: 'Cadastro recusado: O motorista parceiro precisa ter no mínimo 17 anos completos.' };
            }
        }
        return null; // tudo ok
    },

    // Callback real do Google (Decodifica o JWT Token)
    handleGoogleLogin(response, userType = 'passenger') {
        try {
            // O response.credential é um JWT (JSON Web Token)
            const base64Url = response.credential.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            const payload = JSON.parse(jsonPayload);
            const email = payload.email;
            const name = payload.name;
            const photo = payload.picture; // Foto do Google

            if (email && name) {
                // Seta temporariamente a foto no sessionStorage para salvar no Auth
                sessionStorage.setItem('sertaxi_social_photo', photo);
                sessionStorage.setItem('sertaxi_social_type', userType);
                this.completeSocialLogin('google', email, name);
            }
        } catch (e) {
            console.error('Erro ao processar login do Google', e);
            alert('Falha ao autenticar com o Google.');
        }
    },

    // Complete social login callback
    completeSocialLogin(provider, email, name) {
        const users = this.getUsers();
        const userType = sessionStorage.getItem('sertaxi_social_type') || 'passenger';
        let user = users.find(u => u.authProvider === provider && u.email === email && u.type === userType);

        if (!user) {
            user = {
                id: Utils.generateId(),
                type: userType,
                authProvider: provider,
                name: name,
                email: email,
                phone: '',
                cpf: '',
                carModel: null,
                carPlate: null,
                carColor: null,
                cnh: null,
                birthDate: null,
                rating: '5.0',
                totalRides: 0,
                totalEarnings: 0,
                online: false,
                createdAt: new Date().toISOString()
            };
            users.push(user);
            this.saveUsers(users);
        }

        this.setSession(user);
        window.location.href = user.type === 'passenger' ? 'painel-passageiro.html' : 'painel-motorista.html';
    },

    // Logout
    logout() {
        localStorage.removeItem(STORAGE.SESSION);
        window.location.href = 'index.html';
    },

    // Set session
    setSession(user) {
        // Don't store password in session
        const session = { ...user };
        delete session.password;
        localStorage.setItem(STORAGE.SESSION, JSON.stringify(session));
    },

    // Get current session
    getSession() {
        const data = localStorage.getItem(STORAGE.SESSION);
        return data ? JSON.parse(data) : null;
    },

    // Check if logged in
    isLoggedIn() {
        return this.getSession() !== null;
    },

    // Get current user type
    getUserType() {
        const session = this.getSession();
        return session ? session.type : null;
    },

    // Update user profile
    updateProfile(userId, updates) {
        const users = this.getUsers();
        const index = users.findIndex(u => u.id === userId);

        if (index === -1) {
            return { success: false, error: 'Usuário não encontrado.' };
        }

        // If email is being changed, check for duplicates
        if (updates.email && updates.email !== users[index].email) {
            if (users.find(u => u.email === updates.email && u.id !== userId)) {
                return { success: false, error: 'Este e-mail já está em uso.' };
            }
        }

        users[index] = { ...users[index], ...updates };
        this.saveUsers(users);
        this.setSession(users[index]);

        return { success: true, user: users[index] };
    },

    // Get user by ID
    getUserById(userId) {
        const users = this.getUsers();
        return users.find(u => u.id === userId) || null;
    },

    // Update user stats (rides count, earnings)
    updateStats(userId, statsUpdate) {
        const users = this.getUsers();
        const index = users.findIndex(u => u.id === userId);
        if (index === -1) return;

        if (statsUpdate.addRide) {
            users[index].totalRides = (users[index].totalRides || 0) + 1;
        }
        if (statsUpdate.addEarnings) {
            users[index].totalEarnings = (users[index].totalEarnings || 0) + statsUpdate.addEarnings;
        }
        if (typeof statsUpdate.online === 'boolean') {
            users[index].online = statsUpdate.online;
        }

        this.saveUsers(users);
        this.setSession(users[index]);
    },

    // Protect route – redirect if not logged in or wrong type
    requireAuth(expectedType) {
        const session = this.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return null;
        }
        if (expectedType && session.type !== expectedType) {
            window.location.href = session.type === 'passenger' ? 'painel-passageiro.html' : 'painel-motorista.html';
            return null;
        }
        return session;
    },

    // Redirect if already logged in
    redirectIfLoggedIn() {
        const session = this.getSession();
        if (session) {
            window.location.href = session.type === 'passenger' ? 'painel-passageiro.html' : 'painel-motorista.html';
            return true;
        }
        return false;
    }
};

window.handleGooglePassenger = function(response) { Auth.handleGoogleLogin(response, 'passenger'); };
window.handleGoogleDriver = function(response) { Auth.handleGoogleLogin(response, 'driver'); };
