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

        // Execution panel toggle (removed - now permanent panel)
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
        `;
        header.addEventListener('click', () => this.toggleExecutionGroup(execution.id));

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
                content: `Error: ${error.message}`
            };
            this.displayMessage(errorMessage);
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
                </div>
            `;
        } else {
            const avatar = message.role === 'user' ? '👤' : '🤖';
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
            <div class="message-avatar">🤖</div>
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
        const config = n8nManager.getConfig();
        document.getElementById('n8nUrl').value = config.n8nUrl || '';
        document.getElementById('webhookUrl').value = config.webhookUrl || '';
        document.getElementById('apiKey').value = config.apiKey || '';
        this.settingsModal.classList.remove('hidden');
    }

    closeSettings() {
        this.settingsModal.classList.add('hidden');
    }

    saveSettings() {
        const config = {
            n8nUrl: document.getElementById('n8nUrl').value.trim(),
            webhookUrl: document.getElementById('webhookUrl').value.trim(),
            apiKey: document.getElementById('apiKey').value.trim()
        };

        n8nManager.saveConfig(config);
        this.closeSettings();
        this.addSystemMessage('Settings saved successfully!');
    }

    // ==================== Utilities ====================

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatMessageContent(content) {
        // Step 1: Escape the entire content first to prevent XSS
        let formatted = this.escapeHtml(content);

        // Step 2: Replace code blocks in the already-escaped content
        // The content is now safe, and we can inject HTML wrapper elements
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'plaintext';
            const codeId = `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            // Code is already escaped from step 1, so we don't escape again

            return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-block-lang">${language}</span><button class="code-copy-btn" data-code-id="${codeId}" title="Copy code"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>Copy</button></div><pre class="code-block" id="${codeId}"><code class="language-${language}">${code.trim()}</code></pre></div>`;
        });

        // Step 3: Replace inline code in the already-escaped content
        formatted = formatted.replace(/`([^`]+)`/g, (match, code) => {
            // Code is already escaped from step 1
            return `<code class="inline-code">${code}</code>`;
        });

        // Step 4: Convert newlines to <br>, but not inside code blocks
        const parts = formatted.split(/(<div class="code-block-wrapper">.*?<\/div>|<code class="inline-code">.*?<\/code>)/);
        formatted = parts.map((part, i) => {
            // Even indices are plain text, odd indices are code blocks
            if (i % 2 === 0) {
                return part.replace(/\n/g, '<br>');
            }
            return part;
        }).join('');

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
}

// Initialize application
const app = new NOXApp();
