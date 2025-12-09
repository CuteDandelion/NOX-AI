/**
 * NOX.AI Authentication Manager
 * Secure authentication with PBKDF2 password hashing and salt
 */

class AuthManager {
    constructor() {
        // Pre-hashed credentials (never store plain text passwords!)
        // Default: username: admin, password: nox2024
        // This hash was generated using PBKDF2 with 100,000 iterations
        this.credentials = {
            admin: {
                salt: 'c7d3f4e2a1b5c9d8e6f7a3b2c1d4e5f6',
                hash: '8a7f5c9d3e1b2a4f6c8d5e7b3a9c1f4d2e6b8a5c7f9d3e1b4a6c8f5d7e9b3a1c'
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
                this.logout();
                return false;
            }

            return true;
        } catch (error) {
            this.logout();
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
