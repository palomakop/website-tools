class PinnedColors extends HTMLElement {
    constructor() {
        super();
        this.pinnedColorIds = [];
        this.pinnedGradientIds = [];
        this.savedStyles = [];
    }

    connectedCallback() {
        this.loadFromLocalStorage();
        this.render();

        // Listen for updates from other tools
        window.addEventListener('pinnedColorsUpdated', () => {
            this.loadFromLocalStorage();
            this.render();
        });
    }

    loadFromLocalStorage() {
        const stored = localStorage.getItem('websitetools-colors');
        if (stored) {
            const data = JSON.parse(stored);
            this.pinnedColorIds = data.pinnedColorIds || [];
            this.pinnedGradientIds = data.pinnedGradientIds || [];
            this.colorsData = data.colorsData || null;
            this.savedStyles = data.savedStyles || [];
        }
    }

    getAllColors() {
        const colors = [];
        if (!this.colorsData) return colors;

        const groups = this.parseColorData(this.colorsData);
        groups.forEach((group, groupIdx) => {
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

    getAllGradients() {
        const gradients = [];
        if (!this.colorsData) return gradients;

        const groups = this.parseColorData(this.colorsData);
        groups.forEach((group, groupIdx) => {
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

        return gradients;
    }

    parseColorData(data) {
        const groups = [];

        ['css', 'frontmatter'].forEach(topLevel => {
            if (!data[topLevel]) return;

            Object.keys(data[topLevel]).forEach(groupName => {
                const groupData = data[topLevel][groupName];
                const items = [];

                Object.keys(groupData).forEach(propName => {
                    const item = groupData[propName];

                    if (item.type === 'color') {
                        items.push({
                            type: 'color',
                            name: propName,
                            hex: item.value
                        });
                    } else if (item.type === 'gradient') {
                        const stops = this.extractGradientStops(item.value);
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

    extractGradientStops(gradientCSS) {
        const colorRegex = /#[0-9A-Fa-f]{3,6}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-z]+/g;
        const matches = gradientCSS.match(colorRegex);

        if (!matches) return [];

        const excludeWords = ['radial', 'linear', 'to', 'right', 'left', 'top', 'bottom', 'gradient', 'repeating'];
        const stops = matches.filter(match => {
            return !excludeWords.includes(match.toLowerCase());
        });

        return stops;
    }

    getPinnedColors() {
        const allColors = this.getAllColors();
        return allColors.filter(color => this.pinnedColorIds.includes(color.id));
    }

    getPinnedGradients() {
        const allGradients = this.getAllGradients();
        return allGradients.filter(gradient => this.pinnedGradientIds.includes(gradient.id));
    }

    unpinColor(colorId) {
        const index = this.pinnedColorIds.indexOf(colorId);
        if (index > -1) {
            this.pinnedColorIds.splice(index, 1);
            this.saveToLocalStorage();
            this.render();
        }
    }

    unpinGradient(gradientId) {
        const index = this.pinnedGradientIds.indexOf(gradientId);
        if (index > -1) {
            this.pinnedGradientIds.splice(index, 1);
            this.saveToLocalStorage();
            this.render();
        }
    }

    deleteSavedStyle(styleId) {
        const index = this.savedStyles.findIndex(s => s.id === styleId);
        if (index > -1) {
            this.savedStyles.splice(index, 1);
            this.saveToLocalStorage();
            this.render();
        }
    }

    clearAllPins() {
        if (!confirm('Clear all pinned colors, gradients, and saved styles?')) {
            return;
        }

        this.pinnedColorIds = [];
        this.pinnedGradientIds = [];
        this.savedStyles = [];
        this.saveToLocalStorage();
        this.render();
    }

    saveToLocalStorage() {
        const stored = localStorage.getItem('websitetools-colors');
        const data = stored ? JSON.parse(stored) : {};

        data.pinnedColorIds = this.pinnedColorIds;
        data.pinnedGradientIds = this.pinnedGradientIds;
        data.savedStyles = this.savedStyles;

        localStorage.setItem('websitetools-colors', JSON.stringify(data));

        // Dispatch event for other tools to listen to
        window.dispatchEvent(new CustomEvent('pinnedColorsUpdated'));
    }

    setupDragHandlers() {
        const pinnedItems = this.querySelectorAll('[data-drag-type]');

        pinnedItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                const dragType = e.currentTarget.dataset.dragType;

                if (dragType === 'color') {
                    const hex = e.currentTarget.dataset.colorHex;
                    const colorId = e.currentTarget.dataset.colorId;
                    e.dataTransfer.setData('text/plain', hex);
                    e.dataTransfer.setData('application/pinned-color', hex);
                    if (colorId) {
                        e.dataTransfer.setData('application/color-id', colorId);
                    }
                } else if (dragType === 'gradient') {
                    const stops = e.currentTarget.dataset.gradientStops;
                    const gradientId = e.currentTarget.dataset.gradientId;
                    e.dataTransfer.setData('text/plain', stops);
                    e.dataTransfer.setData('application/pinned-gradient', stops);
                    if (gradientId) {
                        e.dataTransfer.setData('application/gradient-id', gradientId);
                    }
                } else if (dragType === 'saved-style') {
                    const styleId = e.currentTarget.dataset.styleId;
                    const style = this.savedStyles.find(s => s.id === styleId);
                    if (style) {
                        e.dataTransfer.setData('application/saved-style', JSON.stringify(style));
                    }
                }

                e.dataTransfer.effectAllowed = 'copy';
                e.currentTarget.style.opacity = '0.5';
            });

            item.addEventListener('dragend', (e) => {
                e.currentTarget.style.opacity = '';
            });
        });

        // Setup drop zone on sidebar
        this.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            this.classList.add('drag-over');
        });

        this.addEventListener('dragleave', (e) => {
            if (e.currentTarget === this) {
                this.classList.remove('drag-over');
            }
        });

        this.addEventListener('drop', (e) => {
            e.preventDefault();
            this.classList.remove('drag-over');

            const colorId = e.dataTransfer.getData('application/color-id');
            const gradientId = e.dataTransfer.getData('application/gradient-id');

            if (colorId && !this.pinnedColorIds.includes(colorId)) {
                this.pinnedColorIds.push(colorId);
                this.saveToLocalStorage();
                this.render();
            } else if (gradientId && !this.pinnedGradientIds.includes(gradientId)) {
                this.pinnedGradientIds.push(gradientId);
                this.saveToLocalStorage();
                this.render();
            }
        });
    }

    render() {
        const pinnedColors = this.getPinnedColors();
        const pinnedGradients = this.getPinnedGradients();
        const savedStyles = this.savedStyles || [];

        if (pinnedColors.length === 0 && pinnedGradients.length === 0 && savedStyles.length === 0) {
            this.style.display = 'none';
            return;
        }

        this.style.display = 'block';

        // Combine all pinned items
        const allItems = [...pinnedColors, ...pinnedGradients];

        // Group by groupTitle
        const groupedItems = {};
        allItems.forEach(item => {
            const groupTitle = item.groupTitle || 'Uncategorized';
            if (!groupedItems[groupTitle]) {
                groupedItems[groupTitle] = [];
            }
            groupedItems[groupTitle].push(item);
        });

        let html = `
            <div class="sidebar-header">
                <h3>Pinned Colors</h3>
                <button class="clear-pins-btn" title="Clear all pins">Clear</button>
            </div>
            <div id="pinnedColorsDisplay">
        `;

        // Render each group
        Object.keys(groupedItems).forEach(groupTitle => {
            const items = groupedItems[groupTitle];

            html += `<div class="pinned-group">`;
            html += `<div class="pinned-group-title">${groupTitle}</div>`;
            html += `<div class="pinned-group-items">`;

            items.forEach(item => {
                if (item.hex) {
                    // It's a color
                    html += `
                        <div class="pinned-color-item" draggable="true" data-color-hex="${item.hex}" data-color-id="${item.id}" data-drag-type="color" title="${item.name}">
                            <div class="pinned-color-swatch" style="background-color: ${item.hex};"></div>
                            <div class="pinned-color-info">
                                <div class="pinned-color-name">${item.name}</div>
                                <div class="pinned-color-hex">${item.hex}</div>
                            </div>
                            <button class="pinned-color-unpin" data-color-id="${item.id}" title="Unpin">
                                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
                            </button>
                        </div>
                    `;
                } else if (item.stops) {
                    // It's a gradient
                    const gradientCSS = `radial-gradient(${item.stops.join(', ')})`;
                    html += `
                        <div class="pinned-gradient-item" draggable="true" data-gradient-stops='${JSON.stringify(item.stops)}' data-gradient-id="${item.id}" data-drag-type="gradient" title="${item.name}">
                            <div class="pinned-gradient-preview" style="background: ${gradientCSS};"></div>
                            <div class="pinned-gradient-info">
                                <div class="pinned-gradient-name">${item.name}</div>
                                <div class="pinned-gradient-stops">${item.stops.length} stops</div>
                            </div>
                            <button class="pinned-color-unpin" data-gradient-id="${item.id}" title="Unpin">
                                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                                </svg>
                            </button>
                        </div>
                    `;
                }
            });

            html += `</div></div>`;
        });

        // Render saved styles section
        if (savedStyles.length > 0) {
            html += `<div class="pinned-group">`;
            html += `<div class="pinned-group-title">Saved Styles</div>`;
            html += `<div class="pinned-group-items">`;

            savedStyles.forEach(style => {
                let previewStyle = '';
                let infoText = '';

                if (style.type === 'solid') {
                    previewStyle = `background-color: ${style.solidColor};`;
                    infoText = style.solidColor;
                } else if (style.type === 'gradient') {
                    previewStyle = `background: radial-gradient(${style.gradientStops.join(', ')});`;
                    infoText = `${style.gradientStops.length} stops`;
                } else if (style.type === 'image') {
                    previewStyle = `background-image: url(${style.bgImage}); background-size: cover; background-position: center; opacity: ${style.bgImageOpacity};`;
                    infoText = 'Background Image';
                }

                html += `
                    <div class="pinned-gradient-item" draggable="true" data-style-id="${style.id}" data-drag-type="saved-style" title="${style.name}">
                        <div class="pinned-gradient-preview" style="${previewStyle}"></div>
                        <div class="pinned-gradient-info">
                            <div class="pinned-gradient-name">${style.name}</div>
                            <div class="pinned-gradient-stops">${infoText}</div>
                        </div>
                        <button class="pinned-color-unpin" data-style-id="${style.id}" title="Delete">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                        </button>
                    </div>
                `;
            });

            html += `</div></div>`;
        }

        html += `</div>`;

        this.innerHTML = html;

        // Setup event listeners
        this.querySelector('.clear-pins-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.clearAllPins();
        });

        this.querySelectorAll('.pinned-color-unpin').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const colorId = btn.dataset.colorId;
                const gradientId = btn.dataset.gradientId;
                const styleId = btn.dataset.styleId;

                if (colorId) {
                    this.unpinColor(colorId);
                } else if (gradientId) {
                    this.unpinGradient(gradientId);
                } else if (styleId) {
                    this.deleteSavedStyle(styleId);
                }
            });
        });

        this.setupDragHandlers();
    }
}

customElements.define('pinned-colors', PinnedColors);
