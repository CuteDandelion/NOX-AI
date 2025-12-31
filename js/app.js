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
        this.currentFilePreviewData = null; // Store file preview info for chat display

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
        this.scrollToBottomBtn = document.getElementById('scrollToBottomBtn');

        // Streaming state
        this.currentStreamController = null;

        // Streaming speed settings
        this.streamingSpeedOptions = {
            slow: 80,      // 80ms/word (~12 words/sec)
            normal: 40,    // 40ms/word (~25 words/sec)
            fast: 15,      // 15ms/word (~65 words/sec)
            instant: 0     // 0ms - immediate display
        };
        this.currentStreamingSpeed = localStorage.getItem('streaming-speed') || 'normal';

        // Initialize Chat Exporter
        this.chatExporter = new ChatExporter(chatManager);

        // Initialize Skills Library Manager
        this.skillLibraryManager = new SkillLibraryManager(neo4jManager);
        this.selectedSkillToEdit = null;
        this.selectedSkillToDelete = null;

        // Initialize Skill Prompting
        this.selectedSkillsForPrompt = [];
        this.skillSelectorSearchQuery = '';
        this.currentWizardSkill = null;

        // Initialize Autocomplete
        this.recentQueries = this.loadRecentQueries();
        this.slashCommands = [
            { command: '/create-skill', description: 'Create a new skill via chat' },
            { command: '/list-skills', description: 'List all available skills' },
            { command: '/export-chat', description: 'Export current conversation' },
            { command: '/use-skill', description: 'Use a skill for prompting' }
        ];

        // Setup event listeners
        this.setupEventListeners();
        this.setupScrollDetection();
        this.setupN8NMonitoring();
        this.setupWorkflowMonitoring();
        this.setupTextareaAutoResize();
        this.restoreSidebarStates();
        this.loadCurrentChat();
        this.initializeWelcomeScreen();
    }

    initializeWelcomeScreen() {
        const chatSection = document.querySelector('.chat-section');
        const messages = chatManager.getMessages();

        // Set initial state based on whether there are messages
        if (messages.length === 0) {
            chatSection.classList.add('centered');
            chatSection.classList.remove('bottom');
        } else {
            chatSection.classList.add('bottom');
            chatSection.classList.remove('centered');
            document.getElementById('welcomeScreen').classList.add('hidden');
        }

        // Collapse execution panel by default
        const executionPanel = document.getElementById('executionPanel');
        if (executionPanel && !executionPanel.classList.contains('collapsed')) {
            executionPanel.classList.add('collapsed');
        }
    }

    transitionToChatMode() {
        const chatSection = document.querySelector('.chat-section');
        const welcomeScreen = document.getElementById('welcomeScreen');

        chatSection.classList.remove('centered');
        chatSection.classList.add('bottom');

        setTimeout(() => {
            welcomeScreen.classList.add('hidden');
        }, 300);
    }

    transitionToWelcomeMode() {
        const chatSection = document.querySelector('.chat-section');
        const welcomeScreen = document.getElementById('welcomeScreen');

        welcomeScreen.classList.remove('hidden');
        chatSection.classList.remove('bottom');
        chatSection.classList.add('centered');
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

        // Scroll to bottom button
        this.scrollToBottomBtn.addEventListener('click', () => this.scrollToBottom(true));

        // Reset Chat
        document.getElementById('resetChatBtn').addEventListener('click', () => this.resetChat());

        // Streaming Speed
        this.setupStreamingSpeed();

        // Export Chat
        this.setupExportChat();

        // Skills Library
        this.setupSkillsLibrary();

        // Skill-Based Prompting
        this.setupSkillPrompting();

        // Autocomplete
        this.setupAutocomplete();

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
        document.getElementById('minimizeGraphWindow').addEventListener('click', () => this.minimizeGraphWindow());
        document.getElementById('maximizeGraphWindow').addEventListener('click', () => this.maximizeGraphWindow());
        document.getElementById('executeQuery').addEventListener('click', () => this.executeGraphQuery());
        document.getElementById('refreshGraph').addEventListener('click', () => this.refreshGraph());
        document.getElementById('clearGraph').addEventListener('click', () => this.clearGraph());
        document.getElementById('stabilizeGraph').addEventListener('click', () => this.stabilizeGraph());
        document.getElementById('toggleAutoRefresh').addEventListener('click', () => this.toggleGraphAutoRefresh());

        // Window dragging and resizing
        this.setupWindowDragResize();

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

        // Execution panel toggle
        document.getElementById('executionPanelToggle').addEventListener('click', () => this.toggleExecutionPanel());
    }

    setupTextareaAutoResize() {
        // Auto-resize textarea as user types, with max height of 200px
        const resizeTextarea = () => {
            // Save cursor position
            const start = this.chatInput.selectionStart;
            const end = this.chatInput.selectionEnd;

            this.chatInput.style.height = 'auto';
            const newHeight = Math.min(this.chatInput.scrollHeight, 200);
            this.chatInput.style.height = newHeight + 'px';

            // Restore cursor position
            this.chatInput.setSelectionRange(start, end);

            // Only force scrollTop to 0 if at max height
            if (this.chatInput.scrollHeight > 200) {
                this.chatInput.scrollTop = this.chatInput.scrollHeight;
            }
        };

        this.chatInput.addEventListener('input', resizeTextarea);
        this.chatInput.addEventListener('paste', resizeTextarea);

        // Initial call to set proper height
        resizeTextarea();
    }

    setupScrollDetection() {
        // Show/hide scroll-to-bottom button based on scroll position
        this.chatMessages.addEventListener('scroll', () => {
            const isNearBottom = this.chatMessages.scrollHeight - this.chatMessages.scrollTop - this.chatMessages.clientHeight < 100;

            if (isNearBottom) {
                this.scrollToBottomBtn.style.display = 'none';
            } else {
                this.scrollToBottomBtn.style.display = 'flex';
            }
        });
    }

    isNearBottom() {
        // Check if user is within 100px of bottom
        const threshold = 100;
        const scrollTop = this.chatMessages.scrollTop;
        const scrollHeight = this.chatMessages.scrollHeight;
        const clientHeight = this.chatMessages.clientHeight;

        return (scrollHeight - scrollTop - clientHeight) < threshold;
    }

    scrollToBottom(smooth = false) {
        if (smooth) {
            this.chatMessages.scrollTo({
                top: this.chatMessages.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
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

    // ==================== Streaming Speed ====================

    setupStreamingSpeed() {
        const speedButton = document.getElementById('streamSpeedButton');
        const speedMenu = document.getElementById('streamSpeedMenu');
        const speedOptions = speedMenu.querySelectorAll('.speed-option');

        // Update active state on load
        this.updateSpeedMenuActive();

        // Toggle menu on button click
        speedButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = speedMenu.style.display === 'block';
            speedMenu.style.display = isVisible ? 'none' : 'block';
        });

        // Speed option selection
        speedOptions.forEach(option => {
            option.addEventListener('click', () => {
                const speed = option.dataset.speed;
                this.setStreamingSpeed(speed);
                speedMenu.style.display = 'none';
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!speedButton.contains(e.target) && !speedMenu.contains(e.target)) {
                speedMenu.style.display = 'none';
            }
        });
    }

    setStreamingSpeed(speed) {
        if (this.streamingSpeedOptions[speed] !== undefined) {
            this.currentStreamingSpeed = speed;
            localStorage.setItem('streaming-speed', speed);
            this.updateSpeedMenuActive();
            console.log(`✨ Streaming speed set to: ${speed} (${this.streamingSpeedOptions[speed]}ms/word)`);
        }
    }

    updateSpeedMenuActive() {
        const speedOptions = document.querySelectorAll('.speed-option');
        speedOptions.forEach(option => {
            if (option.dataset.speed === this.currentStreamingSpeed) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }

    // ==================== Export Chat ====================

    setupExportChat() {
        const exportButton = document.getElementById('exportChatButton');
        const exportMenu = document.getElementById('exportChatMenu');

        if (!exportButton || !exportMenu) {
            console.warn('Export chat elements not found, skipping setup');
            return;
        }

        const exportOptions = exportMenu.querySelectorAll('.export-option');

        // Toggle menu on button click
        exportButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = exportMenu.style.display === 'block';
            exportMenu.style.display = isVisible ? 'none' : 'block';
        });

        // Export option selection
        exportOptions.forEach(option => {
            option.addEventListener('click', () => {
                const format = option.dataset.format;
                this.exportChat(format);
                exportMenu.style.display = 'none';
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (exportButton && exportMenu &&
                !exportButton.contains(e.target) && !exportMenu.contains(e.target)) {
                exportMenu.style.display = 'none';
            }
        });
    }

    exportChat(format) {
        try {
            this.chatExporter.export(format);
            this.addSystemMessage(`✅ Chat exported as ${format.toUpperCase()}`);
        } catch (error) {
            console.error('Export error:', error);
            this.addSystemMessage(`❌ Export failed: ${error.message}`);
        }
    }

    // ==================== Skills Library ====================

    setupSkillsLibrary() {
        const skillsLibraryBtn = document.getElementById('skillsLibraryBtn');
        const skillsLibraryWindow = document.getElementById('skillsLibraryWindow');
        const closeSkillsLibrary = document.getElementById('closeSkillsLibrary');
        const minimizeSkillsWindow = document.getElementById('minimizeSkillsWindow');
        const maximizeSkillsWindow = document.getElementById('maximizeSkillsWindow');
        const refreshSkills = document.getElementById('refreshSkills');
        const skillsSearch = document.getElementById('skillsSearch');
        const skillsCategoryFilter = document.getElementById('skillsCategoryFilter');

        // Open Skills Library
        skillsLibraryBtn.addEventListener('click', () => {
            skillsLibraryWindow.classList.remove('hidden');
            this.loadAndDisplaySkills();
        });

        // Close Skills Library
        closeSkillsLibrary.addEventListener('click', () => {
            skillsLibraryWindow.classList.add('hidden');
        });

        // Minimize window
        minimizeSkillsWindow.addEventListener('click', () => {
            skillsLibraryWindow.classList.toggle('minimized');
        });

        // Maximize window
        maximizeSkillsWindow.addEventListener('click', () => {
            skillsLibraryWindow.classList.toggle('maximized');
        });

        // Refresh skills
        refreshSkills.addEventListener('click', () => {
            this.loadAndDisplaySkills();
        });

        // Search functionality
        skillsSearch.addEventListener('input', (e) => {
            this.skillLibraryManager.searchQuery = e.target.value;
            this.renderSkills();
        });

        // Category filter
        skillsCategoryFilter.addEventListener('change', (e) => {
            this.skillLibraryManager.filterCategory = e.target.value;
            this.renderSkills();
        });

        // Setup modals
        this.setupEditSkillModal();
        this.setupDeleteSkillModal();

        // Note: Window dragging/resizing can be added via setupWindowDragResize() if needed
    }

    async loadAndDisplaySkills() {
        const skillsStatus = document.getElementById('skillsStatus');
        const skillsList = document.getElementById('skillsList');

        try {
            skillsStatus.textContent = 'Loading skills from Neo4j...';
            skillsList.innerHTML = '<div class="skills-placeholder"><p>Loading...</p></div>';

            await this.skillLibraryManager.loadSkills();

            // Update category filter
            this.updateCategoryFilter();

            // Render skills
            this.renderSkills();

            // Update stats
            this.updateSkillsStats();

            skillsStatus.textContent = `Loaded ${this.skillLibraryManager.skills.length} skills from Neo4j.`;
        } catch (error) {
            console.error('Load skills error:', error);
            skillsStatus.textContent = `Error: ${error.message}`;
            skillsList.innerHTML = `<div class="skills-placeholder"><p style="color: #ff6b6b;">Failed to load skills: ${error.message}</p></div>`;
        }
    }

    updateCategoryFilter() {
        const categoryFilter = document.getElementById('skillsCategoryFilter');
        const categories = this.skillLibraryManager.getCategories();

        // Keep "All Categories" and add others
        categoryFilter.innerHTML = '<option value="all">All Categories</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilter.appendChild(option);
        });
    }

    updateSkillsStats() {
        const stats = this.skillLibraryManager.getStats();

        document.getElementById('totalSkillsCount').textContent = stats.total;
        document.getElementById('totalUsageCount').textContent = stats.totalUsage;
        document.getElementById('categoriesCount').textContent = stats.byCategory.length;
    }

    renderSkills() {
        const skillsList = document.getElementById('skillsList');
        const filteredSkills = this.skillLibraryManager.getFilteredSkills();

        if (filteredSkills.length === 0) {
            skillsList.innerHTML = '<div class="skills-placeholder"><p>No skills found matching your criteria.</p></div>';
            return;
        }

        skillsList.innerHTML = '';

        filteredSkills.forEach(skill => {
            const skillCard = this.createSkillCard(skill);
            skillsList.appendChild(skillCard);
        });
    }

    createSkillCard(skill) {
        const card = document.createElement('div');
        card.className = 'skill-card';

        // Header with name and category
        const header = document.createElement('div');
        header.className = 'skill-card-header';

        const title = document.createElement('h4');
        title.className = 'skill-card-title';
        title.textContent = skill.name;

        const category = document.createElement('span');
        category.className = 'skill-card-category';
        category.textContent = skill.category || 'Uncategorized';

        header.appendChild(title);
        header.appendChild(category);

        // Description
        const description = document.createElement('p');
        description.className = 'skill-card-description';
        description.textContent = skill.description;

        // Triggers
        const triggersContainer = document.createElement('div');
        triggersContainer.className = 'skill-card-triggers';

        const triggers = Array.isArray(skill.triggers) ? skill.triggers : [];
        triggers.slice(0, 3).forEach(trigger => {
            const tag = document.createElement('span');
            tag.className = 'skill-trigger-tag';
            tag.textContent = trigger;
            triggersContainer.appendChild(tag);
        });

        if (triggers.length > 3) {
            const more = document.createElement('span');
            more.className = 'skill-trigger-tag';
            more.textContent = `+${triggers.length - 3} more`;
            triggersContainer.appendChild(more);
        }

        // Footer with meta and actions
        const footer = document.createElement('div');
        footer.className = 'skill-card-footer';

        const meta = document.createElement('div');
        meta.className = 'skill-card-meta';
        meta.textContent = `Used ${skill.usage_count || 0} times • v${skill.version || 1}`;

        const actions = document.createElement('div');
        actions.className = 'skill-card-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'skill-action-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openEditSkillModal(skill);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'skill-action-btn danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openDeleteSkillModal(skill);
        });

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        footer.appendChild(meta);
        footer.appendChild(actions);

        // Assemble card
        card.appendChild(header);
        card.appendChild(description);
        card.appendChild(triggersContainer);
        card.appendChild(footer);

        return card;
    }

    // ==================== Edit Skill Modal ====================

    setupEditSkillModal() {
        const modal = document.getElementById('editSkillModal');
        const closeBtn = document.getElementById('closeEditModal');
        const cancelBtn = document.getElementById('cancelEditSkill');
        const saveBtn = document.getElementById('saveEditSkill');

        // Close modal handlers
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            this.selectedSkillToEdit = null;
        });

        cancelBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            this.selectedSkillToEdit = null;
        });

        // Save changes
        saveBtn.addEventListener('click', () => this.saveSkillEdits());

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                this.selectedSkillToEdit = null;
            }
        });
    }

    openEditSkillModal(skill) {
        this.selectedSkillToEdit = skill;

        const modal = document.getElementById('editSkillModal');

        // Populate read-only fields
        document.getElementById('editSkillId').value = skill.id || '';
        document.getElementById('editSkillVersion').value = skill.version || 1;
        document.getElementById('editSkillUsageCount').value = skill.usage_count || 0;
        document.getElementById('editSkillCreatedAt').value = skill.created_at || '';
        document.getElementById('editSkillUpdatedAt').value = skill.updated_at || '';

        // Populate editable fields
        document.getElementById('editSkillName').value = skill.name || '';
        document.getElementById('editSkillDescription').value = skill.description || '';
        document.getElementById('editSkillCategory').value = skill.category || '';

        // Triggers array to comma-separated string
        const triggersStr = Array.isArray(skill.triggers) ? skill.triggers.join(', ') : '';
        document.getElementById('editSkillTriggers').value = triggersStr;

        // Workflow template - handle as JSON string
        let workflowStr = '';
        try {
            if (typeof skill.workflow_template === 'string') {
                // Parse and pretty-print if it's a JSON string
                const parsed = JSON.parse(skill.workflow_template);
                workflowStr = JSON.stringify(parsed, null, 2);
            } else if (skill.workflow_template && typeof skill.workflow_template === 'object') {
                // Pretty-print if it's already an object
                workflowStr = JSON.stringify(skill.workflow_template, null, 2);
            }
        } catch (error) {
            workflowStr = skill.workflow_template || '{}';
        }
        document.getElementById('editSkillWorkflow').value = workflowStr;

        // Parameters - handle as JSON string
        let parametersStr = '';
        try {
            if (typeof skill.parameters === 'string') {
                // Parse and pretty-print if it's a JSON string
                const parsed = JSON.parse(skill.parameters);
                parametersStr = JSON.stringify(parsed, null, 2);
            } else if (skill.parameters && typeof skill.parameters === 'object') {
                // Pretty-print if it's already an object
                parametersStr = JSON.stringify(skill.parameters, null, 2);
            }
        } catch (error) {
            parametersStr = skill.parameters || '{}';
        }
        document.getElementById('editSkillParameters').value = parametersStr;

        // Clear errors
        document.getElementById('editSkillErrors').style.display = 'none';
        document.getElementById('editSkillErrors').innerHTML = '';

        // Show modal
        modal.classList.remove('hidden');
    }

    async saveSkillEdits() {
        if (!this.selectedSkillToEdit) return;

        try {
            // Get form values
            const name = document.getElementById('editSkillName').value.trim();
            const description = document.getElementById('editSkillDescription').value.trim();
            const category = document.getElementById('editSkillCategory').value.trim();
            const triggersStr = document.getElementById('editSkillTriggers').value.trim();
            const workflowStr = document.getElementById('editSkillWorkflow').value.trim();
            const parametersStr = document.getElementById('editSkillParameters').value.trim();

            // Validate required fields
            if (!name) {
                this.showEditSkillErrors(['Skill name is required']);
                return;
            }

            if (!workflowStr) {
                this.showEditSkillErrors(['Workflow template is required']);
                return;
            }

            // Parse triggers (comma-separated to array)
            const triggers = triggersStr ? triggersStr.split(',').map(t => t.trim()).filter(t => t) : [];

            // Parse workflow template JSON
            let workflowTemplate;
            try {
                workflowTemplate = JSON.parse(workflowStr);
            } catch (e) {
                this.showEditSkillErrors([`Invalid Workflow Template JSON: ${e.message}`]);
                return;
            }

            // Parse parameters JSON
            let parameters;
            try {
                parameters = parametersStr ? JSON.parse(parametersStr) : {};
            } catch (e) {
                this.showEditSkillErrors([`Invalid Parameters JSON: ${e.message}`]);
                return;
            }

            // Prepare updates object
            const updates = {
                name,
                description,
                category,
                triggers,
                workflow_template: workflowTemplate,
                parameters
            };

            // Validate with skill library manager
            const validation = this.skillLibraryManager.validateSkill(updates);
            if (!validation.valid) {
                this.showEditSkillErrors(validation.errors);
                return;
            }

            // Update skill
            const updated = await this.skillLibraryManager.updateSkill(this.selectedSkillToEdit.id, updates);

            // Close modal
            document.getElementById('editSkillModal').classList.add('hidden');
            this.selectedSkillToEdit = null;

            // Reload and display skills
            this.renderSkills();
            this.updateSkillsStats();

            // Show success message
            this.addSystemMessage(`✅ Skill "${updates.name}" updated successfully (v${updated.version})`);

        } catch (error) {
            console.error('Save skill error:', error);
            this.showEditSkillErrors([error.message]);
        }
    }

    showEditSkillErrors(errors) {
        const errorsDiv = document.getElementById('editSkillErrors');
        errorsDiv.innerHTML = '<ul>' + errors.map(err => `<li>${err}</li>`).join('') + '</ul>';
        errorsDiv.style.display = 'block';
    }

    // ==================== Delete Skill Modal ====================

    setupDeleteSkillModal() {
        const modal = document.getElementById('deleteSkillModal');
        const closeBtn = document.getElementById('closeDeleteModal');
        const cancelBtn = document.getElementById('cancelDeleteSkill');
        const confirmBtn = document.getElementById('confirmDeleteSkill');

        // Close modal handlers
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            this.selectedSkillToDelete = null;
        });

        cancelBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            this.selectedSkillToDelete = null;
        });

        // Confirm delete
        confirmBtn.addEventListener('click', () => this.confirmDeleteSkill());

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                this.selectedSkillToDelete = null;
            }
        });
    }

    openDeleteSkillModal(skill) {
        this.selectedSkillToDelete = skill;

        const modal = document.getElementById('deleteSkillModal');
        const message = document.getElementById('deleteSkillMessage');

        message.textContent = `Are you sure you want to delete "${skill.name}"?`;

        modal.classList.remove('hidden');
    }

    async confirmDeleteSkill() {
        if (!this.selectedSkillToDelete) return;

        const skillName = this.selectedSkillToDelete.name;

        try {
            const success = await this.skillLibraryManager.deleteSkill(this.selectedSkillToDelete.id);

            if (success) {
                // Close modal
                document.getElementById('deleteSkillModal').classList.add('hidden');
                this.selectedSkillToDelete = null;

                // Reload and display skills
                this.updateCategoryFilter();
                this.renderSkills();
                this.updateSkillsStats();

                // Show success message
                this.addSystemMessage(`✅ Skill "${skillName}" deleted successfully`);
            } else {
                this.addSystemMessage(`❌ Failed to delete skill "${skillName}"`);
            }

        } catch (error) {
            console.error('Delete skill error:', error);
            this.addSystemMessage(`❌ Delete failed: ${error.message}`);
        }
    }

    // ==================== Skill-Based Prompting ====================

    setupSkillPrompting() {
        const skillSelectorButton = document.getElementById('skillSelectorButton');
        const skillSelectorMenu = document.getElementById('skillSelectorMenu');
        const skillSelectorSearch = document.getElementById('skillSelectorSearch');

        if (!skillSelectorButton || !skillSelectorMenu || !skillSelectorSearch) {
            console.warn('Skill prompting elements not found, skipping setup');
            return;
        }

        // Toggle skill selector menu
        skillSelectorButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = skillSelectorMenu.style.display === 'block';
            skillSelectorMenu.style.display = isVisible ? 'none' : 'block';

            if (!isVisible) {
                this.loadSkillsForSelector();
            }
        });

        // Search skills in selector
        skillSelectorSearch.addEventListener('input', (e) => {
            this.skillSelectorSearchQuery = e.target.value;
            this.renderSkillSelectorList();
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (skillSelectorButton && skillSelectorMenu &&
                !skillSelectorButton.contains(e.target) && !skillSelectorMenu.contains(e.target)) {
                skillSelectorMenu.style.display = 'none';
            }
        });

        // Setup parameter wizard modal
        this.setupParameterWizard();
    }

    async loadSkillsForSelector() {
        const skillSelectorList = document.getElementById('skillSelectorList');

        try {
            // Load skills if not already loaded
            if (this.skillLibraryManager.skills.length === 0) {
                skillSelectorList.innerHTML = '<div class="skill-selector-placeholder"><p>Loading...</p></div>';
                await this.skillLibraryManager.loadSkills();
            }

            this.renderSkillSelectorList();
        } catch (error) {
            console.error('Load skills for selector error:', error);
            skillSelectorList.innerHTML = '<div class="skill-selector-placeholder"><p style="color: #ff6b6b;">Failed to load skills</p></div>';
        }
    }

    renderSkillSelectorList() {
        const skillSelectorList = document.getElementById('skillSelectorList');
        const query = this.skillSelectorSearchQuery.toLowerCase();

        // Filter skills
        let skills = this.skillLibraryManager.skills;
        if (query) {
            skills = skills.filter(skill =>
                skill.name.toLowerCase().includes(query) ||
                skill.description.toLowerCase().includes(query) ||
                (skill.triggers && skill.triggers.some(t => t.toLowerCase().includes(query)))
            );
        }

        if (skills.length === 0) {
            skillSelectorList.innerHTML = '<div class="skill-selector-placeholder"><p>No skills found</p></div>';
            return;
        }

        skillSelectorList.innerHTML = '';

        skills.forEach(skill => {
            const item = document.createElement('div');
            item.className = 'skill-selector-item';

            const name = document.createElement('div');
            name.className = 'skill-selector-item-name';
            name.textContent = skill.name;

            const desc = document.createElement('div');
            desc.className = 'skill-selector-item-desc';
            desc.textContent = skill.description;

            const triggersContainer = document.createElement('div');
            triggersContainer.className = 'skill-selector-item-triggers';

            const triggers = Array.isArray(skill.triggers) ? skill.triggers : [];
            triggers.slice(0, 3).forEach(trigger => {
                const tag = document.createElement('span');
                tag.className = 'skill-selector-trigger';
                tag.textContent = trigger;
                triggersContainer.appendChild(tag);
            });

            item.appendChild(name);
            item.appendChild(desc);
            if (triggers.length > 0) {
                item.appendChild(triggersContainer);
            }

            // Click to select skill
            item.addEventListener('click', () => {
                this.selectSkill(skill);
            });

            skillSelectorList.appendChild(item);
        });
    }

    selectSkill(skill) {
        // Close selector menu
        document.getElementById('skillSelectorMenu').style.display = 'none';

        // Check if skill has parameters
        const parameters = this.extractParametersFromCypher(skill.cypher_template);

        if (parameters.length > 0) {
            // Open parameter wizard
            this.openParameterWizard(skill, parameters);
        } else {
            // Generate prompt directly (no parameters needed)
            this.generatePromptFromSkill(skill, {});
        }
    }

    extractParametersFromCypher(cypherTemplate) {
        // Extract $paramName from Cypher template
        const paramRegex = /\$(\w+)/g;
        const params = [];
        let match;

        while ((match = paramRegex.exec(cypherTemplate)) !== null) {
            const paramName = match[1];
            if (!params.find(p => p.name === paramName)) {
                params.push({
                    name: paramName,
                    required: true,
                    hint: `Value for ${paramName}`
                });
            }
        }

        return params;
    }

    // ==================== Parameter Wizard ====================

    setupParameterWizard() {
        const modal = document.getElementById('parameterWizardModal');
        const closeBtn = document.getElementById('closeWizardModal');
        const cancelBtn = document.getElementById('cancelWizard');
        const generateBtn = document.getElementById('generatePrompt');

        // Close modal handlers
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            this.currentWizardSkill = null;
        });

        cancelBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            this.currentWizardSkill = null;
        });

        // Generate prompt
        generateBtn.addEventListener('click', () => this.generatePromptFromWizard());

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                this.currentWizardSkill = null;
            }
        });
    }

    openParameterWizard(skill, parameters) {
        this.currentWizardSkill = skill;

        const modal = document.getElementById('parameterWizardModal');
        const skillNameEl = document.getElementById('wizardSkillName');
        const skillDescEl = document.getElementById('wizardSkillDescription');
        const formEl = document.getElementById('wizardParametersForm');

        skillNameEl.textContent = skill.name;
        skillDescEl.textContent = skill.description;

        // Build parameter form
        formEl.innerHTML = '';

        parameters.forEach(param => {
            const group = document.createElement('div');
            group.className = 'wizard-param-group';

            const label = document.createElement('label');
            label.className = 'wizard-param-label';
            label.textContent = param.name;
            if (param.required) {
                const required = document.createElement('span');
                required.className = 'required';
                required.textContent = '*';
                label.appendChild(required);
            }

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'wizard-param-input';
            input.id = `wizard-param-${param.name}`;
            input.placeholder = `Enter ${param.name}...`;
            input.required = param.required;

            if (param.hint) {
                const hint = document.createElement('div');
                hint.className = 'wizard-param-hint';
                hint.textContent = param.hint;
                group.appendChild(label);
                group.appendChild(input);
                group.appendChild(hint);
            } else {
                group.appendChild(label);
                group.appendChild(input);
            }

            formEl.appendChild(group);
        });

        modal.classList.remove('hidden');
    }

    generatePromptFromWizard() {
        if (!this.currentWizardSkill) return;

        const formEl = document.getElementById('wizardParametersForm');
        const inputs = formEl.querySelectorAll('.wizard-param-input');
        const paramValues = {};

        // Collect parameter values
        let isValid = true;
        inputs.forEach(input => {
            const paramName = input.id.replace('wizard-param-', '');
            const value = input.value.trim();

            if (input.required && !value) {
                input.style.borderColor = '#ff6b6b';
                isValid = false;
            } else {
                input.style.borderColor = '';
                paramValues[paramName] = value;
            }
        });

        if (!isValid) {
            return;
        }

        // Generate prompt
        this.generatePromptFromSkill(this.currentWizardSkill, paramValues);

        // Close modal
        document.getElementById('parameterWizardModal').classList.add('hidden');
        this.currentWizardSkill = null;
    }

    generatePromptFromSkill(skill, paramValues) {
        // Create a natural language prompt based on skill and parameters
        let prompt = `Using the "${skill.name}" skill: ${skill.description}`;

        if (Object.keys(paramValues).length > 0) {
            prompt += '\n\nParameters:';
            for (const [key, value] of Object.entries(paramValues)) {
                prompt += `\n- ${key}: ${value}`;
            }
        }

        // Set prompt in chat input
        const chatInput = document.getElementById('chatInput');
        chatInput.value = prompt;

        // Add skill chip
        this.addSkillChip(skill);

        // Auto-resize textarea
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';

        // Focus on input
        chatInput.focus();

        // Show success message
        this.addSystemMessage(`✨ Generated prompt for "${skill.name}" skill`);
    }

    addSkillChip(skill) {
        // Check if already added
        if (this.selectedSkillsForPrompt.find(s => s.id === skill.id)) {
            return;
        }

        this.selectedSkillsForPrompt.push(skill);
        this.renderSkillChips();
    }

    removeSkillChip(skillId) {
        this.selectedSkillsForPrompt = this.selectedSkillsForPrompt.filter(s => s.id !== skillId);
        this.renderSkillChips();
    }

    renderSkillChips() {
        const skillChipsContainer = document.getElementById('skillChips');

        if (this.selectedSkillsForPrompt.length === 0) {
            skillChipsContainer.style.display = 'none';
            return;
        }

        skillChipsContainer.style.display = 'flex';
        skillChipsContainer.innerHTML = '';

        this.selectedSkillsForPrompt.forEach(skill => {
            const chip = document.createElement('div');
            chip.className = 'skill-chip';

            const name = document.createElement('span');
            name.className = 'skill-chip-name';
            name.textContent = skill.name;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'skill-chip-remove';
            removeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeSkillChip(skill.id);
            });

            chip.appendChild(name);
            chip.appendChild(removeBtn);

            skillChipsContainer.appendChild(chip);
        });
    }

    // ==================== Autocomplete ====================

    setupAutocomplete() {
        const chatInput = document.getElementById('chatInput');
        const ghostText = document.getElementById('inlineGhostText');

        if (!chatInput || !ghostText) {
            console.warn('Autocomplete elements not found, skipping setup');
            return;
        }

        this.currentSuggestion = null;

        // Show inline ghost text on input
        chatInput.addEventListener('input', (e) => {
            this.updateInlineGhostText(e.target.value);
        });

        // Handle Tab to accept, Esc to dismiss
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && this.currentSuggestion) {
                e.preventDefault();
                this.acceptInlineSuggestion();
            } else if (e.key === 'Escape' && this.currentSuggestion) {
                e.preventDefault();
                this.clearInlineGhostText();
            }
        });

        // Load skills for trigger detection
        this.loadSkillsForAutocomplete();
    }

    async loadSkillsForAutocomplete() {
        try {
            if (this.skillLibraryManager.skills.length === 0) {
                await this.skillLibraryManager.loadSkills();
            }
        } catch (error) {
            console.error('Failed to load skills for autocomplete:', error);
        }
    }

    updateInlineGhostText(value) {
        const ghostText = document.getElementById('inlineGhostText');
        const chatInput = document.getElementById('chatInput');

        if (!value || value.trim() === '') {
            this.clearInlineGhostText();
            return;
        }

        let bestSuggestion = null;

        // Priority 1: Check for slash commands
        if (value.startsWith('/')) {
            const matchingCommand = this.slashCommands.find(cmd =>
                cmd.command.startsWith(value.toLowerCase()) && cmd.command !== value.toLowerCase()
            );

            if (matchingCommand) {
                bestSuggestion = {
                    type: 'command',
                    text: matchingCommand.command,
                    value: matchingCommand.command
                };
            }
        }

        // Priority 2: Check for skill triggers
        if (!bestSuggestion) {
            const lowerValue = value.toLowerCase();
            const matchingSkill = this.skillLibraryManager.skills.find(skill => {
                if (!skill.triggers) return false;
                return skill.triggers.some(trigger =>
                    trigger.toLowerCase().startsWith(lowerValue)
                );
            });

            if (matchingSkill) {
                // Find the matching trigger
                const matchingTrigger = matchingSkill.triggers.find(trigger =>
                    trigger.toLowerCase().startsWith(lowerValue)
                );

                if (matchingTrigger && matchingTrigger.toLowerCase() !== lowerValue) {
                    bestSuggestion = {
                        type: 'skill',
                        text: matchingTrigger,
                        value: matchingSkill,
                        isSkill: true
                    };
                }
            }
        }

        // Priority 3: Check for recent queries
        if (!bestSuggestion) {
            const lowerValue = value.toLowerCase();
            const matchingQuery = this.recentQueries.find(query =>
                query.toLowerCase().startsWith(lowerValue) && query.toLowerCase() !== lowerValue
            );

            if (matchingQuery) {
                bestSuggestion = {
                    type: 'recent',
                    text: matchingQuery,
                    value: matchingQuery
                };
            }
        }

        // Display ghost text if we have a suggestion
        if (bestSuggestion) {
            this.currentSuggestion = bestSuggestion;

            // Create ghost text with user input + suggestion
            const suggestionRemainder = bestSuggestion.text.substring(value.length);
            ghostText.innerHTML = `${value}<span class="ghost-suggestion">${suggestionRemainder}</span>`;
        } else {
            this.clearInlineGhostText();
        }
    }

    acceptInlineSuggestion() {
        if (!this.currentSuggestion) return;

        const chatInput = document.getElementById('chatInput');

        if (this.currentSuggestion.type === 'command') {
            // Handle slash commands
            this.handleSlashCommand(this.currentSuggestion.value);
        } else if (this.currentSuggestion.type === 'skill' && this.currentSuggestion.isSkill) {
            // Handle skill selection
            this.selectSkill(this.currentSuggestion.value);
            chatInput.value = '';
        } else {
            // Insert text suggestion
            chatInput.value = this.currentSuggestion.text;
        }

        // Auto-resize textarea
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';

        this.clearInlineGhostText();
        chatInput.focus();
    }

    clearInlineGhostText() {
        const ghostText = document.getElementById('inlineGhostText');
        if (ghostText) {
            ghostText.innerHTML = '';
        }
        this.currentSuggestion = null;
    }

    handleSlashCommand(command) {
        const chatInput = document.getElementById('chatInput');

        switch (command) {
            case '/create-skill':
                chatInput.value = 'Create a new skill with the following:\nName: \nDescription: \nCategory: \nTriggers: \nCypher Template: ';
                break;

            case '/list-skills':
                chatInput.value = 'List all available skills in the system';
                break;

            case '/export-chat':
                // Directly trigger export menu
                document.getElementById('exportChatButton').click();
                chatInput.value = '';
                return;

            case '/use-skill':
                // Directly trigger skill selector
                document.getElementById('skillSelectorButton').click();
                chatInput.value = '';
                return;

            default:
                chatInput.value = command + ' ';
        }

        // Auto-resize textarea
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    }

    loadRecentQueries() {
        try {
            const stored = localStorage.getItem('nox-ai-recent-queries');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to load recent queries:', error);
            return [];
        }
    }

    saveRecentQuery(query) {
        if (!query || query.trim() === '') return;

        // Remove if already exists
        this.recentQueries = this.recentQueries.filter(q => q !== query);

        // Add to beginning
        this.recentQueries.unshift(query);

        // Keep only last 20
        this.recentQueries = this.recentQueries.slice(0, 20);

        // Save to localStorage
        try {
            localStorage.setItem('nox-ai-recent-queries', JSON.stringify(this.recentQueries));
        } catch (error) {
            console.error('Failed to save recent queries:', error);
        }
    }

    // ==================== Chat Management ====================


    loadCurrentChat() {
        const messages = chatManager.getMessages();
        this.chatMessages.innerHTML = '';

        if (messages.length > 0) {
            messages.forEach(msg => {
                this.displayMessage(msg);
            });
        }

        this.scrollToBottom();
    }

    resetChat() {
        // Create new chat session
        chatManager.createNewChat();

        // Clear chat display
        this.chatMessages.innerHTML = '';

        // Clear attached files
        this.files = [];
        this.renderAttachedFiles();

        // Reset chat input
        this.chatInput.value = '';
        this.chatInput.style.height = 'auto';

        // Transition back to welcome screen
        this.transitionToWelcomeMode();

        // Focus on input
        this.chatInput.focus();

        // Scroll to bottom
        this.scrollToBottom();
    }

    // ==================== File Handling ====================

    async handleFileSelect(e) {
        const selectedFile = e.target.files[0];
        e.target.value = ''; // Reset input immediately

        if (!selectedFile) return;

        // Validate file
        const validation = this.validateFile(selectedFile);
        if (!validation.valid) {
            this.showFileError(validation.error);
            return;
        }

        // Replace previous file (only 1 at a time)
        this.files = [selectedFile];

        // Show loading state
        this.showFileLoading();

        // Generate preview based on file type
        try {
            await this.generateFilePreview(selectedFile);
        } catch (error) {
            console.error('Error generating preview:', error);
            this.showFileError('Unable to read file. Please try again.');
        }
    }

    validateFile(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB in bytes

        // Allowed file types
        const allowedTypes = {
            // Images
            'image/png': true,
            'image/jpeg': true,
            'image/jpg': true,
            'image/gif': true,
            'image/webp': true,
            // Documents
            'application/pdf': true,
            'text/plain': true,
            'text/html': true,
            'text/markdown': true,
            'application/json': true,
            'text/csv': true
        };

        // Check file type
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'txt', 'html', 'md', 'json', 'csv'];

        if (!allowedTypes[file.type] && !allowedExtensions.includes(fileExtension)) {
            return {
                valid: false,
                error: 'Invalid file type. Only images, PDFs, and text files are allowed.'
            };
        }

        // Check file size
        if (file.size > maxSize) {
            return {
                valid: false,
                error: `File size exceeds 10MB limit (${this.formatFileSize(file.size)} provided).`
            };
        }

        return { valid: true };
    }

    showFileLoading() {
        this.attachedFiles.style.display = 'block';
        this.attachedFiles.innerHTML = `
            <div class="file-preview-card" data-tooltip="Loading file...">
                <div class="file-loading-spinner">
                    <div class="spinner-icon"></div>
                </div>
            </div>
        `;
    }

    showFileError(errorMessage) {
        this.attachedFiles.style.display = 'block';
        this.attachedFiles.innerHTML = `
            <div class="file-error-card" data-error="${this.escapeHtml(errorMessage)}">
                <div class="file-error-icon">⚠️</div>
                <button class="file-error-close" id="closeFileError">×</button>
            </div>
        `;

        // Add close handler
        document.getElementById('closeFileError').addEventListener('click', () => {
            this.files = [];
            this.attachedFiles.style.display = 'none';
        });

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (this.files.length === 0) {
                this.attachedFiles.style.display = 'none';
            }
        }, 5000);
    }

    async generateFilePreview(file) {
        const fileInfo = this.getFileTypeInfo(file);

        // For images, generate thumbnail
        if (fileInfo.category === 'image') {
            const previewUrl = await this.readFileAsDataURL(file);
            this.renderFilePreview(file, fileInfo, previewUrl);
        } else {
            // For non-images, just show icon
            this.renderFilePreview(file, fileInfo, null);
        }
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));

            // For large files, track progress
            if (file.size > 5 * 1024 * 1024) { // > 5MB
                reader.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percentLoaded = Math.round((e.loaded / e.total) * 100);
                        this.updateLoadingProgress(percentLoaded);
                    }
                };
            }

            reader.readAsDataURL(file);
        });
    }

    updateLoadingProgress(percent) {
        const card = document.querySelector('.file-preview-card');
        if (card && percent > 0) {
            card.setAttribute('data-tooltip', `Loading... ${percent}%`);
            const spinner = card.querySelector('.file-loading-spinner');
            if (spinner) {
                spinner.innerHTML = `
                    <div class="spinner-icon"></div>
                    <div class="file-progress-bar">
                        <div class="file-progress-fill" style="width: ${percent}%"></div>
                    </div>
                `;
            }
        }
    }

    renderFilePreview(file, fileInfo, previewUrl) {
        this.attachedFiles.style.display = 'block';

        // Create tooltip text: "filename (size)"
        const tooltip = `${file.name} (${this.formatFileSize(file.size)})`;

        // Get file extension for badge
        const extension = file.name.split('.').pop().toUpperCase();

        // Store preview data for chat bubble display
        this.currentFilePreviewData = {
            previewUrl: previewUrl,
            fileInfo: fileInfo,
            extension: extension
        };

        let previewContent = '';
        if (previewUrl && fileInfo.category === 'image') {
            // Image thumbnail
            previewContent = `
                <div class="file-preview-thumbnail">
                    <img src="${previewUrl}" alt="${this.escapeHtml(file.name)}">
                </div>
            `;
        } else {
            // File type icon for non-images
            previewContent = `
                <div class="file-type-icon">${fileInfo.icon}</div>
            `;
        }

        this.attachedFiles.innerHTML = `
            <div class="file-preview-card" data-tooltip="${this.escapeHtml(tooltip)}">
                ${previewContent}
                <div class="file-type-badge">${extension}</div>
                <button class="file-preview-remove" id="removeFilePreview">×</button>
            </div>
        `;

        // Add remove handler
        document.getElementById('removeFilePreview').addEventListener('click', () => {
            this.files = [];
            this.attachedFiles.style.display = 'none';
        });
    }

    getFileTypeInfo(file) {
        const extension = file.name.split('.').pop().toLowerCase();

        // Images
        if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) {
            return { category: 'image', icon: '🖼️' };
        }

        // PDF
        if (file.type === 'application/pdf' || extension === 'pdf') {
            return { category: 'pdf', icon: '📄' };
        }

        // HTML
        if (file.type === 'text/html' || extension === 'html') {
            return { category: 'html', icon: '🌐' };
        }

        // JSON
        if (file.type === 'application/json' || extension === 'json') {
            return { category: 'json', icon: '📊' };
        }

        // CSV
        if (extension === 'csv') {
            return { category: 'csv', icon: '📈' };
        }

        // Markdown
        if (extension === 'md') {
            return { category: 'markdown', icon: '📝' };
        }

        // Plain text
        if (file.type.startsWith('text/') || extension === 'txt') {
            return { category: 'text', icon: '📝' };
        }

        // Default
        return { category: 'unknown', icon: '📎' };
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    renderAttachedFiles() {
        // This method is now handled by renderFilePreview
        // Kept for backwards compatibility
        if (this.files.length === 0) {
            this.attachedFiles.style.display = 'none';
        }
    }

    getFileIcon(type) {
        // Kept for backwards compatibility
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
            files: this.files.map(f => ({ name: f.name, type: f.type, size: f.size })),
            filePreview: this.currentFilePreviewData // Include preview data
        };

        // Display user message
        this.displayMessage(userMessage);
        chatManager.addMessage(userMessage);

        // Transition from welcome screen to chat mode if this is the first message
        const chatSection = document.querySelector('.chat-section');
        if (chatSection.classList.contains('centered')) {
            this.transitionToChatMode();
        }

        // Save to recent queries
        if (message) {
            this.saveRecentQuery(message);
        }

        // Clear input
        this.chatInput.value = '';
        this.chatInput.style.height = 'auto';

        // Prepare files for upload
        const filesToSend = [...this.files];
        this.files = [];
        this.currentFilePreviewData = null; // Clear preview data
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

            // Check for empty or null responses
            const cleanedReply = replyText.trim();
            if (!cleanedReply ||
                cleanedReply === 'null' ||
                cleanedReply === 'undefined' ||
                cleanedReply === '{}' ||
                cleanedReply === '[]' ||
                cleanedReply.match(/^{.*"message":\s*null.*}$/)) {

                // Display friendly error from NOX
                const errorMessage = {
                    role: 'assistant',
                    content: "I apologize, but I received an empty response from the workflow. This might be a configuration issue. Please check your n8n workflow to ensure it's returning a proper response."
                };
                await this.displayMessageWithStreaming(errorMessage);
                chatManager.addMessage(errorMessage);
                return;
            }

            // Display response with streaming effect
            const assistantMessage = {
                role: 'assistant',
                content: replyText
            };

            // Use streaming display for assistant messages
            await this.displayMessageWithStreaming(assistantMessage);
            chatManager.addMessage(assistantMessage);

        } catch (error) {
            this.removeMessage(loadingId);

            // Generate friendly error message from NOX
            const friendlyError = this.getFriendlyErrorMessage(error);

            const errorMessage = {
                role: 'assistant',
                content: friendlyError
            };
            await this.displayMessageWithStreaming(errorMessage);
            chatManager.addMessage(errorMessage);
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

    async displayMessageWithStreaming(message) {
        // Cancel any previous stream
        if (this.currentStreamController) {
            this.currentStreamController.cancel();
        }

        // Create message element
        const messageId = `msg-${Date.now()}`;
        const messageEl = document.createElement('div');
        messageEl.id = messageId;
        messageEl.className = `message ${message.role}-message`;

        // Use the same avatar method as regular displayMessage
        const avatar = this.getAvatarHTML(message.role);
        const role = message.role === 'user' ? 'You' : 'NOX.AI';

        // Create avatar and content structure
        messageEl.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-role">${role}</div>
                <div class="message-text" id="${messageId}-text"></div>
            </div>
        `;

        this.chatMessages.appendChild(messageEl);

        // Get the text container
        const textContainer = document.getElementById(`${messageId}-text`);

        // Extract code blocks and tables before streaming
        const { streamableText, blocks } = this.extractBlocks(message.content);

        // Stream controller
        const controller = {
            cancelled: false,
            cancel: () => {
                controller.cancelled = true;
            }
        };
        this.currentStreamController = controller;

        // Stream the text word by word
        await this.streamText(textContainer, streamableText, blocks, controller);

        // Apply syntax highlighting
        this.highlightCode();
        this.setupCodeCopyButtons();

        // Scroll to bottom
        this.scrollToBottom();

        // Clear stream controller
        this.currentStreamController = null;
    }

    extractBlocks(content) {
        // Extract code blocks and tables, replace with placeholders
        const blocks = [];
        let streamableText = content;

        // Extract code blocks
        streamableText = streamableText.replace(/```(\w+)?\n([\s\S]*?)```/g, (match) => {
            const placeholder = `__BLOCK_${blocks.length}__`;
            blocks.push({ type: 'code', content: match });
            return placeholder;
        });

        // Extract tables (markdown tables with | separators)
        streamableText = streamableText.replace(/(\|[^\n]+\|\n)+/g, (match) => {
            const placeholder = `__BLOCK_${blocks.length}__`;
            blocks.push({ type: 'table', content: match });
            return placeholder;
        });

        return { streamableText, blocks };
    }

    async streamText(container, text, blocks, controller) {
        const words = text.split(/(\s+)/); // Split by whitespace but keep the spaces
        let currentText = '';

        for (let i = 0; i < words.length; i++) {
            if (controller.cancelled) break;

            currentText += words[i];

            // Replace block placeholders with actual content
            let displayText = currentText;
            blocks.forEach((block, index) => {
                displayText = displayText.replace(`__BLOCK_${index}__`, block.content);
            });

            // Format and display
            container.innerHTML = this.formatMessageContent(displayText);

            // Auto-scroll during streaming (only if user is near bottom)
            if (this.isNearBottom()) {
                this.scrollToBottom();
            }

            // Delay between words (configurable speed)
            const delay = this.streamingSpeedOptions[this.currentStreamingSpeed] || 40;
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // Final display with all content
        let finalText = currentText;
        blocks.forEach((block, index) => {
            finalText = finalText.replace(`__BLOCK_${index}__`, block.content);
        });
        container.innerHTML = this.formatMessageContent(finalText);
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

            // Generate file preview HTML if present
            let filePreviewHTML = '';
            if (message.filePreview && message.role === 'user') {
                const { previewUrl, fileInfo, extension } = message.filePreview;

                let previewContent = '';
                if (previewUrl && fileInfo.category === 'image') {
                    previewContent = `<img src="${previewUrl}" alt="Attached file">`;
                } else {
                    previewContent = `<div class="message-file-preview-icon">${fileInfo.icon}</div>`;
                }

                filePreviewHTML = `
                    <div class="message-file-preview">
                        <div class="message-file-preview-card">
                            ${previewContent}
                            <div class="message-file-preview-badge">${extension}</div>
                        </div>
                    </div>
                `;
            }

            messageEl.innerHTML = `
                <div class="message-avatar">${avatar}</div>
                <div class="message-content">
                    <div class="message-role">${role}</div>
                    ${filePreviewHTML}
                    <div class="message-text">${this.formatMessageContent(message.content)}</div>
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
        const cypherQuery = document.getElementById('cypherQuery');
        cypherQuery.value = 'MATCH (n) RETURN n LIMIT 25';
        this.updateGraphStatus('Ready. Enter a Cypher query and click "Execute Query".');

        // Show floating window
        const floatingWindow = document.getElementById('graphFloatingWindow');
        floatingWindow.classList.remove('hidden');

        // Restore window position and size from localStorage
        this.restoreWindowState();

        // Reinforce attributes to prevent Edge autocomplete on graph query textarea
        cypherQuery.setAttribute('autocomplete', 'off');
        cypherQuery.setAttribute('data-form-type', 'other');
    }

    closeGraphView() {
        const floatingWindow = document.getElementById('graphFloatingWindow');
        floatingWindow.classList.add('hidden');

        // Save window state before closing
        this.saveWindowState();

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

        // Reinforce chat input attributes to prevent Edge autocomplete re-enabling
        this.chatInput.setAttribute('autocomplete', 'off');
        this.chatInput.setAttribute('data-form-type', 'other');
    }

    minimizeGraphWindow() {
        const floatingWindow = document.getElementById('graphFloatingWindow');
        floatingWindow.classList.toggle('minimized');
        this.saveWindowState();
    }

    maximizeGraphWindow() {
        const floatingWindow = document.getElementById('graphFloatingWindow');
        floatingWindow.classList.toggle('maximized');
        this.saveWindowState();
    }

    saveWindowState() {
        const floatingWindow = document.getElementById('graphFloatingWindow');
        const isMinimized = floatingWindow.classList.contains('minimized');
        const isMaximized = floatingWindow.classList.contains('maximized');

        const state = {
            left: floatingWindow.style.left || '40px',
            top: floatingWindow.style.top || '100px',
            width: floatingWindow.style.width || '800px',
            height: floatingWindow.style.height || '600px',
            minimized: isMinimized,
            maximized: isMaximized
        };

        localStorage.setItem('graph-window-state', JSON.stringify(state));
    }

    restoreWindowState() {
        const savedState = localStorage.getItem('graph-window-state');
        if (!savedState) return;

        try {
            const state = JSON.parse(savedState);
            const floatingWindow = document.getElementById('graphFloatingWindow');

            floatingWindow.style.left = state.left;
            floatingWindow.style.top = state.top;
            floatingWindow.style.width = state.width;
            floatingWindow.style.height = state.height;

            if (state.minimized) {
                floatingWindow.classList.add('minimized');
            }
            if (state.maximized) {
                floatingWindow.classList.add('maximized');
            }
        } catch (error) {
            console.error('Failed to restore window state:', error);
        }
    }

    setupWindowDragResize() {
        const floatingWindow = document.getElementById('graphFloatingWindow');
        const header = floatingWindow.querySelector('.floating-window-header');
        const windowBody = floatingWindow.querySelector('.floating-window-body');
        const resizeHandle = floatingWindow.querySelector('.window-resize-handle');

        let isDragging = false;
        let isResizing = false;
        let startX, startY, startLeft, startTop, startWidth, startHeight;

        const startDrag = (e) => {
            // Don't drag if maximized
            if (floatingWindow.classList.contains('maximized')) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = floatingWindow.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;

            // Add visual feedback
            floatingWindow.style.cursor = 'move';
            document.body.style.cursor = 'move';
            document.body.style.userSelect = 'none';

            e.preventDefault();
        };

        // Dragging functionality - entire header is draggable
        header.addEventListener('mousedown', (e) => {
            // Don't drag if clicking on buttons or input elements
            if (e.target.closest('.window-control-btn') ||
                e.target.closest('button') ||
                e.target.closest('input') ||
                e.target.closest('select') ||
                e.target.closest('textarea')) {
                return;
            }

            startDrag(e);
        });

        // Also allow dragging from window body (except on interactive elements)
        windowBody.addEventListener('mousedown', (e) => {
            // Only drag if clicking on the background or non-interactive areas
            if (e.target === windowBody ||
                e.target.classList.contains('graph-canvas') ||
                e.target.classList.contains('floating-window-body')) {
                startDrag(e);
            }
        });

        // Resizing functionality
        resizeHandle.addEventListener('mousedown', (e) => {
            // Don't resize if maximized
            if (floatingWindow.classList.contains('maximized')) return;

            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = floatingWindow.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                let newLeft = startLeft + deltaX;
                let newTop = startTop + deltaY;

                // Keep window within viewport bounds (with some margin)
                const margin = 50;
                newLeft = Math.max(-floatingWindow.offsetWidth + margin, newLeft);
                newLeft = Math.min(window.innerWidth - margin, newLeft);
                newTop = Math.max(0, newTop);
                newTop = Math.min(window.innerHeight - margin, newTop);

                floatingWindow.style.left = `${newLeft}px`;
                floatingWindow.style.top = `${newTop}px`;
                floatingWindow.style.right = 'auto';
            } else if (isResizing) {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                const newWidth = Math.max(400, startWidth + deltaX);
                const newHeight = Math.max(300, startHeight + deltaY);

                floatingWindow.style.width = `${newWidth}px`;
                floatingWindow.style.height = `${newHeight}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging || isResizing) {
                this.saveWindowState();

                // Reset cursors
                floatingWindow.style.cursor = '';
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
            isDragging = false;
            isResizing = false;
        });
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
     * Get user-friendly error message from NOX's perspective
     */
    getFriendlyErrorMessage(error) {
        // Handle timeout errors
        if (error.name === 'AbortError' ||
            (error.message && error.message.includes('timeout'))) {
            return "I apologize, but the request timed out after 5 minutes. This might be a complex query or your workflow might be taking longer than expected. Please try again with a simpler request or check your n8n workflow.";
        }

        // Handle network/connection errors
        if (error.message && (
            error.message.includes('Failed to fetch') ||
            error.message.includes('NetworkError') ||
            error.message.includes('network'))) {
            return "I'm having trouble connecting to the n8n workflow. Please check your network connection and ensure the webhook URL is accessible.";
        }

        // Handle HTTP 500 errors
        if (error.message && error.message.includes('500')) {
            return "I encountered an internal server error (HTTP 500). This usually means there's an issue with your n8n workflow configuration. Please check the workflow for errors.";
        }

        // Handle HTTP 404 errors
        if (error.message && error.message.includes('404')) {
            return "The workflow endpoint could not be found (HTTP 404). Please verify your webhook URL in the settings.";
        }

        // Handle HTTP 401/403 errors
        if (error.message && (error.message.includes('401') || error.message.includes('403'))) {
            return "Authentication failed (HTTP 401/403). Please check your API key in the settings.";
        }

        // Handle configuration errors
        if (error.message && error.message.includes('not configured')) {
            return "The n8n webhook is not configured. Please set up your webhook URL in the settings.";
        }

        // Handle generic webhook errors
        if (error.message && error.message.includes('Webhook request failed')) {
            const match = error.message.match(/(\d{3})/);
            const statusCode = match ? match[1] : 'Unknown';
            return `I received an error response from the workflow (HTTP ${statusCode}). Please check your n8n workflow for issues.`;
        }

        // Default fallback - extract meaningful message
        if (error.message) {
            return `I encountered an error: ${error.message}. Please try again or check your workflow configuration.`;
        }

        return "I encountered an unexpected error. Please try again. If the problem persists, please check your n8n workflow configuration.";
    }

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

        // Step 1: Extract and replace code blocks with placeholders
        // (We need to do this before marked.js parses the content)
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || 'plaintext';
            const codeId = `code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const wrapperId = `wrapper-${codeId}`;
            const escapedCode = this.escapeHtml(code.trim());

            // Count lines
            const lineCount = escapedCode.split('\n').length;
            const isLongCode = lineCount > 15;
            const collapsedClass = isLongCode ? 'collapsed' : '';

            // Use HTML comment as placeholder so marked.js won't wrap it in <p> tags
            const placeholder = `<!--CODE_BLOCK_${codeBlocks.length}-->`;
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

        // Step 2: Use marked.js to parse the remaining markdown
        // This handles: tables, headers, bold, italic, lists, links, horizontal rules, etc.
        if (window.marked) {
            // Configure marked.js options
            marked.setOptions({
                breaks: true,        // Convert \n to <br>
                gfm: true,          // GitHub Flavored Markdown (includes tables)
                headerIds: false,   // Don't generate header IDs
                mangle: false,      // Don't mangle email addresses
                sanitize: false     // Don't sanitize HTML (we trust the content)
            });

            try {
                formatted = marked.parse(formatted);
            } catch (error) {
                console.error('Marked.js parsing error:', error);
                // Fallback: just escape HTML and convert newlines
                formatted = this.escapeHtml(formatted);
                formatted = formatted.replace(/\n/g, '<br>');
            }
        } else {
            // Fallback if marked.js is not loaded
            console.warn('Marked.js not loaded, using basic formatting');
            formatted = this.escapeHtml(formatted);
            formatted = formatted.replace(/\n/g, '<br>');
        }

        // Step 3: Restore code blocks with syntax highlighting
        codeBlocks.forEach((block, i) => {
            formatted = formatted.replace(`<!--CODE_BLOCK_${i}-->`, block);
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
        // Restore execution panel state
        const panelCollapsed = localStorage.getItem('execution-panel-collapsed') === 'true';
        if (panelCollapsed) {
            document.getElementById('executionPanel').classList.add('collapsed');
        }
    }

}

// Initialize application
const app = new NOXApp();
