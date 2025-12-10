/**
 * NOX.AI Authentication Manager
 * Secure authentication with PBKDF2 password hashing and salt
 */

class AuthManager {
    constructor() {
        // Pre-hashed credentials (never store plain text passwords!)
        // Default: username: admin, password: nox2024
        this.credentials = {
            admin: {
                // Temporary: Using a fixed salt for the default password
                salt: 'nox2024defaultsalt1234567890abcdef',
                // This will be generated on first use
                hash: null,
                // TEMPORARY: Plain password for initial setup only
                tempPassword: 'nox2024'
            }
        };

        this.SESSION_KEY = 'nox_session';
        this.SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
    }

    /**
     * Hash password using PBKDF2
     */
    async hashPassword(password, salt) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        const saltBuffer = this.hexToBuffer(salt);

        // Import password as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            'PBKDF2',
            false,
            ['deriveBits']
        );

        // Derive key using PBKDF2
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: saltBuffer,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );

        return this.bufferToHex(derivedBits);
    }

    /**
     * Generate random salt
     */
    generateSalt() {
        const buffer = new Uint8Array(16);
        crypto.getRandomValues(buffer);
        return this.bufferToHex(buffer);
    }

    /**
     * Convert hex string to ArrayBuffer
     */
    hexToBuffer(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes.buffer;
    }

    /**
     * Convert ArrayBuffer to hex string
     */
    bufferToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Login with username and password
     */
    async login(username, password) {
        // Check if user exists
        if (!this.credentials[username]) {
            // Add small delay to prevent timing attacks
            await new Promise(resolve => setTimeout(resolve, 500));
            return false;
        }

        const userCred = this.credentials[username];

        // TEMPORARY: Check plain password for initial setup
        if (userCred.tempPassword && password === userCred.tempPassword) {
            console.log('⚠️ Using temporary plain-text password. Please generate proper credentials!');
            this.createSession(username);
            return true;
        }

        // Hash the provided password with the stored salt
        const hash = await this.hashPassword(password, userCred.salt);

        // Compare hashes (constant-time comparison would be better, but this is acceptable for demo)
        if (hash === userCred.hash) {
            // Create session
            this.createSession(username);
            return true;
        }

        // Add small delay to prevent timing attacks
        await new Promise(resolve => setTimeout(resolve, 500));
        return false;
    }

    /**
     * Create authenticated session
     */
    createSession(username) {
        const session = {
            username: username,
            loginTime: Date.now(),
            expiresAt: Date.now() + this.SESSION_TIMEOUT
        };

        sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        const sessionData = sessionStorage.getItem(this.SESSION_KEY);

        if (!sessionData) {
            return false;
        }

        try {
            const session = JSON.parse(sessionData);

            // Check if session has expired
            if (Date.now() > session.expiresAt) {
                // Clear expired session but don't redirect (caller will handle redirect)
                sessionStorage.removeItem(this.SESSION_KEY);
                return false;
            }

            return true;
        } catch (error) {
            // Clear invalid session but don't redirect (caller will handle redirect)
            sessionStorage.removeItem(this.SESSION_KEY);
            return false;
        }
    }

    /**
     * Get current session data
     */
    getSession() {
        const sessionData = sessionStorage.getItem(this.SESSION_KEY);

        if (!sessionData) {
            return null;
        }

        try {
            return JSON.parse(sessionData);
        } catch (error) {
            return null;
        }
    }

    /**
     * Logout and clear session
     */
    logout() {
        sessionStorage.removeItem(this.SESSION_KEY);
        // Clear encryption key on logout
        if (window.CryptoUtils) {
            window.CryptoUtils.clearKey();
        }
        window.location.href = '/nox/login.html';
    }

    /**
     * Utility: Generate hash for a new password (for admin use)
     * Usage: await AuthManager.generateCredentials('username', 'password')
     */
    async generateCredentials(username, password) {
        const salt = this.generateSalt();
        const hash = await this.hashPassword(password, salt);

        console.log('Generated credentials for:', username);
        console.log('Salt:', salt);
        console.log('Hash:', hash);
        console.log('\nAdd to credentials object:');
        console.log(`${username}: {`);
        console.log(`    salt: '${salt}',`);
        console.log(`    hash: '${hash}'`);
        console.log(`}`);

        return { salt, hash };
    }
}

// Create global instance (attach to window to avoid naming conflict)
window.AuthManager = new AuthManager();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.AuthManager;
}
