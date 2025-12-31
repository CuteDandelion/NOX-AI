/**
 * NotificationManager - Handles toast notifications with auto-dismiss timer
 * Supports: success, error, info, warning, loading
 * Features: 10-second auto-dismiss, stacking, animations
 */
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notificationContainer');
        this.notifications = new Map(); // Track active notifications
        this.nextId = 1;
    }

    /**
     * Show a notification
     * @param {Object} options - Notification options
     * @param {string} options.type - Type: 'success', 'error', 'info', 'warning', 'loading'
     * @param {string} options.title - Notification title
     * @param {string} options.message - Notification message
     * @param {number} [options.duration=10000] - Duration in ms (0 for persistent)
     * @returns {number} Notification ID
     */
    show({ type = 'info', title, message, duration = 10000 }) {
        const id = this.nextId++;
        const notification = this.createNotification(id, type, title, message, duration);

        this.container.appendChild(notification);
        this.notifications.set(id, {
            element: notification,
            timer: null,
            progressInterval: null,
            duration
        });

        // Start auto-dismiss timer if duration > 0
        if (duration > 0) {
            this.startTimer(id, duration);
        }

        return id;
    }

    /**
     * Show success notification
     */
    success(title, message, duration = 10000) {
        return this.show({ type: 'success', title, message, duration });
    }

    /**
     * Show error notification
     */
    error(title, message, duration = 10000) {
        return this.show({ type: 'error', title, message, duration });
    }

    /**
     * Show info notification
     */
    info(title, message, duration = 10000) {
        return this.show({ type: 'info', title, message, duration });
    }

    /**
     * Show warning notification
     */
    warning(title, message, duration = 10000) {
        return this.show({ type: 'warning', title, message, duration });
    }

    /**
     * Show loading notification (persistent by default)
     */
    loading(title, message, duration = 0) {
        return this.show({ type: 'loading', title, message, duration });
    }

    /**
     * Create notification DOM element
     */
    createNotification(id, type, title, message, duration) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.dataset.id = id;

        const icon = this.getIcon(type);

        notification.innerHTML = `
            <div class="notification-header">
                <div class="notification-icon">${icon}</div>
                <div class="notification-title">${this.escapeHtml(title)}</div>
                <button class="notification-close" aria-label="Close notification">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="notification-message">${this.escapeHtml(message)}</div>
            ${duration > 0 ? `
                <div class="notification-progress">
                    <div class="notification-progress-bar" style="width: 100%"></div>
                </div>
            ` : ''}
        `;

        // Add close button handler
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.dismiss(id));

        return notification;
    }

    /**
     * Get icon SVG for notification type
     */
    getIcon(type) {
        const icons = {
            success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>`,
            error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>`,
            info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>`,
            warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>`,
            loading: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="2" x2="12" y2="6"></line>
                <line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line>
                <line x1="18" y1="12" x2="22" y2="12"></line>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
            </svg>`
        };
        return icons[type] || icons.info;
    }

    /**
     * Start auto-dismiss timer with progress bar
     */
    startTimer(id, duration) {
        const notificationData = this.notifications.get(id);
        if (!notificationData) return;

        const progressBar = notificationData.element.querySelector('.notification-progress-bar');
        const startTime = Date.now();

        // Update progress bar every 100ms
        notificationData.progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, duration - elapsed);
            const percentage = (remaining / duration) * 100;

            if (progressBar) {
                progressBar.style.width = `${percentage}%`;
            }

            if (remaining <= 0) {
                clearInterval(notificationData.progressInterval);
            }
        }, 100);

        // Set dismiss timer
        notificationData.timer = setTimeout(() => {
            this.dismiss(id);
        }, duration);
    }

    /**
     * Dismiss a notification
     */
    dismiss(id) {
        const notificationData = this.notifications.get(id);
        if (!notificationData) return;

        // Clear timers
        if (notificationData.timer) {
            clearTimeout(notificationData.timer);
        }
        if (notificationData.progressInterval) {
            clearInterval(notificationData.progressInterval);
        }

        // Add removing animation
        notificationData.element.classList.add('removing');

        // Remove from DOM after animation
        setTimeout(() => {
            if (notificationData.element.parentNode) {
                notificationData.element.parentNode.removeChild(notificationData.element);
            }
            this.notifications.delete(id);
        }, 300); // Match animation duration
    }

    /**
     * Update an existing notification
     */
    update(id, { title, message, type }) {
        const notificationData = this.notifications.get(id);
        if (!notificationData) return;

        const element = notificationData.element;

        if (title) {
            const titleEl = element.querySelector('.notification-title');
            if (titleEl) titleEl.textContent = this.escapeHtml(title);
        }

        if (message) {
            const messageEl = element.querySelector('.notification-message');
            if (messageEl) messageEl.textContent = this.escapeHtml(message);
        }

        if (type) {
            // Update type class
            element.className = `notification ${type}`;

            // Update icon
            const iconEl = element.querySelector('.notification-icon');
            if (iconEl) iconEl.innerHTML = this.getIcon(type);
        }
    }

    /**
     * Dismiss all notifications
     */
    dismissAll() {
        const ids = Array.from(this.notifications.keys());
        ids.forEach(id => this.dismiss(id));
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}
