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

        // Load config asynchronously
        this.init();
    }

    /**
     * Initialize async
     */
    async init() {
        await this.loadConfig();
    }

    /**
     * Load configuration from encrypted localStorage
     */
    async loadConfig() {
        if (window.CryptoUtils) {
            const stored = await window.CryptoUtils.getItem('nox-n8n-config');
            if (stored) {
                this.config = stored;
            }
        } else {
            // Fallback to unencrypted (for initial load)
            const stored = localStorage.getItem('nox-n8n-config');
            if (stored) {
                try {
                    this.config = JSON.parse(stored);
                } catch (e) {
                    console.error('Failed to load n8n config:', e);
                }
            }
        }
    }

    /**
     * Save configuration to encrypted localStorage
     */
    async saveConfig(config) {
        // Trim trailing slashes from URLs
        if (config.n8nUrl) {
            config.n8nUrl = config.n8nUrl.replace(/\/+$/, '');
        }
        if (config.webhookUrl) {
            config.webhookUrl = config.webhookUrl.replace(/\/+$/, '');
        }

        this.config = { ...this.config, ...config };

        if (window.CryptoUtils) {
            await window.CryptoUtils.setItem('nox-n8n-config', this.config);
        } else {
            // Fallback to unencrypted
            localStorage.setItem('nox-n8n-config', JSON.stringify(this.config));
        }
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

        const payload = {
            action: 'sendMessage',
            sessionId: this.getSessionId(),
            chatInput: message,
            message: message, // Keep for compatibility with regular webhooks
            files: files,
            timestamp: new Date().toISOString()
        };

        console.log('📤 Sending to n8n webhook:', {
            url: this.config.webhookUrl,
            payload: payload
        });

        try {
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'X-N8N-API-KEY': this.config.apiKey })
                },
                body: JSON.stringify(payload)
            });

            console.log('📥 Webhook response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Webhook error response:', errorText);
                throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
            }

            // Get the response text first
            const responseText = await response.text();
            console.log('📄 Raw response:', responseText);

            // Try to parse as JSON, fallback to plain text
            let data;
            try {
                data = JSON.parse(responseText);
                console.log('✅ Parsed as JSON:', data);
            } catch (e) {
                // Not JSON, treat as plain text response
                console.log('📝 Plain text response detected, wrapping in object');
                data = {
                    output: responseText,
                    message: responseText
                };
            }

            // If the response includes an execution ID, start monitoring
            // Check both top-level and nested in data object
            const executionId = data.executionId || data.data?.executionId;
            if (executionId) {
                console.log('🔍 Starting execution monitoring for ID:', executionId);
                this.startExecutionMonitoring(executionId);
            }

            return data;
        } catch (error) {
            console.error('❌ Error sending message to n8n:', error);
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
            // Add includeData=true to get node-level execution details
            const url = `${this.config.n8nUrl}/api/v1/executions/${this.currentExecutionId}?includeData=true`;
            const headers = {
                'Content-Type': 'application/json'
            };

            if (this.config.apiKey) {
                headers['X-N8N-API-KEY'] = this.config.apiKey;
            }

            console.log('🔄 Fetching execution details with node data:', this.currentExecutionId);

            const response = await fetch(url, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                console.error('❌ Failed to fetch execution:', response.status);
                return;
            }

            const execution = await response.json();

            // Log execution summary
            console.log('📊 Execution update:', {
                id: execution.id,
                status: execution.finished ? 'finished' : 'running',
                mode: execution.mode,
                startedAt: execution.startedAt,
                stoppedAt: execution.stoppedAt
            });

            // Log node-level details if available
            if (execution.data?.resultData?.runData) {
                const nodes = Object.keys(execution.data.resultData.runData);
                console.log('🔷 Nodes executed:', nodes.length, '→', nodes);

                nodes.forEach(nodeName => {
                    const nodeRuns = execution.data.resultData.runData[nodeName];
                    if (nodeRuns && nodeRuns.length > 0) {
                        const lastRun = nodeRuns[nodeRuns.length - 1];
                        console.log(`  ├─ ${nodeName}:`, {
                            status: lastRun.error ? '❌ error' : '✅ success',
                            executionTime: lastRun.executionTime ? `${lastRun.executionTime}ms` : 'N/A',
                            startTime: lastRun.startTime || 'N/A'
                        });
                    }
                });
            } else {
                console.warn('⚠️ No node execution data found. Make sure includeData=true is working.');
            }

            // Call the update callback if registered
            if (this.executionUpdateCallback) {
                this.executionUpdateCallback(execution);
            }

            // Stop polling if execution is finished
            if (execution.finished || execution.stoppedAt) {
                console.log('✅ Execution completed, stopping monitoring in 5s');
                setTimeout(() => {
                    this.stopExecutionMonitoring();
                }, 5000); // Keep showing for 5 more seconds
            }

            return execution;
        } catch (error) {
            // Check if it's a CORS error
            if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                console.warn('⚠️ CORS Error: Cannot fetch execution details from n8n API.');
                console.warn('💡 To fix: Configure CORS in your n8n instance to allow origin:', window.location.origin);
                console.warn('📚 See: https://docs.n8n.io/hosting/configuration/environment-variables/#cors');

                // Stop trying to fetch if we hit CORS errors
                this.stopExecutionMonitoring();
            } else {
                console.error('❌ Error fetching execution details:', error);
            }
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
     * Get all workflows
     * @returns {Promise<Array>} - List of workflows
     */
    async getWorkflows() {
        if (!this.config.n8nUrl) {
            throw new Error('n8n URL not configured');
        }

        try {
            const url = `${this.config.n8nUrl}/api/v1/workflows`;
            const headers = {
                'Content-Type': 'application/json'
            };

            if (this.config.apiKey) {
                headers['X-N8N-API-KEY'] = this.config.apiKey;
            }

            console.log('📋 Fetching workflows list');

            const response = await fetch(url, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch workflows: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Fetched workflows:', data.data?.length || 0);
            return data.data || [];
        } catch (error) {
            console.error('❌ Error fetching workflows:', error);
            throw error;
        }
    }

    /**
     * Get executions for a specific workflow
     * @param {string} workflowId - The workflow ID
     * @param {number} limit - Number of executions to fetch
     * @returns {Promise<Array>} - List of executions
     */
    async getExecutionsByWorkflow(workflowId, limit = 20) {
        if (!this.config.n8nUrl) {
            throw new Error('n8n URL not configured');
        }

        try {
            const url = `${this.config.n8nUrl}/api/v1/executions?workflowId=${workflowId}&limit=${limit}`;
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
            console.error('❌ Error fetching executions for workflow:', error);
            throw error;
        }
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
