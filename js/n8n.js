/**
 * n8n Integration Module
 * Handles webhook communication and execution monitoring
 */

class N8NManager {
    constructor() {
        this.config = {
            n8nUrl: '',
            webhookUrl: '',
            apiKey: ''
        };

        this.currentExecutionId = null;
        this.executionPollingInterval = null;
        this.executionUpdateCallback = null;

        this.loadConfig();
    }

    /**
     * Load configuration from localStorage
     */
    loadConfig() {
        const stored = localStorage.getItem('nox-n8n-config');
        if (stored) {
            try {
                this.config = JSON.parse(stored);
            } catch (e) {
                console.error('Failed to load n8n config:', e);
            }
        }
    }

    /**
     * Save configuration to localStorage
     */
    saveConfig(config) {
        this.config = { ...this.config, ...config };
        localStorage.setItem('nox-n8n-config', JSON.stringify(this.config));
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Send message to n8n webhook
     * @param {string} message - The message to send
     * @param {Array} files - Optional files array
     * @returns {Promise<object>} - Response from n8n
     */
    async sendMessage(message, files = []) {
        if (!this.config.webhookUrl) {
            throw new Error('Webhook URL not configured. Please configure n8n settings.');
        }

        try {
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'X-N8N-API-KEY': this.config.apiKey })
                },
                body: JSON.stringify({
                    message: message,
                    files: files,
                    timestamp: new Date().toISOString(),
                    sessionId: this.getSessionId()
                })
            });

            if (!response.ok) {
                throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // If the response includes an execution ID, start monitoring
            if (data.executionId) {
                this.startExecutionMonitoring(data.executionId);
            }

            return data;
        } catch (error) {
            console.error('Error sending message to n8n:', error);
            throw error;
        }
    }

    /**
     * Get or create session ID
     */
    getSessionId() {
        let sessionId = sessionStorage.getItem('nox-session-id');
        if (!sessionId) {
            sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('nox-session-id', sessionId);
        }
        return sessionId;
    }

    /**
     * Start monitoring an execution
     * @param {string} executionId - The execution ID to monitor
     */
    startExecutionMonitoring(executionId) {
        this.currentExecutionId = executionId;

        // Clear any existing polling
        if (this.executionPollingInterval) {
            clearInterval(this.executionPollingInterval);
        }

        // Fetch execution details immediately
        this.fetchExecutionDetails();

        // Poll for updates every 1 second
        this.executionPollingInterval = setInterval(() => {
            this.fetchExecutionDetails();
        }, 1000);
    }

    /**
     * Stop monitoring executions
     */
    stopExecutionMonitoring() {
        if (this.executionPollingInterval) {
            clearInterval(this.executionPollingInterval);
            this.executionPollingInterval = null;
        }
        this.currentExecutionId = null;
    }

    /**
     * Fetch execution details from n8n API
     */
    async fetchExecutionDetails() {
        if (!this.currentExecutionId || !this.config.n8nUrl) {
            return;
        }

        try {
            const url = `${this.config.n8nUrl}/api/v1/executions/${this.currentExecutionId}`;
            const headers = {
                'Content-Type': 'application/json'
            };

            if (this.config.apiKey) {
                headers['X-N8N-API-KEY'] = this.config.apiKey;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                console.error(`Failed to fetch execution: ${response.status}`);
                return;
            }

            const execution = await response.json();

            // Call the update callback if registered
            if (this.executionUpdateCallback) {
                this.executionUpdateCallback(execution);
            }

            // Stop polling if execution is finished
            if (execution.finished || execution.stoppedAt) {
                setTimeout(() => {
                    this.stopExecutionMonitoring();
                }, 5000); // Keep showing for 5 more seconds
            }

            return execution;
        } catch (error) {
            console.error('Error fetching execution details:', error);
        }
    }

    /**
     * Register callback for execution updates
     * @param {function} callback - Function to call with execution data
     */
    onExecutionUpdate(callback) {
        this.executionUpdateCallback = callback;
    }

    /**
     * Get all executions (for history)
     * @param {number} limit - Number of executions to fetch
     */
    async getExecutions(limit = 10) {
        if (!this.config.n8nUrl) {
            throw new Error('n8n URL not configured');
        }

        try {
            const url = `${this.config.n8nUrl}/api/v1/executions?limit=${limit}`;
            const headers = {
                'Content-Type': 'application/json'
            };

            if (this.config.apiKey) {
                headers['X-N8N-API-KEY'] = this.config.apiKey;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch executions: ${response.status}`);
            }

            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error('Error fetching executions:', error);
            throw error;
        }
    }

    /**
     * Test connection to n8n
     */
    async testConnection() {
        if (!this.config.n8nUrl) {
            throw new Error('n8n URL not configured');
        }

        try {
            const url = `${this.config.n8nUrl}/healthz`;
            const response = await fetch(url, {
                method: 'GET'
            });

            return response.ok;
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }
}

// Create global instance
const n8nManager = new N8NManager();
