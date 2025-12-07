/**
 * NOX.AI Main Application
 * Coordinates chat interface and n8n integration
 */

class NOXApp {
    constructor() {
        this.chatMessages = null;
        this.chatInput = null;
        this.sendButton = null;
        this.executionContent = null;
        this.settingsPanel = null;
        this.isProcessing = false;

        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        // Get DOM elements
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendButton');
        this.executionContent = document.getElementById('executionContent');
        this.settingsPanel = document.getElementById('settingsPanel');

        // Setup event listeners
        this.setupEventListeners();

        // Setup n8n execution monitoring
        this.setupN8NMonitoring();

        // Auto-resize textarea
        this.setupTextareaAutoResize();
    }

    setupEventListeners() {
        // Send message on button click
        this.sendButton.addEventListener('click', () => this.sendMessage());

        // Send message on Enter (Shift+Enter for new line)
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Settings panel
        const settingsButton = document.getElementById('settingsButton');
        const saveSettings = document.getElementById('saveSettings');
        const cancelSettings = document.getElementById('cancelSettings');

        settingsButton.addEventListener('click', () => this.openSettings());
        saveSettings.addEventListener('click', () => this.saveSettings());
        cancelSettings.addEventListener('click', () => this.closeSettings());

        // Execution panel toggle
        const toggleExecution = document.getElementById('toggleExecution');
        toggleExecution.addEventListener('click', () => this.toggleExecutionPanel());
    }

    setupTextareaAutoResize() {
        this.chatInput.addEventListener('input', () => {
            this.chatInput.style.height = 'auto';
            this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 150) + 'px';
        });
    }

    setupN8NMonitoring() {
        // Register callback for execution updates
        n8nManager.onExecutionUpdate((execution) => {
            this.updateExecutionDisplay(execution);
        });
    }

    async sendMessage() {
        const message = this.chatInput.value.trim();

        if (!message || this.isProcessing) {
            return;
        }

        // Add user message to chat
        this.addMessage(message, 'user');

        // Clear input
        this.chatInput.value = '';
        this.chatInput.style.height = 'auto';

        // Set processing state
        this.isProcessing = true;
        this.sendButton.disabled = true;

        // Show loading indicator
        const loadingId = this.addLoadingIndicator();

        try {
            // Send to n8n webhook
            const response = await n8nManager.sendMessage(message);

            // Remove loading indicator
            this.removeMessage(loadingId);

            // Add assistant response
            if (response.reply || response.message) {
                this.addMessage(response.reply || response.message, 'assistant');
            } else {
                this.addMessage('Message sent to workflow successfully!', 'system');
            }

        } catch (error) {
            // Remove loading indicator
            this.removeMessage(loadingId);

            // Show error message
            this.addMessage(
                `Error: ${error.message}. Please check your n8n configuration.`,
                'system'
            );
        } finally {
            // Reset processing state
            this.isProcessing = false;
            this.sendButton.disabled = false;
            this.chatInput.focus();
        }
    }

    addMessage(content, type = 'user') {
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}-message`;
        messageEl.id = messageId;

        const timestamp = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        let roleLabel = '';
        if (type === 'user') roleLabel = 'You';
        else if (type === 'assistant') roleLabel = 'NOX.AI';
        else if (type === 'system') roleLabel = 'System';

        messageEl.innerHTML = `
            ${roleLabel ? `<div class="message-header">
                <span class="message-role">${roleLabel}</span>
                <span class="message-time">${timestamp}</span>
            </div>` : ''}
            <div class="message-content">
                <p>${this.escapeHtml(content)}</p>
            </div>
        `;

        this.chatMessages.appendChild(messageEl);
        this.scrollToBottom();

        return messageId;
    }

    addLoadingIndicator() {
        const messageId = `loading_${Date.now()}`;
        const messageEl = document.createElement('div');
        messageEl.className = 'message assistant-message';
        messageEl.id = messageId;

        messageEl.innerHTML = `
            <div class="message-header">
                <span class="message-role">NOX.AI</span>
            </div>
            <div class="message-content">
                <div class="loading-indicator">
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                </div>
            </div>
        `;

        this.chatMessages.appendChild(messageEl);
        this.scrollToBottom();

        return messageId;
    }

    removeMessage(messageId) {
        const messageEl = document.getElementById(messageId);
        if (messageEl) {
            messageEl.remove();
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    updateExecutionDisplay(execution) {
        if (!execution || !this.executionContent) {
            return;
        }

        // Clear placeholder if present
        const placeholder = this.executionContent.querySelector('.execution-placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        // Extract execution data
        const { data, finished, stoppedAt, status } = execution;

        if (!data || !data.resultData) {
            return;
        }

        // Clear existing content
        this.executionContent.innerHTML = '';

        // Get workflow execution data
        const runData = data.resultData.runData || {};

        // Create execution nodes display
        Object.keys(runData).forEach((nodeName) => {
            const nodeData = runData[nodeName];
            if (!nodeData || nodeData.length === 0) return;

            const lastRun = nodeData[nodeData.length - 1];

            // Determine node status
            let nodeStatus = 'completed';
            if (!finished && !stoppedAt) {
                nodeStatus = 'running';
            } else if (lastRun.error) {
                nodeStatus = 'error';
            }

            this.addExecutionNode(nodeName, nodeStatus, lastRun);
        });

        // Add execution summary at the top
        this.addExecutionSummary(execution);
    }

    addExecutionSummary(execution) {
        const summaryEl = document.createElement('div');
        summaryEl.className = 'execution-item';
        summaryEl.style.marginBottom = '20px';

        const status = execution.finished ? 'completed' : 'running';
        const statusText = execution.finished ? 'Completed' : 'Running';

        const startTime = new Date(execution.startedAt).toLocaleTimeString();
        const duration = execution.stoppedAt
            ? `${Math.round((new Date(execution.stoppedAt) - new Date(execution.startedAt)) / 1000)}s`
            : 'Running...';

        const statsHtml = `
            <div class="node-stats">
                <div class="node-stat">
                    <div class="node-stat-label">Status</div>
                    <div class="node-stat-value">${statusText}</div>
                </div>
                <div class="node-stat">
                    <div class="node-stat-label">Started</div>
                    <div class="node-stat-value">${startTime}</div>
                </div>
                <div class="node-stat">
                    <div class="node-stat-label">Duration</div>
                    <div class="node-stat-value">${duration}</div>
                </div>
                ${execution.stoppedAt ? `
                <div class="node-stat">
                    <div class="node-stat-label">Finished</div>
                    <div class="node-stat-value">${new Date(execution.stoppedAt).toLocaleTimeString()}</div>
                </div>
                ` : ''}
            </div>
        `;

        summaryEl.innerHTML = `
            <div class="node-header" data-node-id="summary">
                <div class="node-status ${status}"></div>
                <div class="node-name">Workflow Execution</div>
                <svg class="node-expand-icon expanded" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
            <div class="node-details expanded" id="summary_details">
                ${statsHtml}
            </div>
        `;

        // Add click handler
        const header = summaryEl.querySelector('.node-header');
        header.addEventListener('click', () => this.toggleNodeDetails('summary'));

        summaryEl.classList.add(status);
        this.executionContent.insertBefore(summaryEl, this.executionContent.firstChild);
    }

    addExecutionNode(nodeName, status, nodeData) {
        const nodeId = `node_${nodeName.replace(/\s+/g, '_')}`;
        const nodeEl = document.createElement('div');
        nodeEl.className = `execution-item ${status}`;
        nodeEl.dataset.nodeId = nodeId;

        const executionTime = nodeData.executionTime
            ? `${nodeData.executionTime}ms`
            : 'N/A';

        const startTime = nodeData.startTime
            ? new Date(nodeData.startTime).toLocaleTimeString()
            : 'N/A';

        // Build stats
        const statsHtml = `
            <div class="node-stats">
                <div class="node-stat">
                    <div class="node-stat-label">Duration</div>
                    <div class="node-stat-value">${executionTime}</div>
                </div>
                <div class="node-stat">
                    <div class="node-stat-label">Started</div>
                    <div class="node-stat-value">${startTime}</div>
                </div>
                <div class="node-stat">
                    <div class="node-stat-label">Status</div>
                    <div class="node-stat-value">${status.toUpperCase()}</div>
                </div>
            </div>
        `;

        // Build logs if available
        let logsHtml = '';
        if (nodeData.error) {
            logsHtml = `
                <div class="node-logs">
                    <div class="node-log-title">Error Details</div>
                    <div class="node-log-entry error">${this.escapeHtml(nodeData.error.message || 'Unknown error')}</div>
                    ${nodeData.error.stack ? `<div class="node-log-entry error">${this.escapeHtml(nodeData.error.stack)}</div>` : ''}
                </div>
            `;
        } else if (nodeData.data) {
            // Show output data as logs
            const outputData = JSON.stringify(nodeData.data, null, 2);
            logsHtml = `
                <div class="node-logs">
                    <div class="node-log-title">Output Data</div>
                    <div class="node-log-entry">${this.escapeHtml(outputData.substring(0, 500))}${outputData.length > 500 ? '...' : ''}</div>
                </div>
            `;
        }

        nodeEl.innerHTML = `
            <div class="node-header" data-node-id="${nodeId}">
                <div class="node-status ${status}"></div>
                <div class="node-name">${this.escapeHtml(nodeName)}</div>
                <svg class="node-expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
            <div class="node-details" id="${nodeId}_details">
                ${statsHtml}
                ${logsHtml}
            </div>
        `;

        // Add click handler for expand/collapse
        const header = nodeEl.querySelector('.node-header');
        header.addEventListener('click', () => this.toggleNodeDetails(nodeId));

        this.executionContent.appendChild(nodeEl);
    }

    toggleNodeDetails(nodeId) {
        const details = document.getElementById(`${nodeId}_details`);
        const icon = document.querySelector(`[data-node-id="${nodeId}"] .node-expand-icon`);

        if (details && icon) {
            if (details.classList.contains('expanded')) {
                details.classList.remove('expanded');
                icon.classList.remove('expanded');
            } else {
                details.classList.add('expanded');
                icon.classList.add('expanded');
            }
        }
    }

    toggleExecutionPanel() {
        const content = this.executionContent;
        const button = document.getElementById('toggleExecution');

        if (content.style.display === 'none') {
            content.style.display = 'block';
            button.style.transform = 'rotate(0deg)';
        } else {
            content.style.display = 'none';
            button.style.transform = 'rotate(-90deg)';
        }
    }

    openSettings() {
        const config = n8nManager.getConfig();

        document.getElementById('n8nUrl').value = config.n8nUrl || '';
        document.getElementById('webhookUrl').value = config.webhookUrl || '';
        document.getElementById('apiKey').value = config.apiKey || '';

        this.settingsPanel.classList.remove('hidden');
    }

    closeSettings() {
        this.settingsPanel.classList.add('hidden');
    }

    saveSettings() {
        const config = {
            n8nUrl: document.getElementById('n8nUrl').value.trim(),
            webhookUrl: document.getElementById('webhookUrl').value.trim(),
            apiKey: document.getElementById('apiKey').value.trim()
        };

        n8nManager.saveConfig(config);
        this.closeSettings();

        // Show confirmation
        this.addMessage('Settings saved successfully!', 'system');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize application
const app = new NOXApp();
