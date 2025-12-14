/**
 * Crypto Utilities for Secure Local Storage
 * Encrypts sensitive data before storing in localStorage
 */

class CryptoUtils {
    constructor() {
        // Generate or retrieve encryption key from session
        this.ensureEncryptionKey();
    }

    /**
     * Ensure we have an encryption key for this session
     */
    ensureEncryptionKey() {
        let keyData = sessionStorage.getItem('nox_enc_key');

        if (!keyData) {
            // Generate a new key for this session
            const randomBytes = new Uint8Array(32);
            crypto.getRandomValues(randomBytes);
            keyData = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
            sessionStorage.setItem('nox_enc_key', keyData);
        }
    }

    /**
     * Get the encryption key
     */
    async getKey() {
        const keyData = sessionStorage.getItem('nox_enc_key');
        const keyBytes = new Uint8Array(keyData.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

        return await crypto.subtle.importKey(
            'raw',
            keyBytes,
            'AES-GCM',
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt data
     */
    async encrypt(data) {
        try {
            const key = await this.getKey();
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encoder = new TextEncoder();
            const encoded = encoder.encode(JSON.stringify(data));

            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                encoded
            );

            // Combine IV and encrypted data
            const result = new Uint8Array(iv.length + encrypted.byteLength);
            result.set(iv, 0);
            result.set(new Uint8Array(encrypted), iv.length);

            // Convert to base64
            return btoa(String.fromCharCode(...result));
        } catch (error) {
            console.error('Encryption failed:', error);
            // Fallback: return unencrypted data as JSON (for compatibility)
            return JSON.stringify(data);
        }
    }

    /**
     * Decrypt data
     */
    async decrypt(encryptedData) {
        try {
            // Try to decrypt
            const key = await this.getKey();
            const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

            const iv = data.slice(0, 12);
            const encrypted = data.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                encrypted
            );

            const decoder = new TextDecoder();
            return JSON.parse(decoder.decode(decrypted));
        } catch (error) {
            // Fallback: try to parse as unencrypted JSON (for backward compatibility)
            try {
                return JSON.parse(encryptedData);
            } catch (e) {
                console.error('Decryption failed:', error);
                return null;
            }
        }
    }

    /**
     * Secure localStorage set
     */
    async setItem(key, value) {
        const encrypted = await this.encrypt(value);
        localStorage.setItem(key, encrypted);
    }

    /**
     * Secure localStorage get
     */
    async getItem(key) {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        return await this.decrypt(stored);
    }

    /**
     * Clear encryption key (on logout)
     */
    clearKey() {
        sessionStorage.removeItem('nox_enc_key');
    }

    /**
     * Remove item from encrypted storage
     */
    async removeItem(key) {
        localStorage.removeItem(key);
    }

    /**
     * Migrate all sensitive data to encrypted storage
     * This runs once to encrypt existing plain text data
     */
    async migrateAllData() {
        const sensitiveKeys = ['nox-chats', 'nox-n8n-config', 'nox-neo4j-config'];
        let migratedCount = 0;

        for (const key of sensitiveKeys) {
            const plainText = localStorage.getItem(key);
            if (plainText) {
                try {
                    // Try to parse as JSON to see if it's plain text
                    const parsed = JSON.parse(plainText);

                    // Check if it's actually plain text (not already encrypted)
                    if (parsed && typeof parsed === 'object') {
                        console.log(`🔄 Migrating ${key} to encrypted storage...`);
                        await this.setItem(key, parsed);
                        migratedCount++;
                        console.log(`✅ ${key} successfully encrypted`);
                    }
                } catch (e) {
                    // If it fails to parse as JSON, it might already be encrypted
                    // Try to decrypt it to verify
                    try {
                        await this.getItem(key);
                        // If decrypt works, it's already encrypted, skip
                    } catch (decryptError) {
                        console.warn(`⚠️ Could not migrate ${key}:`, e);
                    }
                }
            }
        }

        if (migratedCount > 0) {
            console.log(`✅ Migration complete: ${migratedCount} item(s) encrypted`);
        }

        return migratedCount;
    }
}

// Create global instance
window.CryptoUtils = new CryptoUtils();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.CryptoUtils;
}
