// ============================================================================
// Global State
// ============================================================================

let siteColorGroups = []; // Colors loaded from site's colors.json
let tempGradients = []; // User-added gradient groups in localStorage
let pinnedColorIds = []; // IDs of pinned colors
let pinnedGradientIds = []; // IDs of pinned gradient groups
let colorsData = null; // Colors JSON data stored in localStorage
let dataSource = null; // 'url' or 'file' or null
let loadedTimestamp = null; // When the data was loaded

// ============================================================================
// LocalStorage Management
// ============================================================================

function loadFromLocalStorage() {
    const stored = localStorage.getItem('websitetools-colors');
    if (stored) {
        const data = JSON.parse(stored);
        tempGradients = data.tempGradients || [];
        pinnedColorIds = data.pinnedColorIds || [];
        pinnedGradientIds = data.pinnedGradientIds || [];
        colorsData = data.colorsData || null;
        dataSource = data.dataSource || null;
        loadedTimestamp = data.loadedTimestamp || null;
    }
}

function saveToLocalStorage() {
    // Load existing data to preserve savedStyles from frontmatter tool
    const stored = localStorage.getItem('websitetools-colors');
    const existingData = stored ? JSON.parse(stored) : {};

    const data = {
        tempGradients,
        pinnedColorIds,
        pinnedGradientIds,
        colorsData,
        dataSource,
        loadedTimestamp,
        // Preserve savedStyles from frontmatter tool
        savedStyles: existingData.savedStyles || []
    };
    localStorage.setItem('websitetools-colors', JSON.stringify(data));

    // Dispatch event for frontmatter tool to listen to
    window.dispatchEvent(new CustomEvent('pinnedColorsUpdated'));
}

// ============================================================================
// Load Colors from Site or Upload
// ============================================================================

async function loadColorsFromJSON() {
    updateStatus('Loading...');

    // Check if we have data in localStorage
    if (colorsData) {
        try {
            siteColorGroups = parseColorData(colorsData);
            updateStatusWithTimestamp();
            showRefreshButton();
            return;
        } catch (error) {
            console.error('Error parsing stored colors:', error);
        }
    }

    // No localStorage data, try loading from URL automatically
    await loadFromURL();
}

async function loadFromURL() {
    updateStatus('Loading from URL...');

    try {
        const response = await fetch('https://palomakop.tv/colors.json', {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        colorsData = data;
        siteColorGroups = parseColorData(data);
        dataSource = 'url';
        loadedTimestamp = Date.now();

        // Save to localStorage so it persists
        saveToLocalStorage();

        updateStatusWithTimestamp();
        showRefreshButton();
        renderAllColors();
    } catch (error) {
        console.error('Error loading from URL:', error);
        updateStatus(`Failed to load from URL: ${error.message}`);
        siteColorGroups = [];
        dataSource = null;
        loadedTimestamp = null;
        hideRefreshButton();
        renderAllColors();
    }
}

function refreshColors() {
    if (dataSource === 'url') {
        loadFromURL();
    } else if (dataSource === 'file') {
        // Re-parse existing data
        if (colorsData) {
            siteColorGroups = parseColorData(colorsData);
            loadedTimestamp = Date.now();
            saveToLocalStorage();
            updateStatusWithTimestamp();
            renderAllColors();
        }
    }
}

function clearAllData() {
    if (!confirm('Are you sure you want to clear all data? This will remove colors and all pinned items.')) {
        return;
    }

    colorsData = null;
    siteColorGroups = [];
    tempGradients = [];
    pinnedColorIds = [];
    pinnedGradientIds = [];
    dataSource = null;
    loadedTimestamp = null;

    saveToLocalStorage();
    updateStatus('All data cleared. Load from URL or upload a file.');
    hideRefreshButton();
    renderAllColors();
}

function updateStatus(message) {
    const statusEl = document.getElementById('colorStatus');
    if (statusEl) {
        statusEl.textContent = message;
    }
}

function updateStatusWithTimestamp() {
    if (!loadedTimestamp) {
        updateStatus('No colors loaded');
        return;
    }

    const date = new Date(loadedTimestamp);
    const timeString = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    const sourceText = dataSource === 'url'
        ? 'Loaded from URL'
        : 'Loaded from file';

    updateStatus(`${sourceText} on ${timeString}`);
}

function showRefreshButton() {
    const btn = document.getElementById('refreshBtn');
    if (btn) btn.style.display = 'inline-block';
}

function hideRefreshButton() {
    const btn = document.getElementById('refreshBtn');
    if (btn) btn.style.display = 'none';
}

function parseColorData(data) {
    const groups = [];

    // Process both "css" and "frontmatter" top-level keys
    ['css', 'frontmatter'].forEach(topLevel => {
        if (!data[topLevel]) return;

        Object.keys(data[topLevel]).forEach(groupName => {
            const groupData = data[topLevel][groupName];
            const items = [];

            // Keep items in order from JSON
            Object.keys(groupData).forEach(propName => {
                const item = groupData[propName];

                if (item.type === 'color') {
                    items.push({
                        type: 'color',
                        name: propName,
                        hex: item.value
                    });
                } else if (item.type === 'gradient') {
                    const stops = extractGradientStops(item.value);
                    items.push({
                        type: 'gradient',
                        name: propName,
                        stops: stops,
                        cssValue: item.value
                    });
                }
            });

            if (items.length > 0) {
                groups.push({
                    title: groupName,
                    items: items
                });
            }
        });
    });

    return groups;
}

function extractGradientStops(gradientCSS) {
    // Extract color values from gradient CSS
    // Matches hex colors, rgb/rgba, hsl/hsla, and named colors
    const colorRegex = /#[0-9A-Fa-f]{3,6}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-z]+/g;
    const matches = gradientCSS.match(colorRegex);

    if (!matches) return [];

    // Filter out gradient function names and keywords
    const excludeWords = ['radial', 'linear', 'to', 'right', 'left', 'top', 'bottom', 'gradient', 'repeating'];
    const stops = matches.filter(match => {
        return !excludeWords.includes(match.toLowerCase());
    });

    return stops;
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    updateStatus('Loading file...');

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            colorsData = data;
            siteColorGroups = parseColorData(data);
            dataSource = 'file';
            loadedTimestamp = Date.now();

            // Save to localStorage
            saveToLocalStorage();

            updateStatusWithTimestamp();
            showRefreshButton();
            renderAllColors();
        } catch (error) {
            updateStatus(`Error parsing file: ${error.message}`);
            alert('Error parsing JSON file: ' + error.message);
        }
    };
    reader.onerror = () => {
        updateStatus('Error reading file');
    };
    reader.readAsText(file);

    // Clear the input so the same file can be uploaded again
    event.target.value = '';
}

// ============================================================================
// Color ID Generation
// ============================================================================


// ============================================================================
// Get All Colors (for export and pinned display)
// ============================================================================

function getAllColors() {
    const colors = [];

    // Add site colors
    siteColorGroups.forEach((group, groupIdx) => {
        if (group.items) {
            group.items.forEach((item, itemIdx) => {
                if (item.type === 'color') {
                    const id = `site-color-${groupIdx}-${itemIdx}`;
                    colors.push({
                        id,
                        name: item.name,
                        hex: item.hex,
                        source: 'site',
                        groupTitle: group.title
                    });
                }
            });
        }
    });

    return colors;
}

function getPinnedColors() {
    const allColors = getAllColors();
    return allColors.filter(color => pinnedColorIds.includes(color.id));
}

function getAllGradients() {
    const gradients = [];

    // Add site gradients
    siteColorGroups.forEach((group, groupIdx) => {
        if (group.items) {
            group.items.forEach((item, itemIdx) => {
                if (item.type === 'gradient') {
                    const id = `site-gradient-${groupIdx}-${itemIdx}`;
                    gradients.push({
                        id,
                        name: item.name,
                        stops: item.stops,
                        cssValue: item.cssValue,
                        groupTitle: group.title
                    });
                }
            });
        }
    });

    // Add temp gradients
    tempGradients.forEach((gradient, idx) => {
        gradients.push({
            id: `gradient-temp-${idx}`,
            name: gradient.name,
            stops: gradient.stops,
            groupTitle: 'Temporary'
        });
    });

    return gradients;
}

// ============================================================================
// Render Functions
// ============================================================================

function renderAllColors() {
    renderSiteColors();
    setupMainViewDragHandlers();
}

function getPinnedGradients() {
    const allGradients = getAllGradients();
    return allGradients.filter(gradient => pinnedGradientIds.includes(gradient.id));
}


function renderSiteColors() {
    const container = document.getElementById('siteColorsContainer');

    if (siteColorGroups.length === 0) {
        container.innerHTML = '<div class="section"><p style="color: var(--text-secondary);">No colors loaded.</p></div>';
        return;
    }

    container.innerHTML = siteColorGroups.map((group, groupIdx) => {
        const itemsHTML = group.items.map((item, itemIdx) => {
            if (item.type === 'color') {
                const id = `site-color-${groupIdx}-${itemIdx}`;
                const isPinned = pinnedColorIds.includes(id);

                return `
                    <div class="site-color-item" data-color-id="${id}" draggable="true" data-color-hex="${item.hex}" data-drag-type="color">
                        <div class="site-color-swatch" style="background-color: ${item.hex};"></div>
                        <div class="site-color-info">
                            <div class="site-color-name">${item.name}</div>
                            <div class="site-color-hex">${item.hex}</div>
                        </div>
                        <div class="item-actions">
                            <button class="icon-btn pin-btn ${isPinned ? 'pinned' : ''}" onclick="event.stopPropagation(); togglePinColor('${id}', '${item.name}', '${item.hex}')" title="${isPinned ? 'Unpin' : 'Pin'}">
                                <svg><use href="../icons.svg#icon-pin"/></svg>
                            </button>
                            <button class="icon-btn copy-btn" onclick="event.stopPropagation(); copyColorValue('${item.hex}', this)" title="Copy color">
                                <svg><use href="../icons.svg#icon-copy"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            } else if (item.type === 'gradient') {
                const id = `site-gradient-${groupIdx}-${itemIdx}`;
                const isPinned = pinnedGradientIds.includes(id);

                return `
                    <div class="site-gradient-item" data-gradient-id="${id}" draggable="true" data-gradient-stops='${JSON.stringify(item.stops)}' data-drag-type="gradient" data-gradient-css="${item.cssValue}">
                        <div class="site-gradient-swatch" style="background: ${item.cssValue};"></div>
                        <div class="site-gradient-info">
                            <div class="site-gradient-name">${item.name}</div>
                            <div class="site-gradient-stops">${item.stops.length} stops</div>
                        </div>
                        <div class="item-actions">
                            <button class="icon-btn pin-btn ${isPinned ? 'pinned' : ''}" onclick="event.stopPropagation(); togglePinGradient('${id}', '${item.name}', '${JSON.stringify(item.stops).replace(/"/g, '&quot;')}')" title="${isPinned ? 'Unpin' : 'Pin'}">
                                <svg><use href="../icons.svg#icon-pin"/></svg>
                            </button>
                            <button class="icon-btn copy-btn" onclick="event.stopPropagation(); copyGradientValue('${item.cssValue}', this)" title="Copy gradient">
                                <svg><use href="../icons.svg#icon-copy"/></svg>
                            </button>
                            <button class="icon-btn expand-btn" onclick="event.stopPropagation(); openGradientModal('${item.name}', '${JSON.stringify(item.stops).replace(/"/g, '&quot;')}', '${item.cssValue}')" title="View gradient details">
                                <svg><use href="../icons.svg#icon-expand"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            }
        }).join('');

        return `
            <div class="section color-group-section">
                <div class="color-group-header">
                    <h3>${group.title}</h3>
                </div>
                <div class="site-items-container">
                    ${itemsHTML}
                </div>
            </div>
        `;
    }).join('');
}

function togglePinColor(colorId, name, hex) {
    const index = pinnedColorIds.indexOf(colorId);
    if (index > -1) {
        pinnedColorIds.splice(index, 1);
    } else {
        pinnedColorIds.push(colorId);
    }
    saveToLocalStorage();
    renderAllColors();
}

function togglePinGradient(gradientId, name, stopsJSON) {
    const index = pinnedGradientIds.indexOf(gradientId);
    if (index > -1) {
        pinnedGradientIds.splice(index, 1);
    } else {
        pinnedGradientIds.push(gradientId);
    }
    saveToLocalStorage();
    renderAllColors();
}

// ============================================================================
// Color Conversion Utilities
// ============================================================================

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function rgbToHsb(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    let s = max === 0 ? 0 : (delta / max) * 100;
    let brightness = max * 100;

    if (delta !== 0) {
        if (max === r) {
            h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        } else if (max === g) {
            h = ((b - r) / delta + 2) / 6;
        } else {
            h = ((r - g) / delta + 4) / 6;
        }
    }

    h *= 360;

    return { h, s, b: brightness };
}

function hsbToRgb(h, s, b) {
    h = h / 360;
    s = s / 100;
    b = b / 100;

    let r, g, bl;

    if (s === 0) {
        r = g = bl = b;
    } else {
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = b * (1 - s);
        const q = b * (1 - f * s);
        const t = b * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = b; g = t; bl = p; break;
            case 1: r = q; g = b; bl = p; break;
            case 2: r = p; g = b; bl = t; break;
            case 3: r = p; g = q; bl = b; break;
            case 4: r = t; g = p; bl = b; break;
            case 5: r = b; g = p; bl = q; break;
        }
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(bl * 255)
    };
}

// ============================================================================
// Pinned Items Drag Handlers
// ============================================================================

function setupMainViewDragHandlers() {
    // Setup drag handlers for items in the main view (not pinned sidebar)
    const mainViewItems = document.querySelectorAll('.site-color-item, .site-gradient-item');

    mainViewItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            const colorId = e.currentTarget.dataset.colorId;
            const gradientId = e.currentTarget.dataset.gradientId;

            if (colorId) {
                const hex = e.currentTarget.dataset.colorHex;
                e.dataTransfer.setData('text/plain', hex);
                e.dataTransfer.setData('application/pinned-color', hex);
                e.dataTransfer.setData('application/color-id', colorId);
            } else if (gradientId) {
                const stops = e.currentTarget.dataset.gradientStops;
                e.dataTransfer.setData('text/plain', stops);
                e.dataTransfer.setData('application/pinned-gradient', stops);
                e.dataTransfer.setData('application/gradient-id', gradientId);
            }

            e.dataTransfer.effectAllowed = 'copy';
            e.currentTarget.style.opacity = '0.5';
        });

        item.addEventListener('dragend', (e) => {
            e.currentTarget.style.opacity = '';
        });
    });
}


// ============================================================================
// Copy Functions
// ============================================================================

function copyColorValue(hex, button) {
    navigator.clipboard.writeText(hex).then(() => {
        showCopyFeedback(button);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

function copyGradientValue(cssValue, button) {
    navigator.clipboard.writeText(cssValue).then(() => {
        showCopyFeedback(button);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

function copyText(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        showCopyFeedback(button);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

function showCopyFeedback(button) {
    button.classList.add('copied');

    // Replace icon with checkmark
    const svg = button.querySelector('svg use');
    const originalHref = svg.getAttribute('href');
    svg.setAttribute('href', '../icons.svg#icon-check');

    setTimeout(() => {
        button.classList.remove('copied');
        svg.setAttribute('href', originalHref);
    }, 1200);
}

// ============================================================================
// Gradient Modal
// ============================================================================

function openGradientModal(name, stopsJSON, cssValue) {
    const modal = document.getElementById('gradientModal');
    const title = document.getElementById('gradientModalTitle');
    const body = document.getElementById('gradientModalBody');

    const stops = JSON.parse(stopsJSON);

    title.textContent = name;

    let html = `
        <div class="gradient-modal-preview" style="background: ${cssValue};"></div>

        <div class="gradient-modal-value">
            <div class="gradient-modal-label">Full Gradient Value</div>
            <div class="gradient-value-container">
                <div class="gradient-value-text">${cssValue}</div>
                <button class="icon-btn copy-btn" onclick="copyText('${cssValue}', this)" title="Copy gradient value">
                    <svg><use href="../icons.svg#icon-copy"/></svg>
                </button>
            </div>
        </div>

        <div class="gradient-modal-value">
            <div class="gradient-modal-label">Color Stops (${stops.length})</div>
            <div class="gradient-stops-list">
    `;

    stops.forEach((stop, idx) => {
        html += `
            <div class="gradient-stop-item">
                <div class="gradient-stop-swatch" style="background-color: ${stop};"></div>
                <div class="gradient-stop-value">${stop}</div>
                <button class="icon-btn copy-btn" onclick="copyText('${stop}', this)" title="Copy color">
                    <svg><use href="../icons.svg#icon-copy"/></svg>
                </button>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    body.innerHTML = html;
    modal.classList.add('visible');

    // Close on background click
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeGradientModal();
        }
    };
}

function closeGradientModal() {
    const modal = document.getElementById('gradientModal');
    modal.classList.remove('visible');
}

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    loadFromLocalStorage();
    await loadColorsFromJSON();
    renderAllColors();

    // Listen for pinned colors updates from frontmatter tool
    window.addEventListener('pinnedColorsUpdated', () => {
        loadFromLocalStorage();
        renderAllColors();
    });
});
