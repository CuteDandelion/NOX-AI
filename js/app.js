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
        this.executionContent = document.getElementById('executionContent');
        this.settingsModal = document.getElementById('settingsModal');

        // Setup event listeners
        this.setupEventListeners();
        this.setupN8NMonitoring();
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

            if (Array.isArray(response)) {
                // n8n returns array format: [{ "output": "..." }]
                replyText = response[0]?.output || response[0]?.message || response[0]?.reply || JSON.stringify(response[0]);
            } else if (typeof response === 'object') {
                // n8n returns object format: { "reply": "..." } or { "output": "..." }
                replyText = response.output || response.reply || response.message || JSON.stringify(response);
            } else {
                // Fallback: use response as-is
                replyText = String(response);
            }

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
                    <div class="message-text">${this.escapeHtml(message.content)}</div>
                    ${filesHtml}
                </div>
            `;
        }

        this.chatMessages.appendChild(messageEl);
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

    // ==================== Execution Monitoring ====================

    updateExecutionDisplay(execution) {
        if (!execution || !this.executionContent) return;

        const placeholder = this.executionContent.querySelector('.execution-placeholder');
        if (placeholder) placeholder.remove();

        const { data, finished } = execution;
        if (!data || !data.resultData) return;

        this.executionContent.innerHTML = '';

        const runData = data.resultData.runData || {};

        Object.keys(runData).forEach((nodeName) => {
            const nodeData = runData[nodeName];
            if (!nodeData || nodeData.length === 0) return;

            const lastRun = nodeData[nodeData.length - 1];
            let nodeStatus = finished ? 'completed' : 'running';
            if (lastRun.error) nodeStatus = 'error';

            this.addExecutionNode(nodeName, nodeStatus, lastRun);
        });
    }

    addExecutionNode(nodeName, status, nodeData) {
        const nodeId = `node_${nodeName.replace(/\s+/g, '_')}`;
        const nodeEl = document.createElement('div');
        nodeEl.className = `execution-item ${status}`;

        const executionTime = nodeData.executionTime ? `${nodeData.executionTime}ms` : 'N/A';
        const startTime = nodeData.startTime ? new Date(nodeData.startTime).toLocaleTimeString() : 'N/A';

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
            </div>
        `;

        let logsHtml = '';
        if (nodeData.error) {
            logsHtml = `
                <div class="node-logs">
                    <div class="node-log-title">Error Details</div>
                    <div class="node-log-entry error">${this.escapeHtml(nodeData.error.message || 'Unknown error')}</div>
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

        const header = nodeEl.querySelector('.node-header');
        header.addEventListener('click', () => this.toggleNodeDetails(nodeId));

        this.executionContent.appendChild(nodeEl);
    }

    toggleNodeDetails(nodeId) {
        const details = document.getElementById(`${nodeId}_details`);
        const icon = document.querySelector(`[data-node-id="${nodeId}"] .node-expand-icon`);

        if (details && icon) {
            details.classList.toggle('expanded');
            icon.classList.toggle('expanded');
        }
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
}

// Initialize application
const app = new NOXApp();
