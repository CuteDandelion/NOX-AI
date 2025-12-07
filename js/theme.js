/**
 * Theme Manager
 * Handles dark/light mode toggle and persistence
 */

class ThemeManager {
    constructor() {
        this.theme = this.getStoredTheme() || 'dark';
        this.themeToggle = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.themeToggle = document.getElementById('themeToggle');

        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Apply initial theme
        this.applyTheme(this.theme);
    }

    getStoredTheme() {
        return localStorage.getItem('nox-theme');
    }

    setStoredTheme(theme) {
        localStorage.setItem('nox-theme', theme);
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme(this.theme);
        this.setStoredTheme(this.theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.updateThemeIcon(theme);
    }

    updateThemeIcon(theme) {
        if (this.themeToggle) {
            const icon = this.themeToggle.querySelector('.theme-icon');
            if (icon) {
                icon.textContent = theme === 'dark' ? '🌙' : '☀️';
            }
        }
    }
}

// Initialize theme manager
const themeManager = new ThemeManager();
