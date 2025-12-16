/**
 * NOX.AI Main Application
 * Multi-modal chat with n8n integration
 */

class NOXApp {
    constructor() {
        this.chatMessages = null;
        this.chatInput = null;
        this.sendButton = null;
        this.attachButton = null;
        this.voiceButton = null;
        this.fileInput = null;
        this.attachedFiles = null;
        this.executionContent = null;
        this.settingsModal = null;
        this.isProcessing = false;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.files = [];

        // Workflow monitoring
        this.workflowSelect = null;
        this.executionsList = null;
        this.selectedWorkflowId = null;
        this.selectedExecutionId = null;
        this.executionsRefreshInterval = null;

        // Graph auto-refresh
        this.graphPollingInterval = null;
        this.graphAutoRefreshEnabled = false;

        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    async setup() {
        // Migrate all sensitive data to encrypted storage
        if (window.CryptoUtils) {
            await window.CryptoUtils.migrateAllData();
        }

        // Get DOM elements
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendButton');
        this.attachButton = document.getElementById('attachButton');
        this.voiceButton = document.getElementById('voiceButton');
        this.fileInput = document.getElementById('fileInput');
        this.attachedFiles = document.getElementById('attachedFiles');
        this.settingsModal = document.getElementById('settingsModal');
        this.workflowSelect = document.getElementById('workflowSelect');
        this.executionsList = document.getElementById('executionsList');
        this.nodeLogsModal = document.getElementById('nodeLogsModal');

        // Setup event listeners
        this.setupEventListeners();
        this.setupN8NMonitoring();
        this.setupWorkflowMonitoring();
        this.setupTextareaAutoResize();
        this.restoreSidebarStates();
        this.renderChatList();
        this.loadCurrentChat();
    }

    setupEventListeners() {
        // Send message
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // File attachment
        this.attachButton.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Voice input
        this.voiceButton.addEventListener('click', () => this.toggleVoiceRecording());

        // Chat management
        document.getElementById('newChatBtn').addEventListener('click', () => this.createNewChat());
        document.getElementById('chatList').addEventListener('click', (e) => this.handleChatListClick(e));

        // Settings
        document.getElementById('settingsButton').addEventListener('click', () => this.openSettings());
        document.getElementById('closeSettings').addEventListener('click', () => this.closeSettings());
        document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
        document.getElementById('cancelSettings').addEventListener('click', () => this.closeSettings());

        // Connection tests
        document.getElementById('testN8nConnection').addEventListener('click', () => this.testN8nConnection());
        document.getElementById('testNeo4jConnection').addEventListener('click', () => this.testNeo4jConnection());

        // Logout
        document.getElementById('logoutButton').addEventListener('click', () => window.AuthManager.logout());

        // Graph View
        document.getElementById('graphViewBtn').addEventListener('click', () => this.openGraphView());
        document.getElementById('closeGraphView').addEventListener('click', () => this.closeGraphView());
        document.getElementById('executeQuery').addEventListener('click', () => this.executeGraphQuery());
        document.getElementById('refreshGraph').addEventListener('click', () => this.refreshGraph());
        document.getElementById('clearGraph').addEventListener('click', () => this.clearGraph());
        document.getElementById('stabilizeGraph').addEventListener('click', () => this.stabilizeGraph());
        document.getElementById('toggleAutoRefresh').addEventListener('click', () => this.toggleGraphAutoRefresh());

        // Workflow monitoring
        this.workflowSelect.addEventListener('change', (e) => this.handleWorkflowChange(e));
        document.getElementById('refreshWorkflows').addEventListener('click', () => this.loadWorkflows());

        // Node logs modal
        document.getElementById('closeNodeLogs').addEventListener('click', () => this.closeNodeLogsModal());
        this.nodeLogsModal.addEventListener('click', (e) => {
            if (e.target === this.nodeLogsModal) {
                this.closeNodeLogsModal();
            }
        });

        // Copy buttons
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleCopyClick(e));
        });

        // Close modal on outside click
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.closeSettings();
            }
        });

        // Sidebar toggles
        document.getElementById('sidebarToggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('executionPanelToggle').addEventListener('click', () => this.toggleExecutionPanel());
    }

    setupTextareaAutoResize() {
        this.chatInput.addEventListener('input', () => {
            this.chatInput.style.height = 'auto';
            this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 150) + 'px';
        });
    }

    setupN8NMonitoring() {
        n8nManager.onExecutionUpdate((execution) => {
            this.updateExecutionDisplay(execution);
        });
    }

    // ==================== Workflow Monitoring ====================

    async setupWorkflowMonitoring() {
        await this.loadWorkflows();
    }

    async loadWorkflows() {
        try {
            const workflows = await n8nManager.getWorkflows();
            this.workflowSelect.innerHTML = '<option value="">Select a workflow...</option>';

            workflows.forEach(workflow => {
                const option = document.createElement('option');
                option.value = workflow.id;
                option.textContent = workflow.name;
                this.workflowSelect.appendChild(option);
            });

            console.log('✅ Loaded', workflows.length, 'workflows');
        } catch (error) {
            console.error('Failed to load workflows:', error);
            this.workflowSelect.innerHTML = '<option value="">Error loading workflows</option>';
        }
    }

    async handleWorkflowChange(e) {
        this.selectedWorkflowId = e.target.value;

        // Clear executions refresh interval
        if (this.executionsRefreshInterval) {
            clearInterval(this.executionsRefreshInterval);
            this.executionsRefreshInterval = null;
        }

        if (!this.selectedWorkflowId) {
            this.executionsList.innerHTML = '<div class="execution-placeholder"><p>Select a workflow to monitor</p></div>';
            this.executionContent.innerHTML = '<div class="execution-placeholder"><p>No execution selected</p></div>';
            return;
        }

        console.log('📊 Monitoring workflow:', this.selectedWorkflowId);

        // Load executions immediately
        await this.loadExecutions();

        // Start auto-refresh every 2 seconds
        this.executionsRefreshInterval = setInterval(() => {
            this.loadExecutions();
        }, 2000);
    }

    async loadExecutions() {
        if (!this.selectedWorkflowId) return;

        try {
            const executions = await n8nManager.getExecutionsByWorkflow(this.selectedWorkflowId);

            if (executions.length === 0) {
                this.executionsList.innerHTML = '<div class="execution-placeholder"><p>No executions found</p></div>';
                return;
            }

            // Fetch detailed data for each execution
            const executionsWithData = await Promise.all(
                executions.map(async (exec) => {
                    const url = `${n8nManager.config.n8nUrl}/api/v1/executions/${exec.id}?includeData=true`;
                    const headers = {
                        'Content-Type': 'application/json'
                    };
                    if (n8nManager.config.apiKey) {
                        headers['X-N8N-API-KEY'] = n8nManager.config.apiKey;
                    }
                    try {
                        const response = await fetch(url, { headers });
                        if (response.ok) {
                            return await response.json();
                        }
                    } catch (e) {
                        console.error('Failed to fetch execution details:', exec.id);
                    }
                    return exec;
                })
            );

            // Update DOM while preserving collapse state
            this.updateExecutionsList(executionsWithData);

        } catch (error) {
            console.error('Failed to load executions:', error);
            this.executionsList.innerHTML = '<div class="execution-placeholder"><p>Error loading executions</p></div>';
        }
    }

    updateExecutionsList(executions) {
        const existingExecutions = {};
        document.querySelectorAll('.execution-group').forEach(group => {
            existingExecutions[group.dataset.executionId] = group.classList.contains('expanded');
        });

        this.executionsList.innerHTML = '';

        executions.forEach(execution => {
            const wasExpanded = existingExecutions[execution.id] !== undefined ? existingExecutions[execution.id] : true;
            this.addExecutionGroup(execution, wasExpanded);
        });
    }

    addExecutionGroup(execution, expanded = true) {
        const group = document.createElement('div');
        group.className = `execution-group ${expanded ? 'expanded' : ''}`;
        group.dataset.executionId = execution.id;

        const status = execution.finished ? (execution.data?.resultData?.error ? 'failed' : 'success') : 'running';
        const statusClass = status === 'running' ? 'status-running' : status === 'failed' ? 'status-error' : 'status-success';
        const timeAgo = this.getTimeAgo(new Date(execution.startedAt));

        // Execution header
        const header = document.createElement('div');
        header.className = 'execution-group-header';
        header.innerHTML = `
            <svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            <div class="execution-status ${statusClass}"></div>
            <div class="execution-group-info">
                <span class="execution-id">#${execution.id}</span>
                <span class="execution-status-text">${status === 'running' ? 'Running' : status === 'failed' ? 'Failed' : 'Success'}</span>
                <span class="execution-time">${timeAgo}</span>
            </div>
            ${status === 'failed' ? `
                <button class="fix-error-btn" data-execution-id="${execution.id}" title="Ask NOX to help fix this error">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                    </svg>
                    Fix Error
                </button>
            ` : ''}
        `;

        // Add click handler for expand/collapse (but not on the fix button)
        header.addEventListener('click', (e) => {
            if (!e.target.closest('.fix-error-btn')) {
                this.toggleExecutionGroup(execution.id);
            }
        });

        // Add fix error button handler if present
        if (status === 'failed') {
            const fixBtn = header.querySelector('.fix-error-btn');
            if (fixBtn) {
                fixBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.sendErrorToChat(execution);
                });
            }
        }

        // Nodes list
        const nodesList = document.createElement('div');
        nodesList.className = 'execution-nodes';

        if (execution.data?.resultData?.runData) {
            const runData = execution.data.resultData.runData;
            Object.keys(runData).forEach(nodeName => {
                const nodeRuns = runData[nodeName];
                if (nodeRuns && nodeRuns.length > 0) {
                    const lastRun = nodeRuns[nodeRuns.length - 1];
                    const nodeStatus = lastRun.error ? 'error' : execution.finished ? 'completed' : 'running';
                    nodesList.appendChild(this.createNodeItem(execution.id, nodeName, nodeStatus, lastRun));
                }
            });
        } else {
            nodesList.innerHTML = '<div class="node-placeholder">No node data available</div>';
        }

        group.appendChild(header);
        group.appendChild(nodesList);
        this.executionsList.appendChild(group);
    }

    createNodeItem(executionId, nodeName, status, nodeData) {
        const item = document.createElement('div');
        item.className = `node-item ${status}`;

        const executionTime = nodeData.executionTime ? `${nodeData.executionTime}ms` : 'N/A';
        const statusIcon = status === 'running' ? '⟳' : status === 'error' ? '✗' : '✓';

        item.innerHTML = `
            <span class="node-status-icon">${statusIcon}</span>
            <span class="node-name">${this.escapeHtml(nodeName)}</span>
            <span class="node-time">${executionTime}</span>
            <button class="node-view-btn" data-execution-id="${executionId}" data-node-name="${nodeName}">View</button>
        `;

        item.querySelector('.node-view-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showNodeLogs(executionId, nodeName, nodeData);
        });

        return item;
    }

    toggleExecutionGroup(executionId) {
        const group = document.querySelector(`.execution-group[data-execution-id="${executionId}"]`);
        if (group) {
            group.classList.toggle('expanded');
        }
    }

    getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    showNodeLogs(executionId, nodeName, nodeData) {
        document.getElementById('nodeLogsTitle').textContent = `${nodeName} (#${executionId})`;

        // Format input data
        const inputData = nodeData.data?.main?.[0] || nodeData.source?.[0] || [];
        document.getElementById('nodeInputData').textContent = JSON.stringify(inputData, null, 2);

        // Format output data
        const outputData = nodeData.data?.main?.[0] || [];
        document.getElementById('nodeOutputData').textContent = JSON.stringify(outputData, null, 2);

        // Format error data
        const errorSection = document.getElementById('nodeErrorSection');
        if (nodeData.error) {
            errorSection.style.display = 'block';
            document.getElementById('nodeErrorData').textContent = JSON.stringify(nodeData.error, null, 2);
        } else {
            errorSection.style.display = 'none';
        }

        // Execution metadata
        document.getElementById('nodeExecutionTime').textContent = nodeData.executionTime ? `${nodeData.executionTime}ms` : 'N/A';
        document.getElementById('nodeStartTime').textContent = nodeData.startTime ? new Date(nodeData.startTime).toLocaleString() : 'N/A';

        this.nodeLogsModal.classList.remove('hidden');
    }

    closeNodeLogsModal() {
        this.nodeLogsModal.classList.add('hidden');
    }

    handleCopyClick(e) {
        const btn = e.currentTarget;
        const targetId = btn.dataset.copyTarget;
        const targetEl = document.getElementById(targetId);

        if (targetEl) {
            navigator.clipboard.writeText(targetEl.textContent).then(() => {
                const originalText = btn.innerHTML;
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                }, 2000);
            });
        }
    }

    // ==================== Chat Management ====================

    renderChatList() {
        const chatList = document.getElementById('chatList');
        const chats = chatManager.getAllChats();

        chatList.innerHTML = chats.map(chat => `
            <div class="chat-item ${chat.id === chatManager.currentChatId ? 'active' : ''}" data-chat-id="${chat.id}">
                <span class="chat-item-title">${this.escapeHtml(chat.title)}</span>
                <button class="chat-item-delete" data-chat-id="${chat.id}" title="Delete chat">×</button>
            </div>
        `).join('');
    }

    handleChatListClick(e) {
        const chatItem = e.target.closest('.chat-item');
        const deleteBtn = e.target.closest('.chat-item-delete');

        if (deleteBtn) {
            e.stopPropagation();
            const chatId = deleteBtn.dataset.chatId;
            if (confirm('Delete this chat?')) {
                chatManager.deleteChat(chatId);
                this.renderChatList();
                this.loadCurrentChat();
            }
        } else if (chatItem) {
            const chatId = chatItem.dataset.chatId;
            chatManager.switchChat(chatId);
            this.renderChatList();
            this.loadCurrentChat();
        }
    }

    createNewChat() {
        chatManager.createNewChat();
        this.renderChatList();
        this.loadCurrentChat();
        this.chatInput.focus();
    }

    loadCurrentChat() {
        const messages = chatManager.getMessages();
        this.chatMessages.innerHTML = '';

        if (messages.length === 0) {
            this.addSystemMessage('Welcome to NOX.AI. How can I help you today?');
        } else {
            messages.forEach(msg => {
                this.displayMessage(msg);
            });
        }

        this.scrollToBottom();
    }

    // ==================== File Handling ====================

    handleFileSelect(e) {
        const newFiles = Array.from(e.target.files);
        this.files = [...this.files, ...newFiles];
        this.renderAttachedFiles();
        e.target.value = ''; // Reset input
    }

    renderAttachedFiles() {
        if (this.files.length === 0) {
            this.attachedFiles.style.display = 'none';
            return;
        }

        this.attachedFiles.style.display = 'flex';
        this.attachedFiles.innerHTML = this.files.map((file, index) => `
            <div class="attached-file">
                ${this.getFileIcon(file.type)} ${this.escapeHtml(file.name)}
                <button class="attached-file-remove" data-index="${index}">×</button>
            </div>
        `).join('');

        // Add remove handlers
        this.attachedFiles.querySelectorAll('.attached-file-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.files.splice(index, 1);
                this.renderAttachedFiles();
            });
        });
    }

    getFileIcon(type) {
        if (type.startsWith('image/')) return '🖼️';
        if (type === 'application/pdf') return '📄';
        if (type.includes('text')) return '📝';
        return '📎';
    }

    // ==================== Voice Recording ====================

    async toggleVoiceRecording() {
        if (!this.isRecording) {
            await this.startRecording();
        } else {
            this.stopRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
                this.files.push(audioFile);
                this.renderAttachedFiles();

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.voiceButton.classList.add('recording');
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check permissions.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.voiceButton.classList.remove('recording');
        }
    }

    // ==================== Messaging ====================

    async sendMessage() {
        const message = this.chatInput.value.trim();

        if (!message && this.files.length === 0) {
            return;
        }

        if (this.isProcessing) {
            return;
        }

        // Create message object
        const userMessage = {
            role: 'user',
            content: message,
            files: this.files.map(f => ({ name: f.name, type: f.type, size: f.size }))
        };

        // Display user message
        this.displayMessage(userMessage);
        chatManager.addMessage(userMessage);
        this.renderChatList();

        // Clear input
        this.chatInput.value = '';
        this.chatInput.style.height = 'auto';

        // Prepare files for upload
        const filesToSend = [...this.files];
        this.files = [];
        this.renderAttachedFiles();

        // Set processing state
        this.isProcessing = true;
        this.sendButton.disabled = true;

        // Show loading
        const loadingId = this.addLoadingIndicator();

        try {
            // Convert files to base64 if needed
            const fileData = await this.prepareFilesForUpload(filesToSend);

            // Send to n8n
            const response = await n8nManager.sendMessage(message, fileData);

            // Remove loading
            this.removeMessage(loadingId);

            // Handle different response formats from n8n
            let replyText = '';

            console.log('🔍 Processing response:', response);

            if (Array.isArray(response)) {
                // n8n returns array format: [{ "output": "..." }]
                const firstItem = response[0];
                replyText = firstItem?.output || firstItem?.message || firstItem?.reply ||
                           firstItem?.data?.output || firstItem?.data?.message ||
                           JSON.stringify(firstItem);
            } else if (typeof response === 'object') {
                // Check for nested data structure first: { success: true, data: { output: "..." } }
                if (response.data && typeof response.data === 'object') {
                    replyText = response.data.output || response.data.reply || response.data.message ||
                               JSON.stringify(response.data);
                } else {
                    // Direct structure: { "output": "..." }
                    replyText = response.output || response.reply || response.message ||
                               JSON.stringify(response);
                }
            } else {
                // Fallback: use response as-is
                replyText = String(response);
            }

            console.log('✅ Extracted reply text:', replyText);

            // Display response
            const assistantMessage = {
                role: 'assistant',
                content: replyText
            };

            this.displayMessage(assistantMessage);
            chatManager.addMessage(assistantMessage);
            this.renderChatList();

        } catch (error) {
            this.removeMessage(loadingId);
            const errorMessage = {
                role: 'system',
                content: `❌ ${this.formatError(error)}`
            };
            this.displayMessage(errorMessage);
            console.error('Send message error:', error);
        } finally {
            this.isProcessing = false;
            this.sendButton.disabled = false;
            this.chatInput.focus();
        }
    }

    async prepareFilesForUpload(files) {
        const fileData = [];

        for (const file of files) {
            if (file.type.startsWith('image/')) {
                // Convert image to base64
                const base64 = await this.fileToBase64(file);
                fileData.push({
                    name: file.name,
                    type: file.type,
                    data: base64
                });
            } else {
                // For other files, read as text or base64
                const content = await this.fileToBase64(file);
                fileData.push({
                    name: file.name,
                    type: file.type,
                    data: content
                });
            }
        }

        return fileData;
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    displayMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.role}-message`;

        if (message.role === 'system') {
            messageEl.innerHTML = `
                <div class="message-content">
                    ${this.escapeHtml(message.content)}
                    <button class="message-dismiss" aria-label="Dismiss message">×</button>
                </div>
            `;

            // Add dismiss handler
            setTimeout(() => {
                const dismissBtn = messageEl.querySelector('.message-dismiss');
                if (dismissBtn) {
                    dismissBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        messageEl.classList.add('dismissing');
                        setTimeout(() => messageEl.remove(), 300);
                    });
                }
            }, 100);
        } else {
            const avatar = this.getAvatarHTML(message.role);
            const role = message.role === 'user' ? 'You' : 'NOX.AI';

            let filesHtml = '';
            if (message.files && message.files.length > 0) {
                filesHtml = `<div style="margin-top: 8px; font-size: 13px; color: var(--text-tertiary);">
                    ${message.files.map(f => `${this.getFileIcon(f.type)} ${f.name}`).join(', ')}
                </div>`;
            }

            messageEl.innerHTML = `
                <div class="message-avatar">${avatar}</div>
                <div class="message-content">
                    <div class="message-role">${role}</div>
                    <div class="message-text">${this.formatMessageContent(message.content)}</div>
                    ${filesHtml}
                </div>
            `;
        }

        this.chatMessages.appendChild(messageEl);

        // Apply syntax highlighting and setup copy buttons
        this.highlightCode();
        this.setupCodeCopyButtons();

        this.scrollToBottom();
    }

    addSystemMessage(content) {
        this.displayMessage({ role: 'system', content });
    }

    addLoadingIndicator() {
        const loadingId = `loading_${Date.now()}`;
        const messageEl = document.createElement('div');
        messageEl.className = 'message assistant-message';
        messageEl.id = loadingId;

        messageEl.innerHTML = `
            <div class="message-avatar">${this.getAvatarHTML('assistant')}</div>
            <div class="message-content">
                <div class="message-role">NOX.AI</div>
                <div class="loading-indicator">
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                    <div class="loading-dot"></div>
                </div>
            </div>
        `;

        this.chatMessages.appendChild(messageEl);
        this.scrollToBottom();

        return loadingId;
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

    // ==================== Settings ====================

    openSettings() {
        // Load n8n config
        const n8nConfig = n8nManager.getConfig();
        document.getElementById('n8nUrl').value = n8nConfig.n8nUrl || '';
        document.getElementById('webhookUrl').value = n8nConfig.webhookUrl || '';
        document.getElementById('apiKey').value = n8nConfig.apiKey || '';

        // Load Neo4j config
        const neo4jConfig = neo4jManager.getConfig();
        document.getElementById('neo4jUrl').value = neo4jConfig.neo4jUrl || '';
        document.getElementById('neo4jUsername').value = neo4jConfig.neo4jUsername || '';
        document.getElementById('neo4jPassword').value = neo4jConfig.neo4jPassword || '';
        document.getElementById('neo4jDatabase').value = neo4jConfig.neo4jDatabase || 'neo4j';

        this.settingsModal.classList.remove('hidden');
    }

    closeSettings() {
        this.settingsModal.classList.add('hidden');
    }

    async saveSettings() {
        // Save n8n config
        const n8nConfig = {
            n8nUrl: document.getElementById('n8nUrl').value.trim(),
            webhookUrl: document.getElementById('webhookUrl').value.trim(),
            apiKey: document.getElementById('apiKey').value.trim()
        };
        await n8nManager.saveConfig(n8nConfig);

        // Save Neo4j config
        const neo4jConfig = {
            neo4jUrl: document.getElementById('neo4jUrl').value.trim(),
            neo4jUsername: document.getElementById('neo4jUsername').value.trim(),
            neo4jPassword: document.getElementById('neo4jPassword').value.trim(),
            neo4jDatabase: document.getElementById('neo4jDatabase').value.trim() || 'neo4j'
        };
        await neo4jManager.saveConfig(neo4jConfig);

        this.closeSettings();
        this.addSystemMessage('Settings saved successfully! All configurations are now encrypted.');
    }

    async testN8nConnection() {
        const statusEl = document.getElementById('n8nTestStatus');
        const n8nUrl = document.getElementById('n8nUrl').value.trim();
        const apiKey = document.getElementById('apiKey').value.trim();

        if (!n8nUrl) {
            this.updateConnectionStatus('n8nTestStatus', 'Please enter n8n URL', 'error');
            return;
        }

        this.updateConnectionStatus('n8nTestStatus', 'Testing n8n connection...', 'testing');

        try {
            // Test connection to n8n API
            const url = `${n8nUrl}/api/v1/workflows`;
            const headers = {};
            if (apiKey) {
                headers['X-N8N-API-KEY'] = apiKey;
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: headers,
                mode: 'cors'
            });

            if (response.ok) {
                this.updateConnectionStatus('n8nTestStatus', `✅ Connected successfully! (${response.status})`, 'success');
            } else {
                this.updateConnectionStatus('n8nTestStatus', `Connection failed: ${response.status} ${response.statusText}`, 'error');
            }
        } catch (error) {
            this.updateConnectionStatus('n8nTestStatus', `Connection error: ${error.message}`, 'error');
        }
    }

    async testNeo4jConnection() {
        const neo4jUrl = document.getElementById('neo4jUrl').value.trim();
        const username = document.getElementById('neo4jUsername').value.trim();
        const password = document.getElementById('neo4jPassword').value.trim();
        const database = document.getElementById('neo4jDatabase').value.trim() || 'neo4j';

        if (!neo4jUrl || !username || !password) {
            this.updateConnectionStatus('neo4jTestStatus', 'Please fill in all Neo4j fields', 'error');
            return;
        }

        // Check for Mixed Content issues (HTTP resource from HTTPS page)
        if (window.location.protocol === 'https:' && neo4jUrl.startsWith('http:')) {
            this.updateConnectionStatus('neo4jTestStatus',
                '⚠️ Mixed Content Error: Cannot load HTTP resource from HTTPS page. Change URL to use HTTPS.',
                'error');
            return;
        }

        this.updateConnectionStatus('neo4jTestStatus', 'Testing Neo4j connection via HTTP API...', 'testing');

        try {
            // Test connection via HTTP API
            const authHeader = 'Basic ' + btoa(`${username}:${password}`);

            const response = await fetch(neo4jUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader,
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    statements: [{
                        statement: 'RETURN 1 as test',
                        resultDataContents: ['row']
                    }]
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Check for Neo4j errors
            if (data.errors && data.errors.length > 0) {
                const error = data.errors[0];
                throw new Error(`${error.message} (${error.code})`);
            }

            // Verify result
            if (data.results && data.results[0] && data.results[0].data && data.results[0].data.length > 0) {
                this.updateConnectionStatus('neo4jTestStatus', `✅ Connected successfully! Database: ${database}`, 'success');
            } else {
                this.updateConnectionStatus('neo4jTestStatus', 'Connection established but unexpected response', 'error');
            }

        } catch (error) {
            console.error('Neo4j connection error:', error);
            this.updateConnectionStatus('neo4jTestStatus', `Connection error: ${error.message}`, 'error');
        }
    }

    updateConnectionStatus(elementId, message, type) {
        const statusEl = document.getElementById(elementId);
        statusEl.textContent = message;
        statusEl.className = 'connection-status';
        statusEl.style.display = 'flex';
        if (type) {
            statusEl.classList.add(type);
        }
    }

    // ==================== Graph View ====================

    openGraphView() {
        const config = neo4jManager.getConfig();

        // Check if Neo4j is configured
        if (!config.neo4jUrl || !config.neo4jUsername || !config.neo4jPassword) {
            this.addSystemMessage('⚠️ Neo4j not configured. Please configure Neo4j settings first.');
            this.openSettings();
            return;
        }

        // Set default database
        const dbSelect = document.getElementById('graphDatabase');
        dbSelect.value = config.neo4jDatabase || 'neo4j';

        // Clear previous query and status
        document.getElementById('cypherQuery').value = 'MATCH (n) RETURN n LIMIT 25';
        this.updateGraphStatus('Ready. Enter a Cypher query and click "Execute Query".');

        // Show modal
        document.getElementById('graphViewModal').classList.remove('hidden');
    }

    closeGraphView() {
        document.getElementById('graphViewModal').classList.add('hidden');

        // Stop auto-refresh if enabled
        if (this.graphAutoRefreshEnabled) {
            this.stopGraphPolling();
            this.graphAutoRefreshEnabled = false;
            const button = document.getElementById('toggleAutoRefresh');
            if (button) {
                button.classList.remove('active');
            }
        }

        // Clear the graph
        if (neo4jManager.viz) {
            neo4jManager.clearVisualization();
        }
    }

    async executeGraphQuery() {
        const query = document.getElementById('cypherQuery').value.trim();
        const database = document.getElementById('graphDatabase').value;

        if (!query) {
            this.updateGraphStatus('Please enter a Cypher query.', 'error');
            return;
        }

        try {
            this.updateGraphStatus('Executing query via HTTP API...', 'loading');

            // Initialize or update visualization
            if (!neo4jManager.network) {
                const result = await neo4jManager.initializeVisualization('graphCanvas', query);

                if (result.nodeCount === 0) {
                    this.updateGraphStatus(`Query executed but no nodes found. Try: MATCH (n) RETURN n LIMIT 10`, 'error');
                } else {
                    this.updateGraphStatus(`✅ Graph rendered: ${result.nodeCount} node(s), ${result.edgeCount} relationship(s) • Double-click nodes to expand`, 'success');
                    // Fit graph to view after short delay
                    setTimeout(() => neo4jManager.fit(), 500);
                }
            } else {
                const result = await neo4jManager.updateVisualization(query);

                if (result.nodeCount === 0) {
                    this.updateGraphStatus(`Query executed but no nodes found. Try a different query.`, 'error');
                } else {
                    this.updateGraphStatus(`✅ Graph updated: ${result.nodeCount} node(s), ${result.edgeCount} relationship(s)`, 'success');
                    // Fit graph to view after short delay
                    setTimeout(() => neo4jManager.fit(), 500);
                }
            }
        } catch (error) {
            console.error('Graph query error:', error);
            this.updateGraphStatus(`Error: ${error.message}`, 'error');
        }
    }

    async refreshGraph() {
        const query = document.getElementById('cypherQuery').value.trim();

        if (!query) {
            this.updateGraphStatus('Please enter a Cypher query first.', 'error');
            return;
        }

        // Clear and re-execute
        this.clearGraph();
        await this.executeGraphQuery();
    }

    clearGraph() {
        if (neo4jManager.network) {
            const result = neo4jManager.collapseAll();
            if (result) {
                this.updateGraphStatus(`✅ Collapsed to original query: ${result.nodeCount} node(s), ${result.edgeCount} relationship(s)`, 'success');
            } else {
                this.updateGraphStatus('No expanded nodes to collapse.', 'success');
            }
        }
    }

    stabilizeGraph() {
        if (neo4jManager.network) {
            neo4jManager.stabilize();
            this.updateGraphStatus('Stabilizing graph layout...', 'loading');
            setTimeout(() => {
                this.updateGraphStatus('Graph stabilized.', 'success');
            }, 2000);
        } else {
            this.updateGraphStatus('No graph to stabilize. Execute a query first.', 'error');
        }
    }

    /**
     * Toggle graph auto-refresh polling
     */
    toggleGraphAutoRefresh() {
        const button = document.getElementById('toggleAutoRefresh');

        if (this.graphAutoRefreshEnabled) {
            // Stop auto-refresh
            this.stopGraphPolling();
            button.classList.remove('active');
            this.graphAutoRefreshEnabled = false;
            this.updateGraphStatus('Auto-refresh disabled', 'success');
        } else {
            // Start auto-refresh
            const query = document.getElementById('cypherQuery').value.trim();
            if (!query) {
                this.updateGraphStatus('Please execute a query first before enabling auto-refresh', 'error');
                return;
            }

            this.startGraphPolling();
            button.classList.add('active');
            this.graphAutoRefreshEnabled = true;
            this.updateGraphStatus('🔄 Auto-refresh enabled (5s interval)', 'success');
        }
    }

    /**
     * Start graph polling with 5 second interval
     */
    startGraphPolling() {
        // Clear any existing interval
        this.stopGraphPolling();

        // Start new polling interval (5 seconds)
        this.graphPollingInterval = setInterval(async () => {
            try {
                const query = document.getElementById('cypherQuery').value.trim();
                if (query && neo4jManager.network) {
                    // Update silently without changing status
                    await neo4jManager.updateVisualization(query);
                    console.log('Graph auto-refreshed');
                }
            } catch (error) {
                console.error('Auto-refresh failed:', error);
                // Don't stop polling on single error
            }
        }, 5000);
    }

    /**
     * Stop graph polling
     */
    stopGraphPolling() {
        if (this.graphPollingInterval) {
            clearInterval(this.graphPollingInterval);
            this.graphPollingInterval = null;
        }
    }

    updateGraphStatus(message, type = '') {
        const statusEl = document.getElementById('graphStatus');
        statusEl.textContent = message;
        statusEl.className = 'graph-status';
        if (type) {
            statusEl.classList.add(type);
        }
    }

    // ==================== Utilities ====================

    /**
     * Format error messages for user display
     */
    formatError(error) {
        // Handle different error types
        if (!error) {
            return 'An unexpected error occurred. Please try again.';
        }

        // If it's a string, return it
        if (typeof error === 'string') {
            return error;
        }

        // Try to extract meaningful message
        if (error.message && error.message !== 'null' && error.message !== 'undefined') {
            return error.message;
        }

        if (error.error) {
            return typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
        }

        if (error.statusText) {
            return `${error.status || 'Error'}: ${error.statusText}`;
        }

        // Last resort - stringify but make it readable
        try {
            const str = JSON.stringify(error);
            if (str !== '{}' && str !== 'null') {
                return `Error: ${str}`;
            }
        } catch (e) {
            // Can't stringify
        }

        return 'An unexpected error occurred. Please check the console for details.';
    }

    getAvatarHTML(role) {
        if (role === 'user') {
            return '👤';
        }

        // NOX.AI logo SVG with silverish glow - matches login page
        return `<svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 4px rgba(200, 220, 255, 0.3));">
            <defs>
                <linearGradient id="nox-silver-${Date.now()}" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#e0e7ff;stop-opacity:1" />
                    <stop offset="30%" style="stop-color:#c7d2fe;stop-opacity:1" />
                    <stop offset="60%" style="stop-color:#a5b4fc;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#818cf8;stop-opacity:1" />
                </linearGradient>
                <filter id="nox-glow-${Date.now()}">
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            <path d="M50 10 L85 30 L85 70 L50 90 L15 70 L15 30 Z" stroke="url(#nox-silver-${Date.now()})" stroke-width="2" fill="rgba(165, 180, 252, 0.08)"/>
            <path d="M28 36 L28 64 M28 36 L42 64 M42 36 L42 64" stroke="url(#nox-silver-${Date.now()})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#nox-glow-${Date.now()})"/>
            <circle cx="58" cy="50" r="12" stroke="url(#nox-silver-${Date.now()})" stroke-width="5" fill="none" filter="url(#nox-glow-${Date.now()})"/>
            <path d="M70 36 L82 64 M82 36 L70 64" stroke="url(#nox-silver-${Date.now()})" stroke-width="5" stroke-linecap="round" filter="url(#nox-glow-${Date.now()})"/>
        </svg>`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatMessageContent(content) {
        let formatted = content;
        const codeBlocks = [];
        const inlineCodeBlocks = [];

        // Step 1: Extract and replace code blocks with placeholders
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'plaintext';
            const codeId = `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const wrapperId = `wrapper-${codeId}`;
            const escapedCode = this.escapeHtml(code.trim());

            // Count lines
            const lineCount = escapedCode.split('\n').length;
            const isLongCode = lineCount > 15;
            const collapsedClass = isLongCode ? 'collapsed' : '';

            const placeholder = `___CODE_BLOCK_${codeBlocks.length}___`;
            codeBlocks.push(`
                <div class="code-block-wrapper ${collapsedClass}" id="${wrapperId}">
                    <div class="code-block-header" onclick="document.getElementById('${wrapperId}').classList.toggle('collapsed')">
                        <div class="code-block-header-left">
                            <svg class="code-block-collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                            <div class="code-block-info">
                                <span class="code-block-lang">${language}</span>
                                <span class="code-block-lines">${lineCount} lines</span>
                            </div>
                        </div>
                        <button class="code-copy-btn" data-code-id="${codeId}" title="Copy code" onclick="event.stopPropagation()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Copy
                        </button>
                    </div>
                    <pre class="code-block" id="${codeId}"><code class="language-${language}">${escapedCode}</code></pre>
                </div>
            `);
            return placeholder;
        });

        // Step 2: Extract and replace inline code with placeholders
        formatted = formatted.replace(/`([^`]+)`/g, (match, code) => {
            const placeholder = `___INLINE_CODE_${inlineCodeBlocks.length}___`;
            inlineCodeBlocks.push(`<code class="inline-code">${this.escapeHtml(code)}</code>`);
            return placeholder;
        });

        // Step 3: Escape the remaining plain text content
        formatted = this.escapeHtml(formatted);

        // Step 4: Convert newlines to <br> in plain text
        formatted = formatted.replace(/\n/g, '<br>');

        // Step 5: Restore code blocks (they already have escaped content)
        codeBlocks.forEach((block, i) => {
            formatted = formatted.replace(`___CODE_BLOCK_${i}___`, block);
        });

        // Step 6: Restore inline code blocks
        inlineCodeBlocks.forEach((block, i) => {
            formatted = formatted.replace(`___INLINE_CODE_${i}___`, block);
        });

        return formatted;
    }

    highlightCode() {
        // Apply Prism.js syntax highlighting to all code blocks
        if (window.Prism) {
            Prism.highlightAll();
        }
    }

    setupCodeCopyButtons() {
        // Add click handlers to copy buttons
        document.querySelectorAll('.code-copy-btn').forEach(btn => {
            // Remove old listeners
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                const codeId = e.currentTarget.dataset.codeId;
                const codeBlock = document.getElementById(codeId);
                if (codeBlock) {
                    const code = codeBlock.textContent;
                    navigator.clipboard.writeText(code).then(() => {
                        const originalHTML = e.currentTarget.innerHTML;
                        e.currentTarget.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
                        e.currentTarget.classList.add('copied');
                        setTimeout(() => {
                            e.currentTarget.innerHTML = originalHTML;
                            e.currentTarget.classList.remove('copied');
                        }, 2000);
                    });
                }
            });
        });
    }

    /**
     * Send workflow error to chat for AI assistance
     */
    async sendErrorToChat(execution) {
        try {
            // Extract error details from execution
            const errorDetails = this.extractErrorDetails(execution);

            // Build error message for the AI
            let errorMessage = `🔧 **Workflow Execution Failed - Please Help Fix**\n\n`;
            errorMessage += `**Execution ID:** #${execution.id}\n`;
            errorMessage += `**Workflow ID:** ${execution.workflowId}\n`;
            errorMessage += `**Started:** ${new Date(execution.startedAt).toLocaleString()}\n\n`;

            if (errorDetails.mainError) {
                errorMessage += `**Main Error:**\n\`\`\`\n${errorDetails.mainError}\n\`\`\`\n\n`;
            }

            if (errorDetails.nodeErrors && errorDetails.nodeErrors.length > 0) {
                errorMessage += `**Node Errors:**\n`;
                errorDetails.nodeErrors.forEach(nodeError => {
                    errorMessage += `\n**${nodeError.nodeName}:**\n`;
                    errorMessage += `\`\`\`\n${nodeError.error}\n\`\`\`\n`;
                });
            }

            errorMessage += `\nPlease analyze this error and suggest how to fix it.`;

            // Set the input and send
            this.chatInput.value = errorMessage;
            await this.sendMessage();

        } catch (error) {
            console.error('Failed to send error to chat:', error);
            this.displayMessage({
                role: 'system',
                content: '❌ Failed to send error to chat. Please try again.'
            });
        }
    }

    /**
     * Extract error details from execution object
     */
    extractErrorDetails(execution) {
        const details = {
            mainError: null,
            nodeErrors: []
        };

        // Main error from resultData
        if (execution.data?.resultData?.error) {
            const error = execution.data.resultData.error;
            details.mainError = typeof error === 'string' ? error : JSON.stringify(error, null, 2);
        }

        // Node-specific errors
        if (execution.data?.resultData?.runData) {
            Object.entries(execution.data.resultData.runData).forEach(([nodeName, nodeData]) => {
                if (nodeData && nodeData[0]?.error) {
                    const error = nodeData[0].error;
                    details.nodeErrors.push({
                        nodeName,
                        error: error.message || JSON.stringify(error, null, 2)
                    });
                }
            });
        }

        return details;
    }

    /**
     * Toggle left sidebar (chat list)
     */
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        sidebar.classList.toggle('collapsed');

        // Save state to localStorage
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebar-collapsed', isCollapsed);
    }

    /**
     * Toggle right execution panel
     */
    toggleExecutionPanel() {
        const panel = document.getElementById('executionPanel');
        panel.classList.toggle('collapsed');

        // Save state to localStorage
        const isCollapsed = panel.classList.contains('collapsed');
        localStorage.setItem('execution-panel-collapsed', isCollapsed);
    }

    /**
     * Restore sidebar states from localStorage
     */
    restoreSidebarStates() {
        // Restore left sidebar state
        const sidebarCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
        if (sidebarCollapsed) {
            document.querySelector('.sidebar').classList.add('collapsed');
        }

        // Restore right panel state
        const panelCollapsed = localStorage.getItem('execution-panel-collapsed') === 'true';
        if (panelCollapsed) {
            document.getElementById('executionPanel').classList.add('collapsed');
        }
    }

}

// Initialize application
const app = new NOXApp();
