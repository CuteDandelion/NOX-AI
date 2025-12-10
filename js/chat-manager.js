/**
 * Chat Manager - Handles multiple chat sessions
 */

class ChatManager {
    constructor() {
        this.chats = [];
        this.currentChatId = null;
        this.ready = false;
        this.initialize();
    }

    async initialize() {
        await this.loadChats();
        this.init();
        this.ready = true;
    }

    init() {
        // Create default chat if none exist
        if (this.chats.length === 0) {
            this.createNewChat();
        } else {
            this.currentChatId = this.chats[0].id;
        }
    }

    /**
     * Load chats from encrypted storage
     */
    async loadChats() {
        if (window.CryptoUtils) {
            const stored = await window.CryptoUtils.getItem('nox-chats');
            if (stored) {
                this.chats = stored;
            }
        } else {
            // Fallback to unencrypted (for initial load before crypto-utils loads)
            const stored = localStorage.getItem('nox-chats');
            if (stored) {
                try {
                    this.chats = JSON.parse(stored);
                } catch (e) {
                    console.error('Failed to load chats:', e);
                    this.chats = [];
                }
            }
        }
    }

    /**
     * Save chats to encrypted storage
     */
    async saveChats() {
        if (window.CryptoUtils) {
            await window.CryptoUtils.setItem('nox-chats', this.chats);
        } else {
            // Fallback to unencrypted
            localStorage.setItem('nox-chats', JSON.stringify(this.chats));
        }
    }

    createNewChat() {
        const chat = {
            id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: 'New Chat',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.chats.unshift(chat);
        this.currentChatId = chat.id;
        this.saveChats();

        return chat;
    }

    getCurrentChat() {
        return this.chats.find(c => c.id === this.currentChatId);
    }

    switchChat(chatId) {
        const chat = this.chats.find(c => c.id === chatId);
        if (chat) {
            this.currentChatId = chatId;
            return chat;
        }
        return null;
    }

    deleteChat(chatId) {
        const index = this.chats.findIndex(c => c.id === chatId);
        if (index !== -1) {
            this.chats.splice(index, 1);

            // Switch to another chat if current was deleted
            if (chatId === this.currentChatId) {
                if (this.chats.length > 0) {
                    this.currentChatId = this.chats[0].id;
                } else {
                    this.createNewChat();
                }
            }

            this.saveChats();
            return true;
        }
        return false;
    }

    addMessage(message) {
        const chat = this.getCurrentChat();
        if (chat) {
            chat.messages.push({
                ...message,
                timestamp: new Date().toISOString()
            });

            // Update chat title based on first user message
            if (chat.messages.length === 1 && message.role === 'user') {
                chat.title = message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '');
            }

            chat.updatedAt = new Date().toISOString();
            this.saveChats();
        }
    }

    getMessages() {
        const chat = this.getCurrentChat();
        return chat ? chat.messages : [];
    }

    clearCurrentChat() {
        const chat = this.getCurrentChat();
        if (chat) {
            chat.messages = [];
            chat.title = 'New Chat';
            chat.updatedAt = new Date().toISOString();
            this.saveChats();
        }
    }

    getAllChats() {
        return this.chats;
    }
}

// Create global instance
const chatManager = new ChatManager();
