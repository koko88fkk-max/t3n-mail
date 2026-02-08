/**
 * T3N Mail - Main Application
 * Version 3.0 - Maximum Performance Edition
 * 
 * Features:
 * - Multi-provider support
 * - Advanced error handling
 * - Performance optimizations
 * - Smart notifications
 * - Session persistence
 */

// ========================================
// Global Variables & State
// ========================================
let mailManager = null;
let timerInterval = null;
let timeRemaining = 600; // 10 minutes
let notificationSound = null;
let previousMessageCount = 0;
let isFirstLoad = true;
let connectionStatus = 'connecting';

// DOM Elements Cache
const elements = {};

// ========================================
// Initialization
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Cache DOM elements
        cacheElements();

        // Initialize notification sound
        initNotificationSound();

        // Initialize particles
        initParticles();

        // Initialize email service
        await initEmailService();

        // Setup event listeners
        setupEventListeners();

        // Start timer
        startTimer();

        // Animate stats
        animateStats();

        // Request notification permission
        requestNotificationPermission();

        // Hide loading screen
        setTimeout(() => {
            if (elements.loadingScreen) {
                elements.loadingScreen.classList.add('hidden');
            }
        }, 1500);

        connectionStatus = 'connected';
        console.log('[T3N Mail] Application initialized successfully');

    } catch (error) {
        console.error('[T3N Mail] Initialization error:', error);
        connectionStatus = 'error';

        // Still hide loading screen on error
        setTimeout(() => {
            if (elements.loadingScreen) {
                elements.loadingScreen.classList.add('hidden');
            }
            showToast('خطأ في التهيئة، جرب تحديث الصفحة', 5000);
        }, 2000);
    }
});

/**
 * Cache all DOM elements for performance
 */
function cacheElements() {
    const elementIds = [
        'loadingScreen', 'emailAddress', 'copyEmail', 'refreshEmail',
        'emailTimer', 'inboxEmpty', 'inboxList', 'refreshInbox',
        'navbar', 'navToggle', 'navMenu', 'emailModal', 'modalClose',
        'modalFrom', 'modalFromEmail', 'modalDate', 'modalSubject',
        'modalBody', 'toast', 'toastMessage'
    ];

    elementIds.forEach(id => {
        elements[id] = document.getElementById(id);
    });

    elements.faqItems = document.querySelectorAll('.faq-item');
    elements.navLinks = document.querySelectorAll('.nav-link');
    elements.modalOverlay = document.querySelector('.modal-overlay');
}

/**
 * Initialize notification sound
 */
function initNotificationSound() {
    notificationSound = {
        play: function () {
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                oscillator.frequency.value = 800;
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

                oscillator.start(audioCtx.currentTime);
                oscillator.stop(audioCtx.currentTime + 0.5);
            } catch (e) {
                // Audio not supported
            }
        }
    };
}

/**
 * Request notification permission
 */
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

/**
 * Show browser notification
 */
function showBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body: body,
                icon: 'assets/favicon.png',
                badge: 'assets/favicon.png',
                tag: 't3n-mail-notification',
                requireInteraction: false
            });
        } catch (e) {
            // Notification failed
        }
    }
}

/**
 * Initialize particles.js background
 */
function initParticles() {
    if (typeof particlesJS === 'undefined') return;

    particlesJS('particles-js', {
        particles: {
            number: { value: 50, density: { enable: true, value_area: 800 } },
            color: { value: '#ff6b9d' },
            shape: { type: 'circle' },
            opacity: {
                value: 0.3, random: true,
                anim: { enable: true, speed: 1, opacity_min: 0.1, sync: false }
            },
            size: {
                value: 3, random: true,
                anim: { enable: true, speed: 2, size_min: 0.1, sync: false }
            },
            line_linked: {
                enable: true, distance: 150,
                color: '#ff6b9d', opacity: 0.1, width: 1
            },
            move: {
                enable: true, speed: 1, direction: 'none',
                random: true, straight: false, out_mode: 'out', bounce: false
            }
        },
        interactivity: {
            detect_on: 'canvas',
            events: {
                onhover: { enable: true, mode: 'grab' },
                onclick: { enable: true, mode: 'push' },
                resize: true
            },
            modes: {
                grab: { distance: 140, line_linked: { opacity: 0.3 } },
                push: { particles_nb: 4 }
            }
        },
        retina_detect: true
    });
}

/**
 * Initialize email service with session restoration
 */
async function initEmailService() {
    // Create mail manager
    mailManager = new TempMailManager();

    // Initialize providers
    await mailManager.initialize();

    // Check for saved session
    const savedEmail = sessionStorage.getItem('t3n_email');
    const savedLogin = sessionStorage.getItem('t3n_login');
    const savedDomain = sessionStorage.getItem('t3n_domain');
    const savedTime = sessionStorage.getItem('t3n_time');
    const savedProvider = sessionStorage.getItem('t3n_provider');

    if (savedEmail && savedLogin && savedDomain && savedTime) {
        const elapsed = Math.floor((Date.now() - parseInt(savedTime)) / 1000);

        if (elapsed < 600) {
            // Restore session
            mailManager.email = savedEmail;
            mailManager.login = savedLogin;
            mailManager.domain = savedDomain;
            timeRemaining = 600 - elapsed;

            if (elements.emailAddress) {
                elements.emailAddress.value = savedEmail;
            }

            console.log('[T3N Mail] Session restored:', savedEmail);
        } else {
            // Session expired
            await createNewEmail();
        }
    } else {
        await createNewEmail();
    }

    // Start auto-refresh
    mailManager.startAutoRefresh(handleNewMessages, 3000);

    // Initial message check
    try {
        const messages = await mailManager.getMessages();
        handleNewMessages(messages);
        isFirstLoad = false;
    } catch (error) {
        console.error('[T3N Mail] Initial message check failed:', error);
    }
}

/**
 * Create new email and save session
 */
async function createNewEmail() {
    try {
        const email = await mailManager.createEmail();

        if (elements.emailAddress) {
            elements.emailAddress.value = email;
        }

        // Save to session storage
        saveSession();

        console.log('[T3N Mail] New email created:', email);
        return email;

    } catch (error) {
        console.error('[T3N Mail] Error creating email:', error);

        if (elements.emailAddress) {
            elements.emailAddress.value = 'خطأ - حاول مرة أخرى';
        }

        throw error;
    }
}

/**
 * Save current session to storage
 */
function saveSession() {
    if (!mailManager) return;

    sessionStorage.setItem('t3n_email', mailManager.email || '');
    sessionStorage.setItem('t3n_login', mailManager.login || '');
    sessionStorage.setItem('t3n_domain', mailManager.domain || '');
    sessionStorage.setItem('t3n_time', Date.now().toString());
    sessionStorage.setItem('t3n_provider', mailManager.getProviderName());
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Copy email button
    if (elements.copyEmail) {
        elements.copyEmail.addEventListener('click', copyEmail);
    }

    // Refresh email button
    if (elements.refreshEmail) {
        elements.refreshEmail.addEventListener('click', refreshEmail);
    }

    // Refresh inbox button
    if (elements.refreshInbox) {
        elements.refreshInbox.addEventListener('click', refreshInbox);
    }

    // Navbar scroll
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Mobile nav toggle
    if (elements.navToggle) {
        elements.navToggle.addEventListener('click', toggleMobileNav);
    }

    // Close mobile nav on outside click
    document.addEventListener('click', (e) => {
        if (elements.navMenu && elements.navToggle) {
            if (!elements.navMenu.contains(e.target) && !elements.navToggle.contains(e.target)) {
                closeMobileNav();
            }
        }
    });

    // Modal close
    if (elements.modalClose) {
        elements.modalClose.addEventListener('click', closeModal);
    }
    if (elements.modalOverlay) {
        elements.modalOverlay.addEventListener('click', closeModal);
    }

    // FAQ accordion
    if (elements.faqItems) {
        elements.faqItems.forEach(item => {
            const question = item.querySelector('.faq-question');
            if (question) {
                question.addEventListener('click', () => toggleFAQ(item));
            }
        });
    }

    // Smooth scroll for nav links
    if (elements.navLinks) {
        elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(link.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                    closeMobileNav();
                }
            });
        });
    }

    // CTA buttons
    document.querySelectorAll('a[href="#hero"]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('hero')?.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeMobileNav();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'c' && document.activeElement === elements.emailAddress) {
            copyEmail();
        }
    });

    // Double click to copy
    if (elements.emailAddress) {
        elements.emailAddress.addEventListener('dblclick', copyEmail);
    }

    // Visibility change - pause/resume
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (mailManager) mailManager.stopAutoRefresh();
        } else {
            if (mailManager) {
                mailManager.startAutoRefresh(handleNewMessages, 3000);
                refreshInbox();
            }
        }
    });

    // Before unload - save session
    window.addEventListener('beforeunload', saveSession);
}

// ========================================
// Email Functions
// ========================================

/**
 * Copy email to clipboard
 */
async function copyEmail() {
    const email = elements.emailAddress?.value;

    if (!email || email.includes('جاري') || email.includes('خطأ')) {
        showToast('انتظر حتى يتم إنشاء البريد');
        return;
    }

    try {
        await navigator.clipboard.writeText(email);
        showToast('تم نسخ البريد بنجاح! ✓');

        // Visual feedback
        if (elements.copyEmail) {
            elements.copyEmail.innerHTML = '<i class="fas fa-check"></i>';
            elements.copyEmail.style.background = 'var(--primary)';
            elements.copyEmail.style.borderColor = 'var(--primary)';

            setTimeout(() => {
                elements.copyEmail.innerHTML = '<i class="fas fa-copy"></i>';
                elements.copyEmail.style.background = '';
                elements.copyEmail.style.borderColor = '';
            }, 2000);
        }
    } catch (error) {
        // Fallback
        try {
            const textArea = document.createElement('textarea');
            textArea.value = email;
            textArea.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('تم نسخ البريد بنجاح! ✓');
        } catch (err) {
            showToast('فشل النسخ، انسخ يدوياً');
        }
    }
}

/**
 * Generate new email
 */
async function refreshEmail() {
    if (!elements.refreshEmail || !elements.emailAddress) return;

    // Disable button
    elements.refreshEmail.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    elements.refreshEmail.disabled = true;
    elements.emailAddress.value = 'جاري إنشاء بريد جديد...';

    try {
        if (mailManager) {
            mailManager.stopAutoRefresh();
        }

        const email = await mailManager.refreshEmail();
        elements.emailAddress.value = email;

        // Reset state
        timeRemaining = 600;
        previousMessageCount = 0;
        isFirstLoad = true;

        // Save session
        saveSession();

        // Clear inbox
        if (elements.inboxList) elements.inboxList.innerHTML = '';
        if (elements.inboxList) elements.inboxList.classList.remove('active');
        if (elements.inboxEmpty) elements.inboxEmpty.classList.remove('hidden');

        // Restart auto-refresh
        mailManager.startAutoRefresh(handleNewMessages, 3000);

        showToast(`تم إنشاء بريد جديد! (${mailManager.getProviderName()})`);
        isFirstLoad = false;

    } catch (error) {
        console.error('[T3N Mail] Refresh error:', error);
        showToast('خطأ في إنشاء البريد، حاول مرة أخرى');
    }

    elements.refreshEmail.innerHTML = '<i class="fas fa-rotate"></i>';
    elements.refreshEmail.disabled = false;
}

/**
 * Refresh inbox manually
 */
async function refreshInbox() {
    if (!elements.refreshInbox) return;

    const originalContent = elements.refreshInbox.innerHTML;
    elements.refreshInbox.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> تحديث';
    elements.refreshInbox.disabled = true;

    try {
        const messages = await mailManager.getMessages();
        handleNewMessages(messages);
        showToast('تم تحديث صندوق الوارد');
    } catch (error) {
        console.error('[T3N Mail] Inbox refresh error:', error);
        showToast('خطأ في التحديث');
    }

    elements.refreshInbox.innerHTML = originalContent;
    elements.refreshInbox.disabled = false;
}

/**
 * Handle new messages
 */
function handleNewMessages(messages) {
    if (!Array.isArray(messages)) return;

    if (messages.length > 0) {
        // Check for new messages
        if (!isFirstLoad && messages.length > previousMessageCount) {
            const newCount = messages.length - previousMessageCount;

            // Play sound
            if (notificationSound) notificationSound.play();

            // Browser notification
            showBrowserNotification('T3N Mail - رسالة جديدة', `لديك ${newCount} رسالة جديدة`);

            // Toast
            showToast(`وصلت ${newCount} رسالة جديدة! 📨`);
        }

        previousMessageCount = messages.length;

        if (elements.inboxEmpty) elements.inboxEmpty.classList.add('hidden');
        if (elements.inboxList) elements.inboxList.classList.add('active');

        renderMessages(messages);
    } else {
        if (elements.inboxEmpty) elements.inboxEmpty.classList.remove('hidden');
        if (elements.inboxList) elements.inboxList.classList.remove('active');
        previousMessageCount = 0;
    }
}

/**
 * Render messages in inbox
 */
function renderMessages(messages) {
    if (!elements.inboxList) return;

    elements.inboxList.innerHTML = messages.map((msg, index) => {
        const isNew = index === 0 && !isFirstLoad;
        const fromDisplay = escapeHtml(msg.from || 'مرسل غير معروف');
        const subjectDisplay = escapeHtml(msg.subject || 'بدون عنوان');

        return `
            <div class="inbox-item ${isNew ? 'new-message' : ''}" 
                 data-id="${msg.id}" 
                 onclick="openMessage('${msg.id}')">
                <div class="inbox-avatar">
                    <i class="fas fa-envelope${isNew ? '' : '-open'}"></i>
                </div>
                <div class="inbox-content">
                    <div class="inbox-from">
                        ${fromDisplay}
                        ${index === 0 ? '<span class="inbox-new-badge">جديد</span>' : ''}
                    </div>
                    <div class="inbox-subject">${subjectDisplay}</div>
                </div>
                <div class="inbox-time">${formatDate(msg.date)}</div>
            </div>
        `;
    }).join('');
}

/**
 * Open message in modal
 */
async function openMessage(messageId) {
    if (!elements.modal) return;

    // Show loading
    if (elements.modalFrom) elements.modalFrom.textContent = 'جاري التحميل...';
    if (elements.modalFromEmail) elements.modalFromEmail.textContent = '';
    if (elements.modalDate) elements.modalDate.textContent = '';
    if (elements.modalSubject) elements.modalSubject.textContent = '';
    if (elements.modalBody) {
        elements.modalBody.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
    }

    elements.modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
        const message = await mailManager.getMessage(messageId);

        if (message) {
            if (elements.modalFrom) {
                elements.modalFrom.textContent = extractName(message.from) || 'مرسل غير معروف';
            }
            if (elements.modalFromEmail) {
                elements.modalFromEmail.textContent = message.from || '';
            }
            if (elements.modalDate) {
                elements.modalDate.textContent = formatDate(message.date);
            }
            if (elements.modalSubject) {
                elements.modalSubject.textContent = message.subject || 'بدون عنوان';
            }
            if (elements.modalBody) {
                if (message.htmlBody) {
                    elements.modalBody.innerHTML = sanitizeHTML(message.htmlBody);
                } else if (message.textBody || message.body) {
                    elements.modalBody.innerHTML = `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(message.textBody || message.body)}</pre>`;
                } else {
                    elements.modalBody.innerHTML = '<p>لا يوجد محتوى</p>';
                }
            }
        } else {
            throw new Error('Message not found');
        }
    } catch (error) {
        console.error('[T3N Mail] Error opening message:', error);
        if (elements.modalBody) {
            elements.modalBody.innerHTML = '<p style="color:#ff4757;">خطأ في تحميل الرسالة</p>';
        }
    }
}

/**
 * Close modal
 */
function closeModal() {
    if (elements.modal) {
        elements.modal.classList.remove('active');
    }
    document.body.style.overflow = '';
}

// ========================================
// Timer Functions
// ========================================

/**
 * Start countdown timer
 */
function startTimer() {
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        timeRemaining--;

        if (timeRemaining <= 0) {
            refreshEmail();
            timeRemaining = 600;
        }

        updateTimerDisplay();
    }, 1000);

    updateTimerDisplay();
}

/**
 * Update timer display
 */
function updateTimerDisplay() {
    if (!elements.emailTimer) return;

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    elements.emailTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Color change for urgency
    if (timeRemaining <= 60) {
        elements.emailTimer.style.color = '#ff4757';
    } else if (timeRemaining <= 180) {
        elements.emailTimer.style.color = '#ffa502';
    } else {
        elements.emailTimer.style.color = '';
    }
}

// ========================================
// UI Functions
// ========================================

function handleScroll() {
    if (elements.navbar) {
        elements.navbar.classList.toggle('scrolled', window.scrollY > 50);
    }

    // Update active nav link
    const sections = document.querySelectorAll('section[id]');
    let current = '';

    sections.forEach(section => {
        if (window.scrollY >= section.offsetTop - 100) {
            current = section.getAttribute('id');
        }
    });

    if (elements.navLinks) {
        elements.navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
        });
    }
}

function toggleMobileNav() {
    if (elements.navToggle) elements.navToggle.classList.toggle('active');
    if (elements.navMenu) elements.navMenu.classList.toggle('active');
}

function closeMobileNav() {
    if (elements.navToggle) elements.navToggle.classList.remove('active');
    if (elements.navMenu) elements.navMenu.classList.remove('active');
}

function toggleFAQ(item) {
    const isActive = item.classList.contains('active');
    if (elements.faqItems) {
        elements.faqItems.forEach(faq => faq.classList.remove('active'));
    }
    if (!isActive) item.classList.add('active');
}

function showToast(message, duration = 3000) {
    if (!elements.toast || !elements.toastMessage) return;

    elements.toastMessage.textContent = message;
    elements.toast.classList.add('show');

    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, duration);
}

function animateStats() {
    const statNumbers = document.querySelectorAll('.stat-number[data-count]');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCount(entry.target, parseInt(entry.target.dataset.count));
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(stat => observer.observe(stat));
}

function animateCount(element, target) {
    let current = 0;
    const increment = target / 50;
    const stepTime = 40;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }

        if (current >= 1000000) {
            element.textContent = (current / 1000000).toFixed(1) + 'M+';
        } else if (current >= 1000) {
            element.textContent = (current / 1000).toFixed(0) + 'K+';
        } else {
            element.textContent = Math.floor(current).toLocaleString();
        }
    }, stepTime);
}

// ========================================
// Utility Functions
// ========================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeHTML(html) {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove dangerous elements
    temp.querySelectorAll('script, iframe, object, embed, form').forEach(el => el.remove());

    // Remove event handlers
    temp.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on') ||
                (attr.name === 'href' && attr.value.startsWith('javascript:'))) {
                el.removeAttribute(attr.name);
            }
        });
    });

    // Make links safe
    temp.querySelectorAll('a').forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
    });

    return temp.innerHTML;
}

function extractName(email) {
    if (!email) return null;
    const match = email.match(/^(.+?)\s*<.+>$/);
    if (match) return match[1].trim().replace(/^["']|["']$/g, '');
    return email.split('@')[0];
}

function formatDate(dateString) {
    if (!dateString) return 'الآن';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'الآن';

    const diff = Math.floor((Date.now() - date.getTime()) / 1000);

    if (diff < 0 || diff < 60) return 'الآن';
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    if (diff < 604800) return `منذ ${Math.floor(diff / 86400)} يوم`;

    return date.toLocaleDateString('ar-SA');
}

// Global functions
window.openMessage = openMessage;
window.copyEmail = copyEmail;
window.refreshEmail = refreshEmail;
window.refreshInbox = refreshInbox;

// Console branding
console.log('%c T3N Mail v3.0 ', 'background: linear-gradient(135deg, #ff6b9d 0%, #c44dff 100%); color: white; font-size: 20px; font-weight: bold; padding: 10px 20px; border-radius: 10px;');
console.log('%c Maximum Performance Edition ', 'color: #ff6b9d; font-size: 12px;');
