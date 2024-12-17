// Konfigurasi
const MAX_CONCURRENT_CHECKS = 5; // Batasi pengecekan bersamaan
const CHECK_TIMEOUT = 10000; // 10 detik timeout

// Theme switcher
let isDarkMode = true;

function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('light-theme');
    const themeIcon = document.querySelector('.theme-toggle i');
    themeIcon.className = isDarkMode ? 'fas fa-moon' : 'fas fa-sun';
    localStorage.setItem('darkMode', isDarkMode);
}

// Load saved theme
if (localStorage.getItem('darkMode') === 'false') {
    toggleTheme();
}

// Fungsi untuk mengecek domain menggunakan DNS
async function checkDNS(domain) {
    try {
        const response = await fetch(`https://dns.google/resolve?name=${domain}&type=A`);
        const data = await response.json();
        return data.Answer && data.Answer.length > 0;
    } catch {
        return false;
    }
}

// Fungsi untuk mengecek website aktif
async function checkWebsite(domain) {
    try {
        const response = await fetch(`https://${domain}`, {
            mode: 'no-cors',
            timeout: CHECK_TIMEOUT
        });
        return true;
    } catch {
        try {
            const response = await fetch(`http://${domain}`, {
                mode: 'no-cors',
                timeout: CHECK_TIMEOUT
            });
            return true;
        } catch {
            return false;
        }
    }
}

// Fungsi utama untuk mengecek status domain
async function checkDomainStatus(domain) {
    try {
        const [dnsExists, isWebsiteActive] = await Promise.all([
            checkDNS(domain),
            checkWebsite(domain)
        ]);

        return {
            domain,
            exists: dnsExists,
            isActive: isWebsiteActive,
            checkedAt: new Date().toLocaleString()
        };
    } catch (error) {
        console.error(`Error checking ${domain}:`, error);
        return {
            domain,
            error: true,
            checkedAt: new Date().toLocaleString()
        };
    }
}

// Fungsi untuk memproses domain dalam batch
async function processDomainBatch(domains) {
    const results = [];
    for (let i = 0; i < domains.length; i += MAX_CONCURRENT_CHECKS) {
        const batch = domains.slice(i, i + MAX_CONCURRENT_CHECKS);
        const batchResults = await Promise.all(
            batch.map(domain => checkDomain(domain))
        );
        results.push(...batchResults);
        
        // Update progress
        const progress = ((i + batch.length) / domains.length) * 100;
        updateProgressBar(progress, i + batch.length, domains.length);
    }
    return results;
}

function updateProgressBar(percentage, current, total) {
    const progressBar = document.querySelector('.progress-bar');
    if (progressBar) {
        progressBar.querySelector('.progress-fill').style.width = `${percentage}%`;
        progressBar.querySelector('.progress-text').textContent = 
            `${current}/${total} domains checked`;
    }
}

async function searchDomains() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    if (!searchTerm) return;

    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    
    loading.style.display = 'block';
    results.innerHTML = '';

    // Tambahkan progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.innerHTML = `
        <div class="progress-fill"></div>
        <div class="progress-text">Memulai pencarian...</div>
    `;
    results.appendChild(progressBar);

    // Daftar TLD yang paling umum saja untuk mempercepat
    const tlds = ['.com', '.net', '.org', '.io', '.co', '.id'];
    
    // Daftar subdomain yang paling umum
    const subdomains = [
        '',
        'www.',
        'api.',
        'admin.',
        'app.',
        'mail.',
        'blog.',
        'm.',
        'dev.'
    ];

    try {
        const domains = [];
        for (const subdomain of subdomains) {
            for (const tld of tlds) {
                domains.push(`${subdomain}${searchTerm}${tld}`);
            }
        }

        await processDomainBatch(domains);

    } catch (error) {
        console.error('Error:', error);
        results.innerHTML += '<div class="error">Terjadi kesalahan saat mengecek domain</div>';
    } finally {
        loading.style.display = 'none';
    }
}

async function checkDomain(domain) {
    const results = document.getElementById('results');
    const card = document.createElement('div');
    card.className = 'domain-card';
    
    card.innerHTML = `
        <div class="domain-content">
            <span class="domain-name">${domain}</span>
            <span class="status-badge">Mengecek...</span>
        </div>
    `;
    results.appendChild(card);

    try {
        const status = await checkDomainStatus(domain);

        let statusText = '';
        let statusClass = '';
        let additionalInfo = '';

        if (status.error) {
            statusText = 'Error';
            statusClass = 'status-error';
        } else if (status.isActive) {
            statusText = 'Aktif';
            statusClass = 'status-active';
            additionalInfo = `
                <div class="domain-info">
                    <div>Terakhir dicek: ${status.checkedAt}</div>
                    <div class="action-buttons">
                        <a href="https://${domain}" target="_blank" class="visit-btn">
                            <i class="fas fa-external-link-alt"></i> Kunjungi
                        </a>
                        <a href="https://who.is/whois/${domain}" target="_blank" class="info-btn">
                            <i class="fas fa-info-circle"></i> WHOIS
                        </a>
                    </div>
                </div>
            `;
        } else if (status.exists) {
            statusText = 'Terdaftar';
            statusClass = 'status-registered';
            additionalInfo = `
                <div class="domain-info">
                    <div>Terakhir dicek: ${status.checkedAt}</div>
                    <div class="action-buttons">
                        <a href="https://who.is/whois/${domain}" target="_blank" class="info-btn">
                            <i class="fas fa-info-circle"></i> WHOIS
                        </a>
                    </div>
                </div>
            `;
        } else {
            statusText = 'Tidak Terdaftar';
            statusClass = 'status-available';
        }

        card.innerHTML = `
            <div class="domain-content">
                <span class="domain-name">${domain}</span>
                <span class="status-badge ${statusClass}">${statusText}</span>
                ${additionalInfo}
            </div>
        `;
    } catch (error) {
        card.innerHTML = `
            <div class="domain-content">
                <span class="domain-name">${domain}</span>
                <span class="status-badge status-error">Error</span>
            </div>
        `;
    }
}

// Event listeners
document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchDomains();
    }
}); 