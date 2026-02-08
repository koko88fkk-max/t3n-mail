/**
 * T3N Mail - Advanced Multi-Provider Email API
 * Version 3.0 - Maximum Reliability Edition
 * 
 * Features:
 * - Multiple API providers with automatic fallback
 * - Smart retry logic with exponential backoff
 * - Connection health monitoring
 * - Request caching and deduplication
 * - Comprehensive error handling
 */

// ========================================
// Configuration
// ========================================
const CONFIG = {
    // Retry settings
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // ms
    RETRY_MULTIPLIER: 2,

    // Refresh settings
    DEFAULT_REFRESH_INTERVAL: 3000, // 3 seconds
    MIN_REFRESH_INTERVAL: 2000,
    MAX_REFRESH_INTERVAL: 10000,

    // Timeouts
    REQUEST_TIMEOUT: 10000, // 10 seconds

    // Cache
    CACHE_DURATION: 2000, // 2 seconds
};

// ========================================
// Utility Functions
// ========================================

/**
 * Sleep function for delays
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random string
 */
function generateRandomString(length = 10, includeNumbers = true) {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const chars = includeNumbers ? letters + numbers : letters;
    let result = '';

    // First character should be a letter (some services require this)
    result += letters[Math.floor(Math.random() * letters.length)];

    for (let i = 1; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

/**
 * Fetch with timeout and retry
 */
async function fetchWithRetry(url, options = {}, retries = CONFIG.MAX_RETRIES) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response;
    } catch (error) {
        clearTimeout(timeout);

        if (retries > 0 && !error.name?.includes('Abort')) {
            const delay = CONFIG.RETRY_DELAY * Math.pow(CONFIG.RETRY_MULTIPLIER, CONFIG.MAX_RETRIES - retries);
            await sleep(delay);
            return fetchWithRetry(url, options, retries - 1);
        }

        throw error;
    }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

// ========================================
// Provider: 1secmail (Primary - Most Reliable)
// ========================================
class SecMailProvider {
    constructor() {
        this.name = '1secmail';
        this.baseURL = 'https://www.1secmail.com/api/v1/';
        this.domains = [];
        this.isHealthy = true;
        this.lastHealthCheck = 0;
    }

    async checkHealth() {
        try {
            const response = await fetchWithRetry(`${this.baseURL}?action=getDomainList`, {}, 1);
            const domains = await response.json();
            this.isHealthy = Array.isArray(domains) && domains.length > 0;
            this.domains = domains || [];
            this.lastHealthCheck = Date.now();
            return this.isHealthy;
        } catch {
            this.isHealthy = false;
            return false;
        }
    }

    async getDomains() {
        if (this.domains.length === 0 || Date.now() - this.lastHealthCheck > 60000) {
            await this.checkHealth();
        }
        return this.domains.length > 0 ? this.domains : [
            '1secmail.com', '1secmail.org', '1secmail.net',
            'kzccv.com', 'qiott.com', 'wuuvo.com', 'icznn.com', 'vjuum.com'
        ];
    }

    async createEmail() {
        const domains = await this.getDomains();
        const login = generateRandomString(12);
        const domain = domains[Math.floor(Math.random() * domains.length)];
        return { login, domain, email: `${login}@${domain}` };
    }

    async getMessages(login, domain) {
        const response = await fetchWithRetry(
            `${this.baseURL}?action=getMessages&login=${login}&domain=${domain}`
        );
        return await response.json();
    }

    async getMessage(login, domain, id) {
        const response = await fetchWithRetry(
            `${this.baseURL}?action=readMessage&login=${login}&domain=${domain}&id=${id}`
        );
        return await response.json();
    }
}

// ========================================
// Provider: Mail.tm (Secondary - Good Compatibility)
// ========================================
class MailTmProvider {
    constructor() {
        this.name = 'mail.tm';
        this.baseURL = 'https://api.mail.tm';
        this.token = null;
        this.accountId = null;
        this.isHealthy = true;
    }

    async checkHealth() {
        try {
            const response = await fetchWithRetry(`${this.baseURL}/domains`, {}, 1);
            const data = await response.json();
            this.isHealthy = data['hydra:member']?.length > 0;
            return this.isHealthy;
        } catch {
            this.isHealthy = false;
            return false;
        }
    }

    async getDomains() {
        const response = await fetchWithRetry(`${this.baseURL}/domains`);
        const data = await response.json();
        return data['hydra:member']?.filter(d => d.isActive).map(d => d.domain) || [];
    }

    async createEmail() {
        const domains = await this.getDomains();
        if (domains.length === 0) throw new Error('No domains available');

        const login = generateRandomString(12);
        const domain = domains[Math.floor(Math.random() * domains.length)];
        const password = generateRandomString(16) + '!A1';
        const email = `${login}@${domain}`;

        // Create account
        const createResponse = await fetchWithRetry(`${this.baseURL}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: email, password })
        });

        const accountData = await createResponse.json();
        this.accountId = accountData.id;

        // Get token
        const tokenResponse = await fetchWithRetry(`${this.baseURL}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: email, password })
        });

        const tokenData = await tokenResponse.json();
        this.token = tokenData.token;

        return { login, domain, email, password, token: this.token };
    }

    async getMessages() {
        if (!this.token) return [];

        const response = await fetchWithRetry(`${this.baseURL}/messages`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        const data = await response.json();
        return data['hydra:member'] || [];
    }

    async getMessage(id) {
        if (!this.token) return null;

        const response = await fetchWithRetry(`${this.baseURL}/messages/${id}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });

        return await response.json();
    }
}

// ========================================
// Provider: Guerrilla Mail (Tertiary - Backup)
// ========================================
class GuerrillaMailProvider {
    constructor() {
        this.name = 'guerrillamail';
        this.baseURL = 'https://api.guerrillamail.com/ajax.php';
        this.sidToken = null;
        this.isHealthy = true;
    }

    async checkHealth() {
        try {
            const response = await fetchWithRetry(
                `${this.baseURL}?f=get_email_address&ip=127.0.0.1`,
                {}, 1
            );
            const data = await response.json();
            this.isHealthy = !!data.email_addr;
            return this.isHealthy;
        } catch {
            this.isHealthy = false;
            return false;
        }
    }

    async createEmail() {
        const response = await fetchWithRetry(
            `${this.baseURL}?f=get_email_address&ip=127.0.0.1&agent=T3N_Mail`
        );

        const data = await response.json();
        this.sidToken = data.sid_token;

        const [login, domain] = data.email_addr.split('@');
        return { login, domain, email: data.email_addr, sidToken: this.sidToken };
    }

    async getMessages() {
        if (!this.sidToken) return [];

        const response = await fetchWithRetry(
            `${this.baseURL}?f=check_email&seq=0&sid_token=${this.sidToken}`
        );

        const data = await response.json();
        return data.list || [];
    }

    async getMessage(id) {
        if (!this.sidToken) return null;

        const response = await fetchWithRetry(
            `${this.baseURL}?f=fetch_email&email_id=${id}&sid_token=${this.sidToken}`
        );

        return await response.json();
    }
}

// ========================================
// Main API Manager - Multi-Provider System
// ========================================
class TempMailManager {
    constructor() {
        // Initialize all providers
        this.providers = {
            secmail: new SecMailProvider(),
            mailtm: new MailTmProvider(),
            guerrilla: new GuerrillaMailProvider()
        };

        // Current state
        this.currentProvider = null;
        this.email = null;
        this.login = null;
        this.domain = null;
        this.messages = [];
        this.refreshInterval = null;
        this.messageCache = new Map();
        this.lastRefresh = 0;

        // Stats
        this.stats = {
            emailsCreated: 0,
            messagesReceived: 0,
            providerSwitches: 0
        };
    }

    /**
     * Initialize and find best provider
     */
    async initialize() {
        console.log('[T3N Mail] Initializing multi-provider system...');

        // Check all providers in order of preference
        const providerOrder = ['secmail', 'mailtm', 'guerrilla'];

        for (const providerName of providerOrder) {
            const provider = this.providers[providerName];
            console.log(`[T3N Mail] Checking ${provider.name}...`);

            try {
                const isHealthy = await provider.checkHealth();
                if (isHealthy) {
                    console.log(`[T3N Mail] ✓ ${provider.name} is healthy`);
                    this.currentProvider = provider;
                    break;
                } else {
                    console.log(`[T3N Mail] ✗ ${provider.name} unavailable`);
                }
            } catch (error) {
                console.log(`[T3N Mail] ✗ ${provider.name} error:`, error.message);
            }
        }

        if (!this.currentProvider) {
            // Fallback to secmail without health check
            this.currentProvider = this.providers.secmail;
            console.log('[T3N Mail] Using secmail as fallback');
        }

        return this.currentProvider;
    }

    /**
     * Create new email with automatic provider fallback
     */
    async createEmail() {
        if (!this.currentProvider) {
            await this.initialize();
        }

        const providerOrder = ['secmail', 'mailtm', 'guerrilla'];
        let lastError = null;

        for (const providerName of providerOrder) {
            const provider = this.providers[providerName];

            try {
                console.log(`[T3N Mail] Creating email with ${provider.name}...`);
                const result = await provider.createEmail();

                if (result && result.email && isValidEmail(result.email)) {
                    this.currentProvider = provider;
                    this.email = result.email;
                    this.login = result.login;
                    this.domain = result.domain;
                    this.messages = [];
                    this.messageCache.clear();
                    this.stats.emailsCreated++;

                    console.log(`[T3N Mail] ✓ Email created: ${this.email}`);
                    return this.email;
                }
            } catch (error) {
                console.log(`[T3N Mail] ✗ ${provider.name} failed:`, error.message);
                lastError = error;
                this.stats.providerSwitches++;
            }
        }

        // Ultimate fallback - generate local email
        this.login = generateRandomString(12);
        this.domain = '1secmail.com';
        this.email = `${this.login}@${this.domain}`;
        this.currentProvider = this.providers.secmail;

        console.log(`[T3N Mail] Using fallback email: ${this.email}`);
        return this.email;
    }

    /**
     * Get messages with caching
     */
    async getMessages() {
        // Prevent too frequent requests
        const now = Date.now();
        if (now - this.lastRefresh < CONFIG.CACHE_DURATION) {
            return this.messages;
        }
        this.lastRefresh = now;

        if (!this.currentProvider || !this.login || !this.domain) {
            return [];
        }

        try {
            let messages = [];

            if (this.currentProvider.name === '1secmail') {
                messages = await this.currentProvider.getMessages(this.login, this.domain);
            } else if (this.currentProvider.name === 'mail.tm') {
                messages = await this.currentProvider.getMessages();
            } else if (this.currentProvider.name === 'guerrillamail') {
                messages = await this.currentProvider.getMessages();
            }

            // Normalize message format
            this.messages = this.normalizeMessages(messages);
            return this.messages;

        } catch (error) {
            console.error('[T3N Mail] Error fetching messages:', error);
            return this.messages;
        }
    }

    /**
     * Normalize messages from different providers
     */
    normalizeMessages(messages) {
        if (!Array.isArray(messages)) return [];

        return messages.map(msg => {
            // Handle different provider formats
            return {
                id: msg.id || msg.mail_id || msg['@id']?.split('/').pop(),
                from: msg.from || msg.mail_from || msg.fromAddress,
                subject: msg.subject || msg.mail_subject || '(بدون عنوان)',
                date: msg.date || msg.mail_timestamp || msg.createdAt,
                preview: msg.textBody?.substring(0, 100) || msg.mail_excerpt || ''
            };
        });
    }

    /**
     * Get single message with caching
     */
    async getMessage(messageId) {
        // Check cache first
        if (this.messageCache.has(messageId)) {
            return this.messageCache.get(messageId);
        }

        if (!this.currentProvider) {
            return null;
        }

        try {
            let message = null;

            if (this.currentProvider.name === '1secmail') {
                message = await this.currentProvider.getMessage(this.login, this.domain, messageId);
            } else if (this.currentProvider.name === 'mail.tm') {
                message = await this.currentProvider.getMessage(messageId);
            } else if (this.currentProvider.name === 'guerrillamail') {
                message = await this.currentProvider.getMessage(messageId);
            }

            if (message) {
                // Normalize message format
                const normalized = {
                    id: message.id || messageId,
                    from: message.from || message.mail_from || message.fromAddress,
                    subject: message.subject || message.mail_subject || '(بدون عنوان)',
                    date: message.date || message.mail_timestamp || message.createdAt,
                    body: message.body || message.mail_body || message.text,
                    textBody: message.textBody || message.body || message.mail_body,
                    htmlBody: message.htmlBody || message.html || null,
                    attachments: message.attachments || []
                };

                // Cache the message
                this.messageCache.set(messageId, normalized);
                this.stats.messagesReceived++;

                return normalized;
            }
        } catch (error) {
            console.error('[T3N Mail] Error fetching message:', error);
        }

        return null;
    }

    /**
     * Refresh email (create new one)
     */
    async refreshEmail() {
        this.stopAutoRefresh();
        this.messages = [];
        this.messageCache.clear();
        return await this.createEmail();
    }

    /**
     * Start auto-refresh for messages
     */
    startAutoRefresh(callback, interval = CONFIG.DEFAULT_REFRESH_INTERVAL) {
        this.stopAutoRefresh();

        // Clamp interval
        interval = Math.max(CONFIG.MIN_REFRESH_INTERVAL,
            Math.min(interval, CONFIG.MAX_REFRESH_INTERVAL));

        this.refreshInterval = setInterval(async () => {
            try {
                const messages = await this.getMessages();
                if (callback) callback(messages);
            } catch (error) {
                console.error('[T3N Mail] Auto-refresh error:', error);
            }
        }, interval);

        console.log(`[T3N Mail] Auto-refresh started (${interval}ms)`);
    }

    /**
     * Stop auto-refresh
     */
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('[T3N Mail] Auto-refresh stopped');
        }
    }

    /**
     * Get available domains from current provider
     */
    async getAvailableDomains() {
        if (!this.currentProvider) {
            await this.initialize();
        }

        try {
            if (this.currentProvider.getDomains) {
                return await this.currentProvider.getDomains();
            }
        } catch (error) {
            console.error('[T3N Mail] Error fetching domains:', error);
        }

        return ['1secmail.com', '1secmail.org', '1secmail.net'];
    }

    /**
     * Get current email
     */
    getEmail() {
        return this.email;
    }

    /**
     * Get current provider name
     */
    getProviderName() {
        return this.currentProvider?.name || 'unknown';
    }

    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Check if service is ready
     */
    isReady() {
        return !!this.email && !!this.currentProvider;
    }
}

// ========================================
// Legacy API Compatibility Layer
// ========================================

// SecMailAPI for backward compatibility
class SecMailAPI {
    constructor() {
        this.manager = new TempMailManager();
        this.email = null;
        this.login = null;
        this.domain = null;
        this.messages = [];
        this.refreshInterval = null;
    }

    async createEmail() {
        await this.manager.initialize();
        this.email = await this.manager.createEmail();
        this.login = this.manager.login;
        this.domain = this.manager.domain;
        return this.email;
    }

    async getMessages() {
        this.messages = await this.manager.getMessages();
        return this.messages;
    }

    async getMessage(id) {
        return await this.manager.getMessage(id);
    }

    async refreshEmail() {
        this.email = await this.manager.refreshEmail();
        this.login = this.manager.login;
        this.domain = this.manager.domain;
        return this.email;
    }

    startAutoRefresh(callback, interval = 3000) {
        this.manager.startAutoRefresh(callback, interval);
    }

    stopAutoRefresh() {
        this.manager.stopAutoRefresh();
    }

    getEmail() {
        return this.email;
    }
}

// Export all APIs
window.TempMailManager = TempMailManager;
window.SecMailAPI = SecMailAPI;
window.SecMailProvider = SecMailProvider;
window.MailTmProvider = MailTmProvider;
window.GuerrillaMailProvider = GuerrillaMailProvider;

// Console branding
console.log('%c[T3N Mail API] v3.0 - Multi-Provider System Loaded',
    'color: #ff6b9d; font-weight: bold;');
