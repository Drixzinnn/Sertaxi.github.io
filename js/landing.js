// =========================================
// SERTAXI – Lógica da Landing Page
// =========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Ajustar Navbar com base na autenticação do usuário
    const session = Auth.getSession();
    const navAuthContainer = document.getElementById('navAuthContainer');
    const mobileAuthContainer = document.getElementById('mobileAuthContainer');

    if (session) {
        const dashboardUrl = session.type === 'driver' ? 'painel-motorista.html' : 'painel-passageiro.html';
        const typeLabel = session.type === 'driver' ? 'Motorista' : 'Passageiro';

        const authHtml = `
            <a href="${dashboardUrl}" class="btn btn-primary btn-sm flex items-center gap-1">
                <span>Meu Painel (${typeLabel})</span> →
            </a>
            <button class="btn btn-outline btn-sm" onclick="Auth.logout()">Sair</button>
        `;

        if (navAuthContainer) navAuthContainer.innerHTML = authHtml;
        if (mobileAuthContainer) mobileAuthContainer.innerHTML = authHtml;
    }

    // 2. Navbar scroll
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 30) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 3. Menu Mobile Toggle
    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');

    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    // 4. Fechar menu mobile ao clicar num link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            if (navLinks) navLinks.classList.remove('active');
        });
    });

    // 5. Scroll suave para âncoras
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});
