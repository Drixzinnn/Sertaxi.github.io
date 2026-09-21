// =========================================
// SERTAXI – Utilities
// =========================================

const Utils = {
    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    // Phone mask: (00) 00000-0000
    phoneMask(value) {
        let v = value.replace(/\D/g, '').slice(0, 11);
        if (v.length > 6) return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
        if (v.length > 2) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
        if (v.length > 0) return `(${v}`;
        return '';
    },

    // CPF mask: 000.000.000-00
    cpfMask(value) {
        let v = value.replace(/\D/g, '').slice(0, 11);
        if (v.length > 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
        if (v.length > 6) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
        if (v.length > 3) return `${v.slice(0, 3)}.${v.slice(3)}`;
        return v;
    },

    // License plate mask: ABC-1D23 or ABC1D23
    plateMask(value) {
        let v = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7);
        if (v.length > 3) return `${v.slice(0, 3)}-${v.slice(3)}`;
        return v;
    },

    // Currency format
    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    },

    // Date format
    formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    // Date time format
    formatDateTime(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Time ago
    timeAgo(dateStr) {
        const now = new Date();
        const date = new Date(dateStr);
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return 'agora';
        if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
        if (diff < 604800) return `${Math.floor(diff / 86400)} dias atrás`;
        return Utils.formatDate(dateStr);
    },

    // Validate email
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    // Validate CPF (basic check)
    isValidCPF(cpf) {
        const cleaned = cpf.replace(/\D/g, '');
        if (cleaned.length !== 11) return false;
        if (/^(\d)\1+$/.test(cleaned)) return false;

        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
        let check = 11 - (sum % 11);
        if (check >= 10) check = 0;
        if (parseInt(cleaned[9]) !== check) return false;

        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
        check = 11 - (sum % 11);
        if (check >= 10) check = 0;
        return parseInt(cleaned[10]) === check;
    },

    // Validate phone
    isValidPhone(phone) {
        return phone.replace(/\D/g, '').length >= 10;
    },

    // Apply mask to input
    applyMask(inputEl, maskFn) {
        inputEl.addEventListener('input', (e) => {
            e.target.value = maskFn(e.target.value);
        });
    },

    // Show toast notification
    showToast(message, type = 'info', duration = 4000) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: '✅', error: '❌', info: 'ℹ️' };
        toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Show/hide modal
    showModal(modalId) {
        document.getElementById(modalId)?.classList.add('active');
    },

    hideModal(modalId) {
        document.getElementById(modalId)?.classList.remove('active');
    },

    // Simulate ride price calculation
    calculatePrice(origin, destination) {
        // Simulated pricing based on string length as proxy for distance
        const baseFare = 5.50;
        const perKm = 1.80;
        const minFare = 8.00;

        // Use combined string length as rough "distance" simulation
        const pseudoDistance = ((origin.length + destination.length) % 15) + 3;
        const price = baseFare + (perKm * pseudoDistance);

        return Math.max(price, minFare);
    },

    // Capitalize first letter
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // Truncate string
    truncate(str, len = 30) {
        return str.length > len ? str.substring(0, len) + '...' : str;
    },

    // Get initials from name
    getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },

    // Status label in Portuguese
    statusLabel(status) {
        const labels = {
            waiting: 'Aguardando',
            accepted: 'Aceita',
            in_progress: 'Em andamento',
            completed: 'Concluída',
            cancelled: 'Cancelada'
        };
        return labels[status] || status;
    },

    // Status badge class
    statusBadge(status) {
        const badges = {
            waiting: 'badge-warning',
            accepted: 'badge-info',
            in_progress: 'badge-info',
            completed: 'badge-success',
            cancelled: 'badge-danger'
        };
        return badges[status] || 'badge-neutral';
    }
};
