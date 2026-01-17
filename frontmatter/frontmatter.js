// ============================================================================
// Data Management & State
// ============================================================================

let pages = [];
let currentColorPickerCallback = null;
let colorIndex = 0;

const BORDER_COLORS = [
    'var(--color-accent)',
    'var(--color-blue)',
    'var(--color-red-light)',
    'var(--color-green)',
    'var(--color-success)'
];

// Templates for different page types
const TEMPLATES = {
    blog: {
        title: '',
        thumbnail: '',
        thumbnailAlt: '',
        date: new Date().toISOString().split('T')[0]
    },
    artwork: {
        title: '',
        projectTags: [],
        projectYear: new Date().getFullYear().toString(),
        description: '',
        lightbox: false,
        dark: false,
        customStyle: {
            enabled: true,
            type: 'solid', // solid, gradient, or image
            solidColor: '#cfcecc',
            gradientStops: ['#d5dcdf', '#dddddd', '#d0dada'],
            bgImage: '',
            bgImageOpacity: 1.0
        },
        thumbnail: '',
        thumbnailAlt: ''
    },
    notes: {
        title: '',
        description: '',
        lightbox: false,
        dark: false,
        thumbnail: '',
        customStyle: {
            enabled: true,
            type: 'solid',
            solidColor: '#d8ddea',
            gradientStops: ['#c7d2f0', '#e0d4ef', '#f2d6d6'],
            bgImage: '',
            bgImageOpacity: 1.0
        },
        notecardDark: false,
        notecardTextColor: '#f2f2f2'
    }
};

const PROJECT_TAGS = [
    'performance',
    'video art',
    'music video',
    'collaboration',
    'print',
    'installation',
    'music',
    'drawing',
    'sculpture'
];

// ============================================================================
// LocalStorage Management
// ============================================================================

function saveToLocalStorage() {
    localStorage.setItem('frontmatterPages', JSON.stringify(pages));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('frontmatterPages');
    if (saved) {
        pages = JSON.parse(saved);
        // Update colorIndex to continue from where we left off
        if (pages.length > 0) {
            const maxColorIndex = Math.max(...pages.map(p => p.colorIndex !== undefined ? p.colorIndex : 0));
            colorIndex = (maxColorIndex + 1) % BORDER_COLORS.length;
        }
        renderAllPages();
    }
}

// ============================================================================
// Page Creation & Management
// ============================================================================

function createFromTemplate(type) {
    const id = Date.now().toString();
    const template = JSON.parse(JSON.stringify(TEMPLATES[type])); // Deep clone

    const page = {
        id,
        type,
        data: template,
        colorIndex: colorIndex
    };

    colorIndex = (colorIndex + 1) % BORDER_COLORS.length;

    pages.unshift(page);
    saveToLocalStorage();
    renderAllPages();
}

function deletePage(id) {
    pages = pages.filter(p => p.id !== id);
    saveToLocalStorage();
    renderAllPages();
}

function clearAllData() {
    if (confirm('Are you sure you want to delete all frontmatter data?')) {
        pages = [];
        localStorage.removeItem('frontmatterPages');
        renderAllPages();
    }
}

// ============================================================================
// Rendering Functions
// ============================================================================

function renderAllPages() {
    const container = document.getElementById('editorsContainer');
    const emptyState = document.getElementById('emptyState');

    if (pages.length === 0) {
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = pages.map(page => renderPageCard(page)).join('');
}

function renderPageCard(page) {
    let typeLabel = page.type.charAt(0).toUpperCase() + page.type.slice(1);
    if (page.type === 'blog') {
        typeLabel = 'Blog Post';
    } else if (page.type === 'notes') {
        typeLabel = 'Notes Page';
    } else if (page.type === 'artwork') {
        typeLabel = 'Artwork';
    }

    // Ensure colorIndex exists for pages loaded from localStorage before this feature
    if (page.colorIndex === undefined) {
        page.colorIndex = 0;
    }

    const borderColor = BORDER_COLORS[page.colorIndex % BORDER_COLORS.length];

    return `
        <div class="block" data-page-id="${page.id}" style="border-left-color: ${borderColor};">
            <div class="block-header">
                <div class="block-title block-title-main">${typeLabel}</div>
                <button class="delete-btn" onclick="deletePage('${page.id}')">Delete</button>
            </div>

            <div class="frontmatter-editor">
                ${renderFieldsForType(page)}
            </div>

            <div class="output-section">
                <h3 class="output-section-title">Output</h3>

                <div class="shortcode-output">
                    <div class="output-header">
                        <div class="output-label">Frontmatter</div>
                        <button class="copy-btn" onclick="copyOutput('${page.id}', 'frontmatter')">Copy</button>
                    </div>
                    <pre id="output-${page.id}">${generateFrontmatter(page)}</pre>
                </div>

                <div class="shortcode-output">
                    <div class="output-header">
                        <div class="output-label">Suggested Filename</div>
                        <button class="copy-btn" onclick="copyOutput('${page.id}', 'filename')">Copy</button>
                    </div>
                    <pre id="filename-${page.id}">${generateFilename(page)}</pre>
                </div>
            </div>
        </div>
    `;
}

function renderFieldsForType(page) {
    const fields = [];

    switch (page.type) {
        case 'blog':
            fields.push(renderTextField(page, 'title', 'Title'));
            fields.push(renderTextField(page, 'thumbnail', 'Thumbnail URL'));
            fields.push(renderTextField(page, 'thumbnailAlt', 'Thumbnail Alt Text'));
            fields.push(renderTextField(page, 'date', 'Date'));
            break;

        case 'artwork':
            fields.push(renderTextField(page, 'title', 'Title'));
            fields.push(renderTagsField(page, 'projectTags', 'Project Tags'));
            fields.push(renderTextField(page, 'projectYear', 'Project Year'));
            fields.push(renderTextField(page, 'description', 'Description'));
            fields.push(renderBooleanField(page, 'lightbox', 'Lightbox'));
            fields.push(renderBooleanField(page, 'dark', 'Dark Mode'));
            fields.push(renderCustomStyleField(page));
            fields.push(renderTextField(page, 'thumbnail', 'Thumbnail URL'));
            fields.push(renderTextField(page, 'thumbnailAlt', 'Thumbnail Alt Text'));
            break;

        case 'notes':
            fields.push(renderTextField(page, 'title', 'Title'));
            fields.push(renderTextField(page, 'description', 'Description'));
            fields.push(renderBooleanField(page, 'lightbox', 'Lightbox'));
            fields.push(renderBooleanField(page, 'dark', 'Dark Mode'));
            fields.push(renderTextField(page, 'thumbnail', 'Thumbnail URL'));
            fields.push(renderCustomStyleField(page));
            if (page.data.customStyle && page.data.customStyle.enabled) {
                fields.push(renderBooleanField(page, 'notecardDark', 'Notecard Dark'));
                if (page.data.notecardDark) {
                    fields.push(renderNotecardTextColorField(page));
                }
            }
            break;
    }

    return fields.join('');
}

// ============================================================================
// Field Renderers
// ============================================================================

function renderTextField(page, fieldName, label) {
    const value = page.data[fieldName] || '';
    const escapedValue = value.replace(/"/g, '&quot;');

    return `
        <div class="field-group">
            <label>${label}</label>
            <input type="text"
                   value="${escapedValue}"
                   oninput="updateField('${page.id}', '${fieldName}', this.value)"
                   placeholder="${label}">
        </div>
    `;
}

function renderBooleanField(page, fieldName, label) {
    const checked = page.data[fieldName] ? 'checked' : '';

    return `
        <div class="field-group">
            <label>
                <input type="checkbox"
                       ${checked}
                       onchange="updateField('${page.id}', '${fieldName}', this.checked)">
                ${label}
            </label>
        </div>
    `;
}

function renderTagsField(page, fieldName, label) {
    const tags = page.data[fieldName] || [];

    return `
        <div class="field-group">
            <label>${label}</label>
            <div class="tags-container" id="tags-${page.id}">
                ${tags.map((tag, idx) => `
                    <span class="tag">
                        ${tag}
                        <button class="tag-remove" onclick="removeTag('${page.id}', ${idx})">×</button>
                    </span>
                `).join('')}
            </div>
            <div class="tags-input">
                <select id="tag-select-${page.id}" onchange="addPredefinedTag('${page.id}', this)">
                    <option value="">Add predefined tag...</option>
                    ${PROJECT_TAGS.map(tag => `<option value="${tag}">${tag}</option>`).join('')}
                </select>
                <input type="text"
                       id="tag-custom-${page.id}"
                       placeholder="Or type custom tag..."
                       onkeypress="if(event.key==='Enter') addCustomTag('${page.id}', this)">
                <button onclick="addCustomTag('${page.id}', document.getElementById('tag-custom-${page.id}'))">Add</button>
            </div>
        </div>
    `;
}

function renderCustomStyleField(page) {
    const customStyle = page.data.customStyle || { enabled: false };

    if (!customStyle.enabled) {
        return `
            <div class="field-group">
                <button onclick="enableCustomStyle('${page.id}')">Add Custom Style</button>
            </div>
        `;
    }

    return `
        <div class="field-group custom-style-field">
            <div class="custom-style-header">
                <label>Custom Style</label>
                <button class="delete-btn" style="font-size: 11px; padding: 3px 8px 5px 8px;" onclick="disableCustomStyle('${page.id}')">Remove</button>
            </div>

            <div class="style-type-selector">
                <select onchange="updateStyleType('${page.id}', this.value)">
                    <option value="solid" ${customStyle.type === 'solid' ? 'selected' : ''}>Solid Color</option>
                    <option value="gradient" ${customStyle.type === 'gradient' ? 'selected' : ''}>Gradient</option>
                    <option value="image" ${customStyle.type === 'image' ? 'selected' : ''}>Background Image</option>
                </select>
            </div>

            ${renderStyleEditor(page)}
        </div>
    `;
}

function renderStyleEditor(page) {
    const customStyle = page.data.customStyle;

    switch (customStyle.type) {
        case 'solid':
            return renderSolidColorEditor(page);
        case 'gradient':
            return renderGradientEditor(page);
        case 'image':
            return renderImageEditor(page);
        default:
            return '';
    }
}

function renderSolidColorEditor(page) {
    const color = page.data.customStyle.solidColor || '#cfcecc';

    return `
        <div class="style-editor">
            <div class="color-preview-row">
                <div class="color-preview"
                     style="background-color: ${color};"
                     onclick="event.stopPropagation(); openColorPicker('${page.id}', 'solidColor', '${color}', undefined, event)">
                </div>
                <span class="color-value">${color}</span>
            </div>
        </div>
    `;
}

function renderGradientEditor(page) {
    const stops = page.data.customStyle.gradientStops || ['#d5dcdf', '#dddddd', '#d0dada'];
    const gradientCSS = `radial-gradient(${stops.join(', ')})`;

    // Display stops in reverse order (outer to inner) for more intuitive editing
    const stopsReversed = [...stops].reverse();

    return `
        <div class="style-editor">
            <div class="gradient-preview" style="background: ${gradientCSS};"></div>
            <div class="gradient-stops" id="gradient-stops-${page.id}">
                ${stopsReversed.map((color, displayIdx) => {
                    const actualIdx = stops.length - 1 - displayIdx; // Map back to actual array index
                    return `
                    <div class="gradient-stop-row" draggable="true" data-page-id="${page.id}" data-stop-index="${actualIdx}">
                        <div class="color-preview"
                             style="background-color: ${color};"
                             onclick="event.stopPropagation(); openColorPicker('${page.id}', 'gradientStop', '${color}', ${actualIdx}, event)">
                        </div>
                        <span class="color-value">${color}</span>
                        ${stops.length > 2 ? `
                            <button class="gradient-stop-remove" onclick="event.stopPropagation(); removeGradientStop('${page.id}', ${actualIdx})">
                                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                `}).join('')}
            </div>
            <button onclick="addGradientStop('${page.id}')">Add Color Stop</button>
        </div>
    `;
}

function renderImageEditor(page) {
    const bgImage = page.data.customStyle.bgImage || '';
    const opacity = page.data.customStyle.bgImageOpacity !== undefined ? page.data.customStyle.bgImageOpacity : 1.0;
    const imageLoaded = page.data.customStyle.imageLoaded || false;

    return `
        <div class="style-editor">
            <div class="image-preview-container" id="image-preview-${page.id}" style="background-image: ${imageLoaded && bgImage ? `url(${bgImage})` : 'none'}; opacity: ${opacity};"></div>
            <div class="field-group">
                <label>Image URL</label>
                <input type="text"
                       id="image-url-${page.id}"
                       value="${bgImage}"
                       oninput="updateField('${page.id}', 'customStyle.bgImage', this.value)"
                       placeholder="https://...">
            </div>
            <button onclick="loadImagePreview('${page.id}')" style="margin-bottom:8px;">Load Image</button>
            <div class="field-group">
                <label>Opacity (0-1)</label>
                <input type="number"
                       value="${opacity}"
                       min="0"
                       max="1"
                       step="0.1"
                       oninput="updateImageOpacity('${page.id}', parseFloat(this.value))"
                       placeholder="1.0">
            </div>
        </div>
    `;
}

function renderNotecardTextColorField(page) {
    const color = page.data.notecardTextColor || '#f2f2f2';

    return `
        <div class="field-group">
            <label>Notecard Text Color</label>
            <div class="color-preview-row">
                <div class="color-preview"
                     style="background-color: ${color};"
                     onclick="event.stopPropagation(); openColorPicker('${page.id}', 'notecardTextColor', '${color}', undefined, event)">
                </div>
                <span class="color-value">${color}</span>
            </div>
        </div>
    `;
}

// ============================================================================
// Field Update Functions
// ============================================================================

function updateField(pageId, fieldPath, value) {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    // Handle nested paths like 'customStyle.bgImage'
    const parts = fieldPath.split('.');
    let target = page.data;

    for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
    }

    target[parts[parts.length - 1]] = value;

    // Special case: when enabling dark mode on notes page, default notecardDark to true
    if (fieldPath === 'dark' && value === true && page.type === 'notes') {
        if (page.data.notecardDark === undefined || page.data.notecardDark === false) {
            page.data.notecardDark = true;
            if (!page.data.notecardTextColor) {
                page.data.notecardTextColor = '#f2f2f2';
            }
        }
    }

    // Special case: when enabling notecardDark, ensure notecardTextColor exists
    if (fieldPath === 'notecardDark' && value === true) {
        if (!page.data.notecardTextColor) {
            page.data.notecardTextColor = '#f2f2f2';
        }
    }

    saveToLocalStorage();
    updatePageOutput(pageId);

    // Re-render to show/hide conditional fields
    if (fieldPath === 'notecardDark' || fieldPath === 'dark') {
        renderAllPages();
    }
}

function updatePageOutput(pageId) {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    const outputEl = document.getElementById(`output-${pageId}`);
    const filenameEl = document.getElementById(`filename-${pageId}`);

    if (outputEl) outputEl.textContent = generateFrontmatter(page);
    if (filenameEl) filenameEl.textContent = generateFilename(page);
}

// ============================================================================
// Tag Management
// ============================================================================

function addPredefinedTag(pageId, selectEl) {
    const tag = selectEl.value;
    if (!tag) return;

    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    if (!page.data.projectTags) page.data.projectTags = [];
    if (!page.data.projectTags.includes(tag)) {
        page.data.projectTags.push(tag);
        saveToLocalStorage();
        renderAllPages();
    }

    selectEl.value = '';
}

function addCustomTag(pageId, inputEl) {
    const tag = inputEl.value.trim();
    if (!tag) return;

    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    if (!page.data.projectTags) page.data.projectTags = [];
    if (!page.data.projectTags.includes(tag)) {
        page.data.projectTags.push(tag);
        saveToLocalStorage();
        renderAllPages();
    }

    inputEl.value = '';
}

function removeTag(pageId, index) {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    page.data.projectTags.splice(index, 1);
    saveToLocalStorage();
    renderAllPages();
}

// ============================================================================
// Custom Style Management
// ============================================================================

function enableCustomStyle(pageId) {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    const defaultStyle = TEMPLATES[page.type].customStyle;
    page.data.customStyle = JSON.parse(JSON.stringify(defaultStyle));
    page.data.customStyle.enabled = true;

    saveToLocalStorage();
    renderAllPages();
}

function disableCustomStyle(pageId) {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    page.data.customStyle = { enabled: false };
    saveToLocalStorage();
    renderAllPages();
}

function updateStyleType(pageId, type) {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    page.data.customStyle.type = type;
    saveToLocalStorage();
    renderAllPages();
}

function addGradientStop(pageId) {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    const stops = page.data.customStyle.gradientStops;
    const lastColor = stops[stops.length - 1];
    stops.push(lastColor);

    saveToLocalStorage();
    renderAllPages();
}

function removeGradientStop(pageId, index) {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    if (page.data.customStyle.gradientStops.length <= 2) return;

    page.data.customStyle.gradientStops.splice(index, 1);
    saveToLocalStorage();
    renderAllPages();
}

function loadImagePreview(pageId) {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    const imageUrl = page.data.customStyle.bgImage;
    if (!imageUrl) {
        alert('Please enter an image URL first');
        return;
    }

    // Test if the image can be loaded
    const img = new Image();
    img.onload = () => {
        // Image loaded successfully
        page.data.customStyle.imageLoaded = true;
        const previewEl = document.getElementById(`image-preview-${pageId}`);
        if (previewEl) {
            previewEl.style.backgroundImage = `url(${imageUrl})`;
        }
        saveToLocalStorage();
        updatePageOutput(pageId);
    };
    img.onerror = () => {
        alert('Failed to load image. Please check the URL.');
    };
    img.src = imageUrl;
}

function updateImageOpacity(pageId, opacity) {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    page.data.customStyle.bgImageOpacity = opacity;

    const previewEl = document.getElementById(`image-preview-${pageId}`);
    if (previewEl) {
        previewEl.style.opacity = opacity;
    }

    saveToLocalStorage();
    updatePageOutput(pageId);
}

// ============================================================================
// Color Picker
// ============================================================================

let currentPickerId = null;
let currentHue = 0;
let currentSat = 100;
let currentBrightness = 100;
let isDraggingXY = false;
let isDraggingHue = false;

function openColorPicker(pageId, field, currentColor, stopIndex, evt) {
    const pickerId = `picker-${pageId}-${field}-${stopIndex !== undefined ? stopIndex : 'none'}`;

    // Close current picker if opening a different one
    if (currentPickerId && currentPickerId !== pickerId) {
        closeColorPicker();
    }

    // Toggle if clicking the same picker
    if (currentPickerId === pickerId) {
        closeColorPicker();
        return;
    }

    currentPickerId = pickerId;

    // Parse current color
    const rgb = hexToRgb(currentColor);
    const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);
    currentHue = hsb.h;
    currentSat = hsb.s;
    currentBrightness = hsb.b;

    currentColorPickerCallback = (newColor) => {
        const page = pages.find(p => p.id === pageId);
        if (!page) return;

        if (field === 'solidColor') {
            page.data.customStyle.solidColor = newColor;
        } else if (field === 'gradientStop') {
            page.data.customStyle.gradientStops[stopIndex] = newColor;
        } else if (field === 'notecardTextColor') {
            page.data.notecardTextColor = newColor;
        }

        saveToLocalStorage();
        updatePageOutput(pageId);

        // Update the specific color preview in the DOM
        updateColorPreviewInDOM(pageId, field, stopIndex, newColor);
    };

    // Find the color preview row and add the picker below it
    const colorPreviewRow = evt.target.closest('.color-preview-row, .gradient-stop-row');
    if (!colorPreviewRow) return;

    // Remove any existing pickers
    document.querySelectorAll('.inline-color-picker').forEach(p => p.remove());

    // Create the picker element
    const picker = document.createElement('div');
    picker.className = 'inline-color-picker visible';
    picker.id = pickerId;
    picker.innerHTML = `
        <div class="color-picker-header">
            <input type="text"
                   class="hex-input"
                   id="hexInput-${pickerId}"
                   value="${currentColor}"
                   maxlength="7"
                   placeholder="#000000">
        </div>
        <div class="color-picker-body">
            <div class="color-xy-pad" id="xyPad-${pickerId}">
                <div class="color-xy-cursor" id="xyCursor-${pickerId}"></div>
            </div>
            <div class="hue-slider-container">
                <label>Hue</label>
                <div class="hue-slider-track" id="hueTrack-${pickerId}">
                    <div class="hue-slider-thumb" id="hueThumb-${pickerId}"></div>
                </div>
                <span class="hue-value" id="hueValue-${pickerId}">${Math.round(currentHue)}</span>
            </div>
        </div>
    `;

    colorPreviewRow.parentNode.insertBefore(picker, colorPreviewRow.nextSibling);

    // Prevent picker from closing when clicking inside it
    picker.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Initialize positions
    updateXYPadBackground(pickerId);
    updateXYCursorPosition(pickerId);
    updateHueThumbPosition(pickerId);

    // Attach event listeners
    attachColorPickerListeners(pickerId);
}

function closeColorPicker() {
    document.querySelectorAll('.inline-color-picker').forEach(p => p.remove());
    currentPickerId = null;
    currentColorPickerCallback = null;
}

function updateColorPreviewInDOM(pageId, field, stopIndex, newColor) {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    const card = document.querySelector(`[data-page-id="${pageId}"]`);
    if (!card) return;

    // Update the hex input in the picker itself
    const picker = document.getElementById(currentPickerId);
    if (picker) {
        const hexInput = picker.querySelector('.hex-input');
        if (hexInput) hexInput.value = newColor;
    }

    // Find and update the color preview square that was clicked to open this picker
    if (field === 'solidColor') {
        // For solid colors, find the color preview in the solid color editor
        const colorPreview = card.querySelector('.style-editor .color-preview-row .color-preview');
        const colorValue = card.querySelector('.style-editor .color-preview-row .color-value');
        if (colorPreview) colorPreview.style.backgroundColor = newColor;
        if (colorValue) colorValue.textContent = newColor;
    } else if (field === 'gradientStop') {
        // For gradient stops, find the specific stop's color preview
        const gradientStops = card.querySelector(`#gradient-stops-${pageId}`);
        if (gradientStops) {
            const stopRows = gradientStops.querySelectorAll('.gradient-stop-row');
            if (stopRows[stopIndex]) {
                const colorPreview = stopRows[stopIndex].querySelector('.color-preview');
                const colorValue = stopRows[stopIndex].querySelector('.color-value');
                if (colorPreview) colorPreview.style.backgroundColor = newColor;
                if (colorValue) colorValue.textContent = newColor;
            }
        }
        // Update gradient preview in real-time
        const gradientPreview = card.querySelector('.gradient-preview');
        if (gradientPreview && page.data.customStyle) {
            const stops = page.data.customStyle.gradientStops;
            gradientPreview.style.background = `radial-gradient(${stops.join(', ')})`;
        }
    } else if (field === 'notecardTextColor') {
        // For notecard text color, find the color preview in the notecard text color field
        const fieldGroups = card.querySelectorAll('.field-group');
        for (let group of fieldGroups) {
            const label = group.querySelector('label');
            if (label && label.textContent.includes('Notecard Text Color')) {
                const colorPreview = group.querySelector('.color-preview');
                const colorValue = group.querySelector('.color-value');
                if (colorPreview) colorPreview.style.backgroundColor = newColor;
                if (colorValue) colorValue.textContent = newColor;
                break;
            }
        }
    }
}

function attachColorPickerListeners(pickerId) {
    const xyPad = document.getElementById(`xyPad-${pickerId}`);
    const hueTrack = document.getElementById(`hueTrack-${pickerId}`);

    let activePickerId = pickerId;
    let activePad = xyPad;
    let activeTrack = hueTrack;

    const handleMouseMove = (e) => {
        if (isDraggingXY && activePad) {
            updateSatBrightFromXY(e, activePad, activePickerId);
        }
        if (isDraggingHue && activeTrack) {
            updateHueFromSlider(e, activeTrack, activePickerId);
        }
    };

    const handleMouseUp = (e) => {
        // Only stop dragging, don't close the picker
        isDraggingXY = false;
        isDraggingHue = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        // Prevent this mouseup from triggering the click listener that closes the picker
        e.stopPropagation();
    };

    // XY Pad for Saturation and Brightness
    xyPad.addEventListener('mousedown', (e) => {
        isDraggingXY = true;
        updateSatBrightFromXY(e, xyPad, pickerId);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });

    // Hue Slider
    hueTrack.addEventListener('mousedown', (e) => {
        isDraggingHue = true;
        updateHueFromSlider(e, hueTrack, pickerId);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });

    // Hex Input Field
    const hexInput = document.getElementById(`hexInput-${pickerId}`);
    if (hexInput) {
        const handleHexInput = () => {
            let value = hexInput.value.trim();

            // Add # if missing
            if (value && !value.startsWith('#')) {
                value = '#' + value;
            }

            // Validate hex format
            if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                const rgb = hexToRgb(value);
                const hsb = rgbToHsb(rgb.r, rgb.g, rgb.b);

                // Update color picker state
                currentHue = hsb.h;
                currentSat = hsb.s;
                currentBrightness = hsb.b;

                // Update UI
                updateXYPadBackground(pickerId);
                updateXYCursorPosition(pickerId);
                updateHueThumbPosition(pickerId);
                document.getElementById(`hueValue-${pickerId}`).textContent = Math.round(currentHue);

                // Call the callback to update the page
                if (currentColorPickerCallback) {
                    currentColorPickerCallback(value);
                }
            }
        };

        // Update on Enter key
        hexInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleHexInput();
                hexInput.blur();
            }
        });

        // Update on blur (when clicking away)
        hexInput.addEventListener('blur', handleHexInput);

        // Select all on focus for easy replacement
        hexInput.addEventListener('focus', (e) => {
            e.target.select();
        });
    }
}

function updateSatBrightFromXY(e, xyPad, pickerId) {
    const rect = xyPad.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));

    currentSat = (x / rect.width) * 100;
    currentBrightness = 100 - (y / rect.height) * 100;

    updateXYCursorPosition(pickerId);
    updateColorFromHSB(pickerId);
}

function updateHueFromSlider(e, hueTrack, pickerId) {
    const rect = hueTrack.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));

    currentHue = (x / rect.width) * 360;

    document.getElementById(`hueValue-${pickerId}`).textContent = Math.round(currentHue);
    updateHueThumbPosition(pickerId);
    updateXYPadBackground(pickerId);
    updateColorFromHSB(pickerId);
}

function updateXYPadBackground(pickerId) {
    const xyPad = document.getElementById(`xyPad-${pickerId}`);
    if (!xyPad) return;

    const hueColor = hsbToRgb(currentHue, 100, 100);
    const hueHex = rgbToHex(hueColor.r, hueColor.g, hueColor.b);

    xyPad.style.background = `
        linear-gradient(to top, #000, transparent),
        linear-gradient(to right, #fff, ${hueHex})
    `;
}

function updateXYCursorPosition(pickerId) {
    const cursor = document.getElementById(`xyCursor-${pickerId}`);
    const pad = document.getElementById(`xyPad-${pickerId}`);
    if (!cursor || !pad) return;

    const x = (currentSat / 100) * pad.offsetWidth;
    const y = (1 - currentBrightness / 100) * pad.offsetHeight;

    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
}

function updateHueThumbPosition(pickerId) {
    const thumb = document.getElementById(`hueThumb-${pickerId}`);
    const track = document.getElementById(`hueTrack-${pickerId}`);
    if (!thumb || !track) return;

    const x = (currentHue / 360) * track.offsetWidth;
    thumb.style.left = `${x}px`;
}

function updateColorFromHSB(pickerId) {
    const rgb = hsbToRgb(currentHue, currentSat, currentBrightness);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

    // Update hex input field
    const hexInput = document.getElementById(`hexInput-${pickerId}`);
    if (hexInput) {
        hexInput.value = hex;
    }

    if (currentColorPickerCallback) {
        currentColorPickerCallback(hex);
    }
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

    return { h: h * 360, s, b: brightness };
}

function hsbToRgb(h, s, b) {
    h = h / 360;
    s = s / 100;
    b = b / 100;

    let r, g, blue;

    if (s === 0) {
        r = g = blue = b;
    } else {
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = b * (1 - s);
        const q = b * (1 - f * s);
        const t = b * (1 - (1 - f) * s);

        switch (i % 6) {
            case 0: r = b; g = t; blue = p; break;
            case 1: r = q; g = b; blue = p; break;
            case 2: r = p; g = b; blue = t; break;
            case 3: r = p; g = q; blue = b; break;
            case 4: r = t; g = p; blue = b; break;
            case 5: r = b; g = p; blue = q; break;
        }
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(blue * 255)
    };
}

// ============================================================================
// Output Generation
// ============================================================================

function generateFrontmatter(page) {
    const lines = ['---'];
    const data = page.data;

    // Helper to escape and quote strings
    const quote = (str) => {
        if (str === '') return "''";
        // Escape double quotes
        const escaped = str.replace(/"/g, '\\"');
        return `"${escaped}"`;
    };

    switch (page.type) {
        case 'blog':
            if (data.title) lines.push(`title: ${quote(data.title)}`);
            if (data.thumbnail) lines.push(`thumbnail: ${quote(data.thumbnail)}`);
            if (data.thumbnailAlt) lines.push(`thumbnailAlt: ${quote(data.thumbnailAlt)}`);
            if (data.date) lines.push(`date: ${quote(data.date)}`);
            break;

        case 'artwork':
            if (data.title) lines.push(`title: ${quote(data.title)}`);
            if (data.projectTags && data.projectTags.length > 0) {
                lines.push(`projectTags: [${data.projectTags.map(t => `"${t}"`).join(', ')}]`);
            }
            if (data.projectYear) lines.push(`projectYear: ${quote(data.projectYear)}`);
            if (data.description) lines.push(`description: ${data.description}`);
            if (data.lightbox) lines.push(`lightbox: true`);
            if (data.dark) lines.push(`dark: true`);

            if (data.customStyle && data.customStyle.enabled) {
                if (data.customStyle.type === 'image') {
                    if (data.customStyle.bgImage) {
                        lines.push(`bgImage: ${data.customStyle.bgImage}`);
                        if (data.customStyle.bgImageOpacity < 1.0) {
                            lines.push(`bgImageOpacity: ${data.customStyle.bgImageOpacity}`);
                        }
                    }
                } else {
                    lines.push(generateCustomStyleYAML(data.customStyle));
                }
            }

            if (data.thumbnail) lines.push(`thumbnail: ${data.thumbnail}`);
            if (data.thumbnailAlt) lines.push(`thumbnailAlt: ${data.thumbnailAlt}`);
            break;

        case 'notes':
            if (data.title) lines.push(`title: ${data.title}`);
            if (data.description) lines.push(`description: ${data.description}`);

            if (data.customStyle && data.customStyle.enabled) {
                lines.push(generateNotecardStyleYAML(data.customStyle, data.notecardDark, data.notecardTextColor));
                const customStyleYAML = generateCustomStyleYAML(data.customStyle);
                if (customStyleYAML) lines.push(customStyleYAML);
            }

            if (data.lightbox) lines.push(`lightbox: true`);
            if (data.dark) lines.push(`dark: true`);
            if (data.thumbnail) lines.push(`thumbnail: ${quote(data.thumbnail)}`);
            if (data.notecardDark) lines.push(`notecardDark: true`);
            break;
    }

    lines.push('---');
    return lines.join('\n');
}

function generateCustomStyleYAML(customStyle) {
    if (customStyle.type === 'solid') {
        return `customStyle: >\n  :root {\n    --main-bg-color:${customStyle.solidColor};\n    --main-bg-gradient:none;\n  }`;
    } else if (customStyle.type === 'gradient') {
        const stops = customStyle.gradientStops;
        const lastColor = stops[stops.length - 1];
        const gradient = `radial-gradient(${stops.join(', ')})`;
        return `customStyle: >\n  :root {\n    --main-bg-color:${lastColor};\n    --main-bg-gradient:${gradient};\n  }`;
    }
    return '';
}

function generateNotecardStyleYAML(customStyle, notecardDark, notecardTextColor) {
    let style = '';

    if (customStyle.type === 'solid') {
        style = `background-color:${customStyle.solidColor};`;
    } else if (customStyle.type === 'gradient') {
        const gradient = `radial-gradient(${customStyle.gradientStops.join(', ')})`;
        style = `background-image:${gradient};`;
    } else if (customStyle.type === 'image' && customStyle.bgImage) {
        style = `background-image:url(${customStyle.bgImage});`;
    }

    if (notecardDark) {
        const textColor = notecardTextColor || '#f2f2f2';
        style += `color:${textColor};`;
    }

    return `notecardStyle: '${style}'`;
}

function generateFilename(page) {
    switch (page.type) {
        case 'blog':
            return page.data.date ? `${page.data.date}.md` : 'untitled.md';
        case 'artwork':
        case 'notes':
            const title = page.data.title || 'untitled';
            const slug = title.toLowerCase()
                .replace(/[^\w\s-]/g, '')
                .replace(/\s+/g, '-');
            return `${slug}.md`;
        default:
            return 'untitled.md';
    }
}

// ============================================================================
// Copy to Clipboard
// ============================================================================

function copyOutput(pageId, type) {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    let text;
    if (type === 'frontmatter') {
        text = generateFrontmatter(page);
    } else if (type === 'filename') {
        text = generateFilename(page);
    }

    navigator.clipboard.writeText(text).then(() => {
        // Visual feedback could be added here
        console.log('Copied to clipboard');
    });
}

// ============================================================================
// Gradient Stop Drag and Drop
// ============================================================================

let draggedStopElement = null;
let draggedStopPageId = null;
let draggedStopIndex = null;

function setupGradientStopDragHandlers() {
    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('gradient-stop-row')) {
            draggedStopElement = e.target;
            draggedStopPageId = e.target.dataset.pageId;
            draggedStopIndex = parseInt(e.target.dataset.stopIndex);
            e.target.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        }
    });

    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('gradient-stop-row')) {
            e.target.style.opacity = '';
            draggedStopElement = null;
            draggedStopPageId = null;
            draggedStopIndex = null;
            // Clear all drop indicators
            document.querySelectorAll('.gradient-stop-row').forEach(row => {
                row.classList.remove('drop-before', 'drop-after');
            });
        }
    });

    document.addEventListener('dragover', (e) => {
        if (!draggedStopElement) return;

        const target = e.target.closest('.gradient-stop-row');
        if (target && target.dataset.pageId === draggedStopPageId) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            // Clear previous highlights
            document.querySelectorAll('.gradient-stop-row').forEach(row => {
                row.classList.remove('drop-before', 'drop-after');
            });

            // Don't highlight if it's the dragged element itself
            if (target === draggedStopElement) return;

            // Determine if we should drop before or after
            const rect = target.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;

            if (e.clientY < midpoint) {
                target.classList.add('drop-before');
            } else {
                target.classList.add('drop-after');
            }
        }
    });

    document.addEventListener('drop', (e) => {
        if (!draggedStopElement) return;

        const target = e.target.closest('.gradient-stop-row');
        if (target && target.dataset.pageId === draggedStopPageId && target !== draggedStopElement) {
            e.preventDefault();

            const page = pages.find(p => p.id === draggedStopPageId);
            if (!page) return;

            const stops = page.data.customStyle.gradientStops;
            const targetIndex = parseInt(target.dataset.stopIndex);

            // Determine if we should drop before or after
            const rect = target.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            // Since display order is reversed (bottom to top), invert the dropBefore logic
            const dropBefore = e.clientY >= midpoint;

            // Remove the dragged item
            const [movedStop] = stops.splice(draggedStopIndex, 1);

            // Calculate new index
            let newIndex = targetIndex;
            if (draggedStopIndex < targetIndex) {
                newIndex = dropBefore ? targetIndex - 1 : targetIndex;
            } else {
                newIndex = dropBefore ? targetIndex : targetIndex + 1;
            }

            // Insert at new position
            stops.splice(newIndex, 0, movedStop);

            saveToLocalStorage();
            renderAllPages();
        }

        // Clear highlights
        document.querySelectorAll('.gradient-stop-row').forEach(row => {
            row.classList.remove('drop-before', 'drop-after');
        });
    });
}

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    setupGradientStopDragHandlers();

    // Close color picker when clicking outside (but not when just releasing a drag)
    document.addEventListener('mousedown', (e) => {
        // Only close if we actually clicked outside, not if we're dragging
        if (currentPickerId && !isDraggingXY && !isDraggingHue) {
            if (!e.target.closest('.inline-color-picker') && !e.target.closest('.color-preview')) {
                closeColorPicker();
            }
        }
    });
});
