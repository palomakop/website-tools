        let blockIdCounter = 0;
        let selectedThumbnails = new Set();
        let lastSelectedThumbnail = null;
        let selectedGalleryImages = new Set();
        let lastSelectedGalleryImage = null;

        // Load images from textarea
        function loadImages() {
            const input = document.getElementById('urlInput');
            const urls = input.value.split('\n').filter(url => url.trim() !== '');

            if (urls.length === 0) {
                alert('Please enter at least one image URL');
                return;
            }

            const stagingArea = document.getElementById('stagingArea');

            urls.forEach(url => {
                const thumbnail = createThumbnail(url.trim());
                stagingArea.appendChild(thumbnail);
            });

            input.value = '';
            saveState();
        }

        // Create a thumbnail element with optional metadata
        function createThumbnail(url, metadata = {}) {
            const div = document.createElement('div');
            div.className = 'thumbnail';
            div.draggable = true;
            div.dataset.url = url;

            // Store metadata
            if (metadata.description) div.dataset.description = metadata.description;
            if (metadata.width) div.dataset.width = metadata.width;
            if (metadata.classes) div.dataset.classes = metadata.classes;
            if (metadata.isFullWidth !== undefined) div.dataset.isFullWidth = metadata.isFullWidth;
            if (metadata.showCaption !== undefined) div.dataset.showCaption = metadata.showCaption;

            const filename = url.split('/').pop();

            div.innerHTML = `
                <button class="thumbnail-remove" onclick="removeThumbnail(this); event.stopPropagation();">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
                <img src="${url}" alt="${filename}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect width=%22100%22 height=%22100%22 fill=%22%23ddd%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22>Error</text></svg>'">
                <div class="thumbnail-caption">${filename}</div>
            `;

            // Add click handler for selection
            div.addEventListener('click', handleThumbnailClick);

            addDragListeners(div);
            return div;
        }

        // Handle thumbnail selection
        function handleThumbnailClick(e) {
            // Don't select if clicking the remove button
            if (e.target.closest('.thumbnail-remove')) return;

            const thumbnail = this;

            // Check if shift key is pressed for range selection
            if (e.shiftKey && lastSelectedThumbnail && lastSelectedThumbnail.parentElement === thumbnail.parentElement) {
                // Range selection
                const stagingArea = document.getElementById('stagingArea');
                const thumbnails = Array.from(stagingArea.querySelectorAll('.thumbnail'));
                const startIndex = thumbnails.indexOf(lastSelectedThumbnail);
                const endIndex = thumbnails.indexOf(thumbnail);
                const [minIndex, maxIndex] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];

                // Select all thumbnails in range
                for (let i = minIndex; i <= maxIndex; i++) {
                    selectedThumbnails.add(thumbnails[i]);
                    thumbnails[i].classList.add('selected');
                }
            } else if (e.metaKey || e.ctrlKey) {
                // Toggle selection
                if (selectedThumbnails.has(thumbnail)) {
                    selectedThumbnails.delete(thumbnail);
                    thumbnail.classList.remove('selected');
                } else {
                    selectedThumbnails.add(thumbnail);
                    thumbnail.classList.add('selected');
                    lastSelectedThumbnail = thumbnail;
                }
            } else {
                // Clear previous selection and select only this one
                clearSelection();
                selectedThumbnails.add(thumbnail);
                thumbnail.classList.add('selected');
                lastSelectedThumbnail = thumbnail;
            }

            updateSelectionUI();
        }

        // Update selection UI
        function updateSelectionUI() {
            const count = selectedThumbnails.size;
            const selectionActions = document.getElementById('selectionActions');
            const selectionCount = document.getElementById('selectionCount');
            const createImageBtn = document.getElementById('createImageFromSelection');
            const createGalleryBtn = document.getElementById('createGalleryFromSelection');

            selectionCount.textContent = count;

            if (count > 0) {
                selectionActions.classList.add('visible');
                if (count === 1) {
                    createImageBtn.style.display = 'inline-block';
                    createGalleryBtn.style.display = 'inline-block';
                } else {
                    createImageBtn.style.display = 'none';
                    createGalleryBtn.style.display = 'inline-block';
                }
            } else {
                selectionActions.classList.remove('visible');
            }
        }

        // Clear selection
        function clearSelection() {
            selectedThumbnails.forEach(thumb => {
                thumb.classList.remove('selected');
            });
            selectedThumbnails.clear();
            lastSelectedThumbnail = null;
            updateSelectionUI();
        }

        // Create image block from selection
        function createImageBlockFromSelection() {
            if (selectedThumbnails.size !== 1) return;

            const thumbnail = Array.from(selectedThumbnails)[0];
            const url = thumbnail.dataset.url;
            const metadata = {
                description: thumbnail.dataset.description || '',
                width: thumbnail.dataset.width || '1440',
                classes: thumbnail.dataset.classes || '',
                isFullWidth: thumbnail.dataset.isFullWidth === 'true',
                showCaption: thumbnail.dataset.showCaption === 'true'
            };

            // Create image block
            const blockId = `block-${blockIdCounter++}`;
            const container = document.getElementById('blocksContainer');

            const block = document.createElement('div');
            block.className = 'block image-block';
            block.id = blockId;
            block.innerHTML = `
                <div class="block-header">
                    <div class="block-title">Image Block</div>
                    <button class="delete-btn" onclick="deleteBlock('${blockId}')">Delete Block</button>
                </div>
                <div class="drop-zone" data-block-type="image" data-block-id="${blockId}">
                </div>
                <div class="shortcode-output">
                    <div class="output-header">
                        <div class="output-label">Shortcode:</div>
                        <button class="copy-btn" onclick="copyShortcode('${blockId}', this)">Copy</button>
                    </div>
                    <pre id="${blockId}-output"></pre>
                </div>
            `;

            container.appendChild(block);

            const dropZone = block.querySelector('.drop-zone');
            setupDropZone(dropZone, 'image', blockId);

            // Add image to block
            const imageRow = createImageRow(url, 'image', blockId, metadata);
            dropZone.appendChild(imageRow);
            updateShortcode(blockId);

            // Remove thumbnail
            thumbnail.remove();
            selectedThumbnails.clear();
            updateSelectionUI();
            saveState();
        }

        // Create gallery block from selection
        function createGalleryBlockFromSelection() {
            if (selectedThumbnails.size < 1) return;

            // Get thumbnails in order they appear in staging area
            const stagingArea = document.getElementById('stagingArea');
            const allThumbs = Array.from(stagingArea.querySelectorAll('.thumbnail'));
            const selectedInOrder = allThumbs.filter(thumb => selectedThumbnails.has(thumb));

            // Create gallery block
            const blockId = `block-${blockIdCounter++}`;
            const container = document.getElementById('blocksContainer');

            const block = document.createElement('div');
            block.className = 'block gallery-block';
            block.id = blockId;
            block.innerHTML = `
                <div class="block-header">
                    <div class="block-title">Gallery Block</div>
                    <button class="delete-btn" onclick="deleteBlock('${blockId}')">Delete Block</button>
                </div>
                <div class="gallery-type-selector">
                    <label>Gallery Type:</label>
                    <select onchange="updateGalleryType('${blockId}', this.value)">
                        <option value="two-column">Two Column</option>
                        <option value="three-column">Three Column</option>
                        <option value="vertical">Vertical</option>
                        <option value="tarot">Tarot</option>
                    </select>
                </div>
                <div class="drop-zone" data-block-type="gallery" data-block-id="${blockId}" data-gallery-type="two-column">
                </div>
                <div class="shortcode-output">
                    <div class="output-header">
                        <div class="output-label">Shortcode:</div>
                        <button class="copy-btn" onclick="copyShortcode('${blockId}', this)">Copy</button>
                    </div>
                    <pre id="${blockId}-output"></pre>
                </div>
            `;

            container.appendChild(block);

            const dropZone = block.querySelector('.drop-zone');
            setupDropZone(dropZone, 'gallery', blockId);

            // Add images to gallery in order
            selectedInOrder.forEach(thumbnail => {
                const url = thumbnail.dataset.url;
                const metadata = {
                    description: thumbnail.dataset.description || '',
                    width: thumbnail.dataset.width || '1440',
                    classes: thumbnail.dataset.classes || '',
                    isFullWidth: thumbnail.dataset.isFullWidth === 'true',
                    showCaption: thumbnail.dataset.showCaption === 'true'
                };

                const imageRow = createImageRow(url, 'gallery', blockId, metadata);
                dropZone.appendChild(imageRow);
                thumbnail.remove();
            });

            updateShortcode(blockId);
            selectedThumbnails.clear();
            updateSelectionUI();
            saveState();
        }

        // Remove thumbnail from staging area
        function removeThumbnail(btn) {
            const thumbnail = btn.closest('.thumbnail');
            if (selectedThumbnails.has(thumbnail)) {
                selectedThumbnails.delete(thumbnail);
                updateSelectionUI();
            }
            if (lastSelectedThumbnail === thumbnail) {
                lastSelectedThumbnail = null;
            }
            thumbnail.remove();
            saveState();
        }

        // Add drag event listeners
        function addDragListeners(element) {
            element.addEventListener('dragstart', handleDragStart);
            element.addEventListener('dragend', handleDragEnd);
            element.addEventListener('dragover', handleDragOver);
            element.addEventListener('dragleave', handleDragLeave);
            element.addEventListener('drop', handleDrop);
        }

        let draggedElement = null;
        let draggedGroup = [];

        function createDropSpacer(orientation, beforeElement, afterElement) {
            const spacer = document.createElement('div');
            spacer.className = orientation === 'horizontal' ? 'drop-spacer-horizontal' : 'drop-spacer-vertical';
            spacer.dataset.beforeElement = beforeElement ? 'true' : 'false';
            spacer.dataset.afterElement = afterElement ? 'true' : 'false';

            spacer.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                spacer.classList.add('active');

                // Highlight adjacent elements
                if (beforeElement && beforeElement !== draggedElement) {
                    beforeElement.classList.add('drop-after');
                }
                if (afterElement && afterElement !== draggedElement) {
                    afterElement.classList.add('drop-before');
                }
            });

            spacer.addEventListener('dragleave', (e) => {
                spacer.classList.remove('active');
                clearDropHighlights();
            });

            spacer.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                spacer.classList.remove('active');
                clearDropHighlights();

                if (!draggedElement) return;

                // Insert dragged element at this position
                const parent = spacer.parentElement;

                // Store old parent for update tracking
                const oldParent = draggedElement.closest('.drop-zone');
                const oldBlockId = oldParent ? oldParent.dataset.blockId : null;

                parent.insertBefore(draggedElement, afterElement);

                // Update state based on container type
                if (parent.id === 'stagingArea') {
                    saveState();
                    // If moved from a block, update that block's shortcode
                    if (oldBlockId) {
                        updateShortcode(oldBlockId);
                    }
                } else if (parent.classList.contains('drop-zone')) {
                    const blockId = parent.dataset.blockId;
                    updateShortcode(blockId);
                    // If moved from a different block, update that too
                    if (oldBlockId && oldBlockId !== blockId) {
                        updateShortcode(oldBlockId);
                    }
                    saveState();
                }
            });

            return spacer;
        }

        function insertSpacers(container, orientation) {
            const items = Array.from(container.children).filter(child =>
                child.classList.contains('thumbnail') || child.classList.contains('image-row')
            );

            if (items.length === 0) {
                // If container is empty, add a single spacer
                const spacer = createDropSpacer(orientation, null, null);
                container.appendChild(spacer);
                return;
            }

            // Add spacer at the beginning
            const spacer = createDropSpacer(orientation, null, items[0]);
            container.insertBefore(spacer, items[0]);

            // Add spacers between items
            for (let i = 0; i < items.length - 1; i++) {
                const spacer = createDropSpacer(orientation, items[i], items[i + 1]);
                container.insertBefore(spacer, items[i + 1]);
            }

            // Add spacer at the end
            const endSpacer = createDropSpacer(orientation, items[items.length - 1], null);
            container.appendChild(endSpacer);
        }

        function removeSpacers() {
            document.querySelectorAll('.drop-spacer-horizontal, .drop-spacer-vertical').forEach(spacer => {
                spacer.remove();
            });
        }

        function handleDragStart(e) {
            draggedElement = this;
            draggedGroup = [];

            // Check if dragging multiple items
            if (this.classList.contains('thumbnail') && selectedThumbnails.has(this) && selectedThumbnails.size > 1) {
                // Dragging multiple thumbnails
                const stagingArea = document.getElementById('stagingArea');
                const allThumbs = Array.from(stagingArea.querySelectorAll('.thumbnail'));
                draggedGroup = allThumbs.filter(thumb => selectedThumbnails.has(thumb));
                draggedGroup.forEach(thumb => thumb.classList.add('dragging'));
            } else if (this.classList.contains('image-row') && selectedGalleryImages.has(this) && selectedGalleryImages.size > 1) {
                // Dragging multiple gallery images
                const gallery = this.closest('.drop-zone');
                const allImages = Array.from(gallery.querySelectorAll('.image-row'));
                draggedGroup = allImages.filter(img => selectedGalleryImages.has(img));
                draggedGroup.forEach(img => img.classList.add('dragging'));
            } else {
                // Single item drag
                this.classList.add('dragging');
            }

            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);

            // Add spacers only for gallery image rows
            if (this.classList.contains('image-row')) {
                const dropZone = this.closest('.drop-zone');
                if (dropZone) {
                    insertSpacers(dropZone, 'horizontal');
                }
            }
        }

        function handleDragEnd(e) {
            this.classList.remove('dragging');
            // Clear dragging from all group members
            draggedGroup.forEach(item => item.classList.remove('dragging'));
            draggedGroup = [];
            clearDropHighlights();
            removeSpacers();
        }

        function handleDragOver(e) {
            if (!draggedElement || draggedElement === this) {
                clearDropHighlights();
                return;
            }

            // Skip if this item is in the dragged group
            if (draggedGroup.length > 0 && draggedGroup.includes(this)) {
                clearDropHighlights();
                return;
            }

            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            // Clear previous highlights
            clearDropHighlights();

            const rect = this.getBoundingClientRect();

            // Check if we're dragging over an image-row (either reordering or adding from outside)
            if (this.classList.contains('image-row') && (draggedElement.classList.contains('image-row') || draggedElement.classList.contains('thumbnail'))) {
                const thisParent = this.closest('.drop-zone');
                const draggedParent = draggedElement.closest('.drop-zone');

                // Check if it's a gallery drop zone (not image block)
                if (thisParent && thisParent.dataset.blockType === 'gallery') {
                    // Highlight edges for any drop (reordering or new)
                    const midpoint = rect.top + rect.height / 2;

                    if (e.clientY < midpoint) {
                        // Highlight top of this item and bottom of previous item
                        this.classList.add('drop-before');
                        if (this.previousElementSibling && this.previousElementSibling !== draggedElement &&
                            !draggedGroup.includes(this.previousElementSibling) &&
                            this.previousElementSibling.classList.contains('image-row')) {
                            this.previousElementSibling.classList.add('drop-after');
                        }
                    } else {
                        // Highlight bottom of this item and top of next item
                        this.classList.add('drop-after');
                        if (this.nextElementSibling && this.nextElementSibling !== draggedElement &&
                            !draggedGroup.includes(this.nextElementSibling) &&
                            this.nextElementSibling.classList.contains('image-row')) {
                            this.nextElementSibling.classList.add('drop-before');
                        }
                    }
                    return;
                }
            } else if (this.classList.contains('thumbnail') && (draggedElement.classList.contains('thumbnail') || draggedElement.classList.contains('image-row'))) {
                // Check if dropping onto thumbnail in staging area
                const thisParent = this.parentElement;

                if (thisParent && thisParent.id === 'stagingArea') {
                    // Highlight edges (vertical)
                    const midpoint = rect.top + rect.height / 2;

                    if (e.clientY < midpoint) {
                        // Highlight top of this item and bottom of previous item
                        this.classList.add('drop-before');
                        if (this.previousElementSibling && this.previousElementSibling !== draggedElement &&
                            !draggedGroup.includes(this.previousElementSibling) &&
                            this.previousElementSibling.classList.contains('thumbnail')) {
                            this.previousElementSibling.classList.add('drop-after');
                        }
                    } else {
                        // Highlight bottom of this item and top of next item
                        this.classList.add('drop-after');
                        if (this.nextElementSibling && this.nextElementSibling !== draggedElement &&
                            !draggedGroup.includes(this.nextElementSibling) &&
                            this.nextElementSibling.classList.contains('thumbnail')) {
                            this.nextElementSibling.classList.add('drop-before');
                        }
                    }
                    return;
                }
            }
        }

        function clearDropHighlights() {
            document.querySelectorAll('.drop-before, .drop-after').forEach(el => {
                el.classList.remove('drop-before', 'drop-after');
            });
        }

        function handleDragLeave(e) {
            // Don't remove indicator on simple dragleave, only when truly leaving
        }

        function handleDrop(e) {
            e.stopPropagation();
            e.preventDefault();

            clearDropHighlights();

            if (!draggedElement || draggedElement === this) {
                return;
            }

            // Handle drops on image-rows (reordering or adding from outside)
            if (this.classList.contains('image-row') && (draggedElement.classList.contains('image-row') || draggedElement.classList.contains('thumbnail'))) {
                const thisParent = this.closest('.drop-zone');
                const draggedParent = draggedElement.closest('.drop-zone');

                // Check if it's a gallery drop zone
                if (thisParent && thisParent.dataset.blockType === 'gallery') {
                    const rect = this.getBoundingClientRect();
                    const midpoint = rect.top + rect.height / 2;
                    const threshold = rect.height * 0.4;
                    const relativeY = e.clientY - rect.top;

                    const blockId = thisParent.dataset.blockId;
                    const blockType = thisParent.dataset.blockType;

                    // Handle thumbnail(s) from staging
                    if (draggedElement.classList.contains('thumbnail')) {
                        const insertPosition = (relativeY < threshold || e.clientY < midpoint) ? this : this.nextSibling;

                        // Clear existing gallery selection
                        clearGallerySelection();

                        // Handle group drag
                        if (draggedGroup.length > 1) {
                            const newImageRows = [];
                            draggedGroup.forEach(thumb => {
                                const url = thumb.dataset.url;
                                const metadata = {
                                    description: thumb.dataset.description || '',
                                    width: thumb.dataset.width || '1440',
                                    classes: thumb.dataset.classes || '',
                                    isFullWidth: thumb.dataset.isFullWidth === 'true',
                                    showCaption: thumb.dataset.showCaption === 'true'
                                };

                                thumb.remove();
                                const imageRow = createImageRow(url, blockType, blockId, metadata);
                                thisParent.insertBefore(imageRow, insertPosition);
                                newImageRows.push(imageRow);
                            });

                            // Select the newly inserted images
                            newImageRows.forEach(row => {
                                selectedGalleryImages.add(row);
                                row.classList.add('selected');
                            });
                            if (newImageRows.length > 0) {
                                lastSelectedGalleryImage = newImageRows[0];
                            }

                            clearSelection();
                        } else {
                            const url = draggedElement.dataset.url;
                            const metadata = {
                                description: draggedElement.dataset.description || '',
                                width: draggedElement.dataset.width || '1440',
                                classes: draggedElement.dataset.classes || '',
                                isFullWidth: draggedElement.dataset.isFullWidth === 'true',
                                showCaption: draggedElement.dataset.showCaption === 'true'
                            };

                            draggedElement.remove();
                            const imageRow = createImageRow(url, blockType, blockId, metadata);
                            thisParent.insertBefore(imageRow, insertPosition);
                        }

                        updateShortcode(blockId);
                        saveState();
                        return;
                    }

                    // Handle image-row (reordering or moving between galleries)
                    if (draggedElement.classList.contains('image-row')) {
                        const insertPosition = (relativeY < threshold || e.clientY < midpoint) ? this : this.nextSibling;

                        // Handle group drag
                        if (draggedGroup.length > 1) {
                            const oldBlockId = draggedGroup[0].dataset.blockId;
                            draggedGroup.forEach(img => {
                                thisParent.insertBefore(img, insertPosition);
                                img.dataset.blockId = blockId;
                            });

                            updateShortcode(blockId);
                            if (oldBlockId && oldBlockId !== blockId) {
                                updateShortcode(oldBlockId);
                            }

                            // Keep selection persistent in galleries
                        } else {
                            const oldBlockId = draggedElement.dataset.blockId;
                            thisParent.insertBefore(draggedElement, insertPosition);
                            draggedElement.dataset.blockId = blockId;

                            updateShortcode(blockId);
                            if (oldBlockId && oldBlockId !== blockId) {
                                updateShortcode(oldBlockId);
                            }
                        }

                        saveState();
                        return;
                    }
                }
            } else if (this.classList.contains('thumbnail') && (draggedElement.classList.contains('thumbnail') || draggedElement.classList.contains('image-row'))) {
                // Dropping onto a thumbnail in staging area
                const thisParent = this.parentElement;

                if (thisParent && thisParent.id === 'stagingArea') {
                    const rect = this.getBoundingClientRect();
                    const midpoint = rect.top + rect.height / 2;
                    const threshold = rect.height * 0.4;
                    const relativeY = e.clientY - rect.top;

                    // Handle thumbnail from staging (reordering)
                    if (draggedElement.classList.contains('thumbnail')) {
                        const insertPosition = (relativeY < threshold || e.clientY < midpoint) ? this : this.nextSibling;

                        // Handle group drag
                        if (draggedGroup.length > 1) {
                            draggedGroup.forEach(thumb => {
                                thisParent.insertBefore(thumb, insertPosition);
                            });
                            // Keep selection persistent
                        } else {
                            thisParent.insertBefore(draggedElement, insertPosition);
                        }
                        saveState();
                        return;
                    }

                    // Handle image-row(s) from block (moving to staging)
                    if (draggedElement.classList.contains('image-row')) {
                        const insertPosition = (relativeY < threshold || e.clientY < midpoint) ? this : this.nextSibling;

                        // Clear existing staging selection
                        clearSelection();

                        // Handle group drag
                        if (draggedGroup.length > 1) {
                            const blockId = draggedGroup[0].dataset.blockId;
                            const newThumbnails = [];

                            draggedGroup.forEach(imageRow => {
                                const url = imageRow.dataset.url;
                                const inputs = imageRow.querySelectorAll('input');
                                const metadata = {
                                    description: inputs[0].value || '',
                                    width: inputs[1] && inputs[1].type === 'number' ? inputs[1].value : '1440',
                                    classes: inputs[2] && inputs[2].type === 'text' ? inputs[2].value : '',
                                    showCaption: inputs[1] && inputs[1].type === 'checkbox' ? inputs[1].checked : false,
                                    isFullWidth: inputs[2] && inputs[2].type === 'checkbox' ? inputs[2].checked : false
                                };

                                imageRow.remove();
                                const thumbnail = createThumbnail(url, metadata);
                                thisParent.insertBefore(thumbnail, insertPosition);
                                newThumbnails.push(thumbnail);
                            });

                            // Select the newly inserted thumbnails
                            newThumbnails.forEach(thumb => {
                                selectedThumbnails.add(thumb);
                                thumb.classList.add('selected');
                            });
                            if (newThumbnails.length > 0) {
                                lastSelectedThumbnail = newThumbnails[0];
                            }
                            updateSelectionUI();

                            clearGallerySelection();
                            updateShortcode(blockId);
                        } else {
                            const url = draggedElement.dataset.url;
                            const blockId = draggedElement.dataset.blockId;

                            // Extract metadata from inputs
                            const inputs = draggedElement.querySelectorAll('input');
                            const metadata = {
                                description: inputs[0].value || '',
                                width: inputs[1] && inputs[1].type === 'number' ? inputs[1].value : '1440',
                                classes: inputs[2] && inputs[2].type === 'text' ? inputs[2].value : '',
                                showCaption: inputs[1] && inputs[1].type === 'checkbox' ? inputs[1].checked : false,
                                isFullWidth: inputs[2] && inputs[2].type === 'checkbox' ? inputs[2].checked : false
                            };

                            draggedElement.remove();
                            const thumbnail = createThumbnail(url, metadata);
                            thisParent.insertBefore(thumbnail, insertPosition);

                            updateShortcode(blockId);
                        }

                        saveState();
                        return;
                    }
                }
            }
        }

        // Setup drop zones
        function setupDropZone(element, blockType, blockId) {
            element.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                // Check if image block already has an image
                if (blockType === 'image') {
                    const hasImage = element.querySelector('.image-row');
                    if (hasImage && !draggedElement.classList.contains('image-row')) {
                        element.classList.add('invalid');
                        element.classList.remove('drag-over');
                        clearDropHighlights();
                        return;
                    }
                }

                // Only show drag-over if not reordering within the same container
                if (!draggedElement || !draggedElement.classList.contains('image-row') ||
                    draggedElement.closest('.drop-zone') !== element) {
                    element.classList.add('drag-over');
                    element.classList.remove('invalid');
                }
            });

            element.addEventListener('dragleave', (e) => {
                if (e.target === element) {
                    element.classList.remove('drag-over', 'invalid');
                }
            });

            element.addEventListener('drop', (e) => {
                e.preventDefault();
                element.classList.remove('drag-over', 'invalid');
                clearDropHighlights();

                if (!draggedElement) return;

                // Check if dropping into image block that already has an image
                if (blockType === 'image') {
                    const hasImage = element.querySelector('.image-row');
                    if (hasImage && !draggedElement.classList.contains('image-row')) {
                        // Block already has an image, reject the drop
                        return;
                    }
                }

                // Remove empty message if exists
                const emptyMsg = element.querySelector('.drop-zone-empty');
                if (emptyMsg) emptyMsg.remove();

                // Handle group drag
                if (draggedGroup.length > 1) {
                    clearGallerySelection();

                    // Handle thumbnails to gallery
                    if (draggedElement.classList.contains('thumbnail')) {
                        const newImageRows = [];
                        draggedGroup.forEach(thumb => {
                            const url = thumb.dataset.url;
                            const metadata = {
                                description: thumb.dataset.description || '',
                                width: thumb.dataset.width || '1440',
                                classes: thumb.dataset.classes || '',
                                isFullWidth: thumb.dataset.isFullWidth === 'true',
                                showCaption: thumb.dataset.showCaption === 'true'
                            };

                            thumb.remove();
                            const imageRow = createImageRow(url, blockType, blockId, metadata);
                            element.appendChild(imageRow);
                            newImageRows.push(imageRow);
                        });

                        // Select the newly inserted images
                        newImageRows.forEach(row => {
                            selectedGalleryImages.add(row);
                            row.classList.add('selected');
                        });
                        if (newImageRows.length > 0) {
                            lastSelectedGalleryImage = newImageRows[0];
                        }

                        clearSelection();
                    }
                    // Handle gallery images moving between galleries
                    else if (draggedElement.classList.contains('image-row')) {
                        const oldBlockId = draggedGroup[0].dataset.blockId;
                        draggedGroup.forEach(img => {
                            element.appendChild(img);
                            img.dataset.blockId = blockId;
                        });

                        updateShortcode(blockId);
                        if (oldBlockId && oldBlockId !== blockId) {
                            updateShortcode(oldBlockId);
                        }
                    }

                    updateShortcode(blockId);
                    saveState();
                } else {
                    // Single item drop
                    let url, metadata = {}, oldBlockId;
                    if (draggedElement.classList.contains('thumbnail')) {
                        url = draggedElement.dataset.url;
                        metadata = {
                            description: draggedElement.dataset.description || '',
                            width: draggedElement.dataset.width || '1440',
                            classes: draggedElement.dataset.classes || '',
                            isFullWidth: draggedElement.dataset.isFullWidth === 'true',
                            showCaption: draggedElement.dataset.showCaption === 'true'
                        };
                    } else if (draggedElement.classList.contains('image-row')) {
                        url = draggedElement.dataset.url;
                        oldBlockId = draggedElement.dataset.blockId;
                        // Extract metadata from the image row inputs
                        const inputs = draggedElement.querySelectorAll('input');
                        metadata = {
                            description: inputs[0].value || '',
                            width: inputs[1] && inputs[1].type === 'number' ? inputs[1].value : '1440',
                            classes: inputs[2] && inputs[2].type === 'text' ? inputs[2].value : '',
                            showCaption: inputs[1] && inputs[1].type === 'checkbox' ? inputs[1].checked : false,
                            isFullWidth: inputs[2] && inputs[2].type === 'checkbox' ? inputs[2].checked : false
                        };
                    }

                    // Remove the dragged element
                    if (draggedElement) {
                        draggedElement.remove();
                    }

                    // Create image row
                    if (url) {
                        const imageRow = createImageRow(url, blockType, blockId, metadata);
                        element.appendChild(imageRow);
                        updateShortcode(blockId);

                        // Update old block's shortcode if moving from another block
                        if (oldBlockId && oldBlockId !== blockId) {
                            updateShortcode(oldBlockId);
                        }

                        saveState();
                    }
                }

                draggedElement = null;
            });
        }

        // Setup staging area as drop zone
        const stagingArea = document.getElementById('stagingArea');
        stagingArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';

            // Only show drag-over if not reordering within staging area
            if (!draggedElement || !draggedElement.classList.contains('thumbnail') ||
                draggedElement.parentElement !== stagingArea) {
                stagingArea.classList.add('drag-over');
            }
        });

        stagingArea.addEventListener('dragleave', (e) => {
            if (e.target === stagingArea) {
                stagingArea.classList.remove('drag-over');
            }
        });

        stagingArea.addEventListener('drop', (e) => {
            e.preventDefault();
            stagingArea.classList.remove('drag-over');
            clearDropHighlights();

            if (!draggedElement) {
                return;
            }

            if (draggedElement.classList.contains('image-row')) {
                // Handle group drag
                if (draggedGroup.length > 1) {
                    const blockId = draggedGroup[0].dataset.blockId;
                    const newThumbnails = [];

                    // Clear existing staging selection
                    clearSelection();

                    draggedGroup.forEach(imageRow => {
                        const url = imageRow.dataset.url;
                        const inputs = imageRow.querySelectorAll('input');
                        const metadata = {
                            description: inputs[0].value || '',
                            width: inputs[1] && inputs[1].type === 'number' ? inputs[1].value : '1440',
                            classes: inputs[2] && inputs[2].type === 'text' ? inputs[2].value : '',
                            showCaption: inputs[1] && inputs[1].type === 'checkbox' ? inputs[1].checked : false,
                            isFullWidth: inputs[2] && inputs[2].type === 'checkbox' ? inputs[2].checked : false
                        };

                        imageRow.remove();
                        const thumbnail = createThumbnail(url, metadata);
                        stagingArea.appendChild(thumbnail);
                        newThumbnails.push(thumbnail);
                    });

                    // Select the newly inserted thumbnails
                    newThumbnails.forEach(thumb => {
                        selectedThumbnails.add(thumb);
                        thumb.classList.add('selected');
                    });
                    if (newThumbnails.length > 0) {
                        lastSelectedThumbnail = newThumbnails[0];
                    }
                    updateSelectionUI();

                    clearGallerySelection();
                    updateShortcode(blockId);
                    saveState();
                } else {
                    const url = draggedElement.dataset.url;
                    const blockId = draggedElement.dataset.blockId;

                    // Extract metadata from inputs
                    const inputs = draggedElement.querySelectorAll('input');
                    const metadata = {
                        description: inputs[0].value || '',
                        width: inputs[1] && inputs[1].type === 'number' ? inputs[1].value : '1440',
                        classes: inputs[2] && inputs[2].type === 'text' ? inputs[2].value : '',
                        showCaption: inputs[1] && inputs[1].type === 'checkbox' ? inputs[1].checked : false,
                        isFullWidth: inputs[2] && inputs[2].type === 'checkbox' ? inputs[2].checked : false
                    };

                    draggedElement.remove();

                    const thumbnail = createThumbnail(url, metadata);
                    stagingArea.appendChild(thumbnail);

                    // Update the block's shortcode
                    updateShortcode(blockId);
                    saveState();
                }
            }

            draggedElement = null;
        });

        // Create image row with optional metadata
        function createImageRow(url, blockType, blockId, metadata = {}) {
            const div = document.createElement('div');
            div.className = 'image-row';
            div.draggable = true;
            div.dataset.url = url;
            div.dataset.blockId = blockId;

            const filename = url.split('/').pop();

            if (blockType === 'image') {
                div.innerHTML = `
                    <img src="${url}" alt="${filename}">
                    <div class="image-row-controls">
                        <input type="text" placeholder="Description" value="${metadata.description || ''}" class="input-description">
                        <input type="number" placeholder="Width (px)" value="${metadata.width || '1440'}" class="input-width">
                        <input type="text" placeholder="Class (optional)" value="${metadata.classes || ''}" class="input-class">
                    </div>
                    <button class="remove-btn" onclick="removeImage(this)">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                `;
            } else if (blockType === 'gallery') {
                div.innerHTML = `
                    <img src="${url}" alt="${filename}">
                    <div class="image-row-controls">
                        <input type="text" placeholder="Description" value="${metadata.description || ''}" class="input-description">
                        <label>
                            <input type="checkbox" class="caption-check" ${metadata.showCaption ? 'checked' : ''}>
                            Show caption
                        </label>
                        <label>
                            <input type="checkbox" class="fullwidth-check" ${metadata.isFullWidth ? 'checked' : ''}>
                            Full width
                        </label>
                    </div>
                    <button class="remove-btn" onclick="removeImage(this)">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                `;
            }

            // Add input listeners for live update
            const inputs = div.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('input', () => {
                    updateShortcode(div.dataset.blockId);
                    saveState();
                });
            });

            // Add selection handler for gallery images
            if (blockType === 'gallery') {
                div.addEventListener('click', handleGalleryImageClick);
            }

            addDragListeners(div);
            return div;
        }

        // Handle gallery image selection
        function handleGalleryImageClick(e) {
            // Don't select if clicking inputs or remove button
            if (e.target.tagName === 'INPUT' || e.target.closest('.remove-btn')) return;

            const imageRow = this;
            const galleryBlock = imageRow.closest('.drop-zone');

            // Check if shift key is pressed for range selection
            if (e.shiftKey && lastSelectedGalleryImage && lastSelectedGalleryImage.closest('.drop-zone') === galleryBlock) {
                // Range selection within same gallery
                const allImages = Array.from(galleryBlock.querySelectorAll('.image-row'));
                const startIndex = allImages.indexOf(lastSelectedGalleryImage);
                const endIndex = allImages.indexOf(imageRow);
                const [minIndex, maxIndex] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];

                // Select all images in range
                for (let i = minIndex; i <= maxIndex; i++) {
                    selectedGalleryImages.add(allImages[i]);
                    allImages[i].classList.add('selected');
                }
            } else if (e.metaKey || e.ctrlKey) {
                // Toggle selection
                if (selectedGalleryImages.has(imageRow)) {
                    selectedGalleryImages.delete(imageRow);
                    imageRow.classList.remove('selected');
                } else {
                    selectedGalleryImages.add(imageRow);
                    imageRow.classList.add('selected');
                    lastSelectedGalleryImage = imageRow;
                }
            } else {
                // Clear previous selection and select only this one
                clearGallerySelection();
                selectedGalleryImages.add(imageRow);
                imageRow.classList.add('selected');
                lastSelectedGalleryImage = imageRow;
            }
        }

        // Clear gallery image selection
        function clearGallerySelection() {
            selectedGalleryImages.forEach(img => {
                img.classList.remove('selected');
            });
            selectedGalleryImages.clear();
            lastSelectedGalleryImage = null;
        }

        // Remove image from block
        function removeImage(btn) {
            const row = btn.closest('.image-row');
            const url = row.dataset.url;
            const blockId = row.dataset.blockId;

            // Extract metadata from inputs
            const inputs = row.querySelectorAll('input');
            const metadata = {
                description: inputs[0].value || '',
                width: inputs[1] && inputs[1].type === 'number' ? inputs[1].value : '1440',
                classes: inputs[2] && inputs[2].type === 'text' ? inputs[2].value : '',
                showCaption: inputs[1] && inputs[1].type === 'checkbox' ? inputs[1].checked : false,
                isFullWidth: inputs[2] && inputs[2].type === 'checkbox' ? inputs[2].checked : false
            };

            row.remove();

            // Add back to staging with metadata
            const thumbnail = createThumbnail(url, metadata);
            stagingArea.appendChild(thumbnail);

            // Update shortcode
            updateShortcode(blockId);
            saveState();
        }

        // Create Image Block
        function createImageBlock() {
            const blockId = `block-${blockIdCounter++}`;
            const container = document.getElementById('blocksContainer');

            const block = document.createElement('div');
            block.className = 'block image-block';
            block.id = blockId;
            block.innerHTML = `
                <div class="block-header">
                    <div class="block-title">Image Block</div>
                    <button class="delete-btn" onclick="deleteBlock('${blockId}')">Delete Block</button>
                </div>
                <div class="drop-zone" data-block-type="image" data-block-id="${blockId}">
                    <div class="drop-zone-empty">Drag an image here</div>
                </div>
                <div class="shortcode-output">
                    <div class="output-header">
                        <div class="output-label">Shortcode:</div>
                        <button class="copy-btn" onclick="copyShortcode('${blockId}', this)">Copy</button>
                    </div>
                    <pre id="${blockId}-output"></pre>
                </div>
            `;

            container.appendChild(block);

            const dropZone = block.querySelector('.drop-zone');
            setupDropZone(dropZone, 'image', blockId);
            saveState();
        }

        // Create Gallery Block
        function createGalleryBlock() {
            const blockId = `block-${blockIdCounter++}`;
            const container = document.getElementById('blocksContainer');

            const block = document.createElement('div');
            block.className = 'block gallery-block';
            block.id = blockId;
            block.innerHTML = `
                <div class="block-header">
                    <div class="block-title">Gallery Block</div>
                    <button class="delete-btn" onclick="deleteBlock('${blockId}')">Delete Block</button>
                </div>
                <div class="gallery-type-selector">
                    <label>Gallery Type:</label>
                    <select onchange="updateGalleryType('${blockId}', this.value)">
                        <option value="two-column">Two Column</option>
                        <option value="three-column">Three Column</option>
                        <option value="vertical">Vertical</option>
                        <option value="tarot">Tarot</option>
                    </select>
                </div>
                <div class="drop-zone" data-block-type="gallery" data-block-id="${blockId}" data-gallery-type="two-column">
                    <div class="drop-zone-empty">Drag images here (can add multiple)</div>
                </div>
                <div class="shortcode-output">
                    <div class="output-header">
                        <div class="output-label">Shortcode:</div>
                        <button class="copy-btn" onclick="copyShortcode('${blockId}', this)">Copy</button>
                    </div>
                    <pre id="${blockId}-output"></pre>
                </div>
            `;

            container.appendChild(block);

            const dropZone = block.querySelector('.drop-zone');
            setupDropZone(dropZone, 'gallery', blockId);
            saveState();
        }

        // Delete block
        function deleteBlock(blockId) {
            const block = document.getElementById(blockId);

            // Return all images to staging with metadata
            const imageRows = block.querySelectorAll('.image-row');
            imageRows.forEach(row => {
                const url = row.dataset.url;

                // Extract metadata from inputs
                const inputs = row.querySelectorAll('input');
                const metadata = {
                    description: inputs[0].value || '',
                    width: inputs[1] && inputs[1].type === 'number' ? inputs[1].value : '1440',
                    classes: inputs[2] && inputs[2].type === 'text' ? inputs[2].value : '',
                    showCaption: inputs[1] && inputs[1].type === 'checkbox' ? inputs[1].checked : false,
                    isFullWidth: inputs[2] && inputs[2].type === 'checkbox' ? inputs[2].checked : false
                };

                const thumbnail = createThumbnail(url, metadata);
                stagingArea.appendChild(thumbnail);
            });

            block.remove();
            saveState();
        }

        // Update gallery type
        function updateGalleryType(blockId, galleryType) {
            const block = document.getElementById(blockId);
            const dropZone = block.querySelector('.drop-zone');
            dropZone.dataset.galleryType = galleryType;
            updateShortcode(blockId);
            saveState();
        }

        // Update shortcode output
        function updateShortcode(blockId) {
            const block = document.getElementById(blockId);
            const dropZone = block.querySelector('.drop-zone');
            const output = document.getElementById(`${blockId}-output`);
            const blockType = dropZone.dataset.blockType;

            const imageRows = Array.from(dropZone.querySelectorAll('.image-row'));

            if (imageRows.length === 0) {
                output.textContent = '';
                return;
            }

            let shortcode = '';

            if (blockType === 'image') {
                const row = imageRows[0];
                const url = row.dataset.url;
                const inputs = row.querySelectorAll('input');
                const description = inputs[0].value || '';
                const width = inputs[1].value || '1440';
                const classes = inputs[2].value || '';

                if (classes) {
                    shortcode = `{% image "${url}", "${description}", "${width}", "${classes}" %}`;
                } else {
                    shortcode = `{% image "${url}", "${description}", "${width}" %}`;
                }
            } else if (blockType === 'gallery') {
                const galleryType = dropZone.dataset.galleryType || 'two-column';
                shortcode = `{% photoGrid "${galleryType}" %}\n`;

                imageRows.forEach(row => {
                    const url = row.dataset.url;
                    const inputs = row.querySelectorAll('input');
                    const description = inputs[0].value || '';
                    const showCaption = inputs[1].checked;
                    let isFullWidth = inputs[2].checked;

                    // Override isFullWidth to true for vertical galleries
                    if (galleryType === 'vertical') {
                        isFullWidth = true;
                    }

                    shortcode += `{% photoGridItem "${url}", "${description}", ${showCaption}, ${isFullWidth} %}\n`;
                });

                shortcode += '{% endphotoGrid %}';
            }

            output.textContent = shortcode;
        }

        // Copy shortcode to clipboard
        function copyShortcode(blockId, btn) {
            const output = document.getElementById(`${blockId}-output`);
            const text = output.textContent;

            if (!text) {
                alert('No shortcode to copy');
                return;
            }

            navigator.clipboard.writeText(text).then(() => {
                const originalText = btn.textContent;
                btn.classList.add('copied');
                btn.textContent = 'Copied!';
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.textContent = originalText;
                }, 1200);
            }).catch(err => {
                alert('Failed to copy: ' + err);
            });
        }

        // Update page title with image count
        function updatePageTitle() {
            const stagingImages = document.querySelectorAll('#stagingArea .thumbnail').length;
            const blockImages = document.querySelectorAll('.block .image-row').length;
            const totalImages = stagingImages + blockImages;

            if (totalImages > 0) {
                document.title = `🖼️ Images (${totalImages})`;
            } else {
                document.title = '🖼️ Images';
            }
        }

        // LocalStorage functions
        function saveState() {
            const state = {
                blockIdCounter: blockIdCounter,
                thumbnails: [],
                blocks: []
            };

            // Save thumbnails in staging area with metadata
            const thumbnails = document.querySelectorAll('#stagingArea .thumbnail');
            thumbnails.forEach(thumb => {
                state.thumbnails.push({
                    url: thumb.dataset.url,
                    description: thumb.dataset.description || '',
                    width: thumb.dataset.width || '1440',
                    classes: thumb.dataset.classes || '',
                    isFullWidth: thumb.dataset.isFullWidth === 'true',
                    showCaption: thumb.dataset.showCaption === 'true'
                });
            });

            // Save blocks
            const blocks = document.querySelectorAll('.block');
            blocks.forEach(block => {
                const blockData = {
                    id: block.id,
                    type: block.classList.contains('gallery-block') ? 'gallery' : 'image',
                    images: []
                };

                // Save gallery type for gallery blocks
                if (blockData.type === 'gallery') {
                    const dropZone = block.querySelector('.drop-zone');
                    blockData.galleryType = dropZone.dataset.galleryType || 'two-column';
                }

                const imageRows = block.querySelectorAll('.image-row');
                imageRows.forEach(row => {
                    const url = row.dataset.url;
                    const inputs = row.querySelectorAll('input');

                    if (blockData.type === 'image') {
                        blockData.images.push({
                            url: url,
                            description: inputs[0].value,
                            width: inputs[1].value,
                            classes: inputs[2].value
                        });
                    } else {
                        blockData.images.push({
                            url: url,
                            description: inputs[0].value,
                            showCaption: inputs[1].checked,
                            isFullWidth: inputs[2].checked
                        });
                    }
                });

                state.blocks.push(blockData);
            });

            localStorage.setItem('imageShortcodeGeneratorState', JSON.stringify(state));
            updatePageTitle();
        }

        function loadState() {
            const savedState = localStorage.getItem('imageShortcodeGeneratorState');
            if (!savedState) return;

            try {
                const state = JSON.parse(savedState);

                // Restore blockIdCounter
                blockIdCounter = state.blockIdCounter || 0;

                // Restore thumbnails with metadata
                state.thumbnails.forEach(thumbData => {
                    // Support old format (just URL string) and new format (object with metadata)
                    if (typeof thumbData === 'string') {
                        const thumbnail = createThumbnail(thumbData);
                        stagingArea.appendChild(thumbnail);
                    } else {
                        const thumbnail = createThumbnail(thumbData.url, {
                            description: thumbData.description,
                            width: thumbData.width,
                            classes: thumbData.classes,
                            isFullWidth: thumbData.isFullWidth,
                            showCaption: thumbData.showCaption
                        });
                        stagingArea.appendChild(thumbnail);
                    }
                });

                // Restore blocks
                state.blocks.forEach(blockData => {
                    // Create the block
                    if (blockData.type === 'image') {
                        createImageBlockWithId(blockData.id);
                    } else {
                        createGalleryBlockWithId(blockData.id, blockData.galleryType || 'two-column');
                    }

                    // Add images to the block
                    const block = document.getElementById(blockData.id);
                    const dropZone = block.querySelector('.drop-zone');
                    const emptyMsg = dropZone.querySelector('.drop-zone-empty');
                    if (emptyMsg) emptyMsg.remove();

                    blockData.images.forEach(imageData => {
                        // Create image row with metadata
                        const metadata = {
                            description: imageData.description || imageData.alt || '',  // Support old 'alt' field
                            width: imageData.width || '1440',
                            classes: imageData.classes || '',
                            isFullWidth: imageData.isFullWidth || false,
                            showCaption: imageData.showCaption || false
                        };
                        const imageRow = createImageRow(imageData.url, blockData.type, blockData.id, metadata);
                        dropZone.appendChild(imageRow);
                    });

                    // Update shortcode
                    updateShortcode(blockData.id);
                });

                updatePageTitle();
            } catch (err) {
                console.error('Failed to load state:', err);
            }
        }

        // Helper functions to create blocks with specific IDs
        function createImageBlockWithId(blockId) {
            const container = document.getElementById('blocksContainer');

            const block = document.createElement('div');
            block.className = 'block image-block';
            block.id = blockId;
            block.innerHTML = `
                <div class="block-header">
                    <div class="block-title">Image Block</div>
                    <button class="delete-btn" onclick="deleteBlock('${blockId}')">Delete Block</button>
                </div>
                <div class="drop-zone" data-block-type="image" data-block-id="${blockId}">
                    <div class="drop-zone-empty">Drag an image here</div>
                </div>
                <div class="shortcode-output">
                    <div class="output-header">
                        <div class="output-label">Shortcode:</div>
                        <button class="copy-btn" onclick="copyShortcode('${blockId}', this)">Copy</button>
                    </div>
                    <pre id="${blockId}-output"></pre>
                </div>
            `;

            container.appendChild(block);

            const dropZone = block.querySelector('.drop-zone');
            setupDropZone(dropZone, 'image', blockId);
        }

        function createGalleryBlockWithId(blockId, galleryType = 'two-column') {
            const container = document.getElementById('blocksContainer');

            const block = document.createElement('div');
            block.className = 'block gallery-block';
            block.id = blockId;
            block.innerHTML = `
                <div class="block-header">
                    <div class="block-title">Gallery Block</div>
                    <button class="delete-btn" onclick="deleteBlock('${blockId}')">Delete Block</button>
                </div>
                <div class="gallery-type-selector">
                    <label>Gallery Type:</label>
                    <select onchange="updateGalleryType('${blockId}', this.value)">
                        <option value="two-column" ${galleryType === 'two-column' ? 'selected' : ''}>Two Column</option>
                        <option value="three-column" ${galleryType === 'three-column' ? 'selected' : ''}>Three Column</option>
                        <option value="vertical" ${galleryType === 'vertical' ? 'selected' : ''}>Vertical</option>
                        <option value="tarot" ${galleryType === 'tarot' ? 'selected' : ''}>Tarot</option>
                    </select>
                </div>
                <div class="drop-zone" data-block-type="gallery" data-block-id="${blockId}" data-gallery-type="${galleryType}">
                    <div class="drop-zone-empty">Drag images here (can add multiple)</div>
                </div>
                <div class="shortcode-output">
                    <div class="output-header">
                        <div class="output-label">Shortcode:</div>
                        <button class="copy-btn" onclick="copyShortcode('${blockId}', this)">Copy</button>
                    </div>
                    <pre id="${blockId}-output"></pre>
                </div>
            `;

            container.appendChild(block);

            const dropZone = block.querySelector('.drop-zone');
            setupDropZone(dropZone, 'gallery', blockId);
        }

        function clearAllData() {
            if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                return;
            }

            localStorage.removeItem('imageShortcodeGeneratorState');
            location.reload();
        }

        // Context menu functionality
        const contextMenu = document.getElementById('contextMenu');
        let contextMenuTarget = null;

        // Add right-click listener to staging area
        document.getElementById('stagingArea').addEventListener('contextmenu', (e) => {
            e.preventDefault();

            const thumbnail = e.target.closest('.thumbnail');
            if (!thumbnail) {
                hideContextMenu();
                return;
            }

            contextMenuTarget = thumbnail;

            // If clicked thumbnail is not selected, select only it
            if (!selectedThumbnails.has(thumbnail)) {
                clearSelection();
                selectedThumbnails.add(thumbnail);
                thumbnail.classList.add('selected');
                lastSelectedThumbnail = thumbnail;
                updateSelectionUI();
            }

            showContextMenu(e.clientX, e.clientY, 'staging');
        });

        // Add right-click listener to blocks container (for image-rows)
        document.getElementById('blocksContainer').addEventListener('contextmenu', (e) => {
            e.preventDefault();

            const imageRow = e.target.closest('.image-row');
            if (!imageRow) {
                hideContextMenu();
                return;
            }

            const isGalleryImage = imageRow.closest('.drop-zone')?.dataset.blockType === 'gallery';

            // For gallery images, handle selection before showing menu
            if (isGalleryImage) {
                // If clicked image is not selected, select only it
                if (!selectedGalleryImages.has(imageRow)) {
                    clearGallerySelection();
                    selectedGalleryImages.add(imageRow);
                    imageRow.classList.add('selected');
                    lastSelectedGalleryImage = imageRow;
                }
            }

            contextMenuTarget = imageRow;
            showContextMenu(e.clientX, e.clientY, 'block');
        });

        function showContextMenu(x, y, context) {
            let menuHTML = '';

            if (context === 'staging') {
                const selectionCount = selectedThumbnails.size;

                if (selectionCount === 1) {
                    menuHTML = `
                        <div class="context-menu-item" onclick="createImageBlockFromContext()">Create Image Block</div>
                        <div class="context-menu-item" onclick="createGalleryBlockFromContext()">Create Gallery Block</div>
                        <div class="context-menu-separator"></div>
                        <div class="context-menu-item" onclick="openAltTextModal()">Edit Alt Text...</div>
                        <div class="context-menu-separator"></div>
                        <div class="context-menu-item" onclick="deleteFromContext()">Delete</div>
                    `;
                } else if (selectionCount > 1) {
                    menuHTML = `
                        <div class="context-menu-item" onclick="createGalleryBlockFromContext()">Create Gallery Block (${selectionCount} images)</div>
                        <div class="context-menu-separator"></div>
                        <div class="context-menu-item" onclick="deleteFromContext()">Delete (${selectionCount} images)</div>
                    `;
                }
            } else if (context === 'block') {
                const gallerySelectionCount = selectedGalleryImages.size;

                if (gallerySelectionCount > 1) {
                    menuHTML = `
                        <div class="context-menu-item" onclick="sendToStagingFromContext()">Send to Staging (${gallerySelectionCount} images)</div>
                        <div class="context-menu-separator"></div>
                        <div class="context-menu-item" onclick="deleteFromContext()">Delete (${gallerySelectionCount} images)</div>
                    `;
                } else {
                    menuHTML = `
                        <div class="context-menu-item" onclick="sendToStagingFromContext()">Send to Staging</div>
                        <div class="context-menu-separator"></div>
                        <div class="context-menu-item" onclick="deleteFromContext()">Delete</div>
                    `;
                }
            }

            contextMenu.innerHTML = menuHTML;

            // Position menu
            contextMenu.style.left = `${x}px`;
            contextMenu.style.top = `${y}px`;
            contextMenu.classList.add('visible');

            // Adjust if menu goes off screen
            setTimeout(() => {
                const rect = contextMenu.getBoundingClientRect();
                if (rect.right > window.innerWidth) {
                    contextMenu.style.left = `${x - rect.width}px`;
                }
                if (rect.bottom > window.innerHeight) {
                    contextMenu.style.top = `${y - rect.height}px`;
                }
            }, 0);
        }

        function hideContextMenu() {
            contextMenu.classList.remove('visible');
        }

        // Hide context menu on click outside
        document.addEventListener('click', hideContextMenu);
        document.addEventListener('contextmenu', (e) => {
            if (!e.target.closest('#stagingArea') && !e.target.closest('#blocksContainer')) {
                hideContextMenu();
            }
        });

        function createImageBlockFromContext() {
            hideContextMenu();
            createImageBlockFromSelection();
        }

        function createGalleryBlockFromContext() {
            hideContextMenu();
            if (selectedThumbnails.size === 1) {
                // Allow single image gallery
                createGalleryBlockFromSelection();
            } else if (selectedThumbnails.size > 1) {
                createGalleryBlockFromSelection();
            }
        }

        function sendToStagingFromContext() {
            hideContextMenu();

            const stagingArea = document.getElementById('stagingArea');
            let blockId = null;

            // Handle multiple gallery images or single image
            if (selectedGalleryImages.size > 0) {
                // Get images in order they appear in gallery
                const gallery = Array.from(selectedGalleryImages)[0].closest('.drop-zone');
                const allImages = Array.from(gallery.querySelectorAll('.image-row'));
                const selectedInOrder = allImages.filter(img => selectedGalleryImages.has(img));

                blockId = selectedInOrder[0].dataset.blockId;

                selectedInOrder.forEach(imageRow => {
                    const url = imageRow.dataset.url;
                    const inputs = imageRow.querySelectorAll('input');
                    const metadata = {
                        description: inputs[0].value || '',
                        width: inputs[1] && inputs[1].type === 'number' ? inputs[1].value : '1440',
                        classes: inputs[2] && inputs[2].type === 'text' ? inputs[2].value : '',
                        showCaption: inputs[1] && inputs[1].type === 'checkbox' ? inputs[1].checked : false,
                        isFullWidth: inputs[2] && inputs[2].type === 'checkbox' ? inputs[2].checked : false
                    };

                    imageRow.remove();
                    const thumbnail = createThumbnail(url, metadata);
                    stagingArea.appendChild(thumbnail);
                });

                selectedGalleryImages.clear();
            } else if (contextMenuTarget && contextMenuTarget.classList.contains('image-row')) {
                const imageRow = contextMenuTarget;
                const url = imageRow.dataset.url;
                blockId = imageRow.dataset.blockId;

                const inputs = imageRow.querySelectorAll('input');
                const metadata = {
                    description: inputs[0].value || '',
                    width: inputs[1] && inputs[1].type === 'number' ? inputs[1].value : '1440',
                    classes: inputs[2] && inputs[2].type === 'text' ? inputs[2].value : '',
                    showCaption: inputs[1] && inputs[1].type === 'checkbox' ? inputs[1].checked : false,
                    isFullWidth: inputs[2] && inputs[2].type === 'checkbox' ? inputs[2].checked : false
                };

                imageRow.remove();
                const thumbnail = createThumbnail(url, metadata);
                stagingArea.appendChild(thumbnail);
            }

            if (blockId) {
                updateShortcode(blockId);
                saveState();
            }
        }

        function deleteFromContext() {
            hideContextMenu();

            // Delete from staging
            if (selectedThumbnails.size > 0) {
                selectedThumbnails.forEach(thumb => {
                    if (lastSelectedThumbnail === thumb) {
                        lastSelectedThumbnail = null;
                    }
                    thumb.remove();
                });
                selectedThumbnails.clear();
                updateSelectionUI();
                saveState();
            }
            // Delete from gallery (multiple)
            else if (selectedGalleryImages.size > 0) {
                const blockId = Array.from(selectedGalleryImages)[0].dataset.blockId;
                selectedGalleryImages.forEach(img => {
                    img.remove();
                });
                selectedGalleryImages.clear();
                updateShortcode(blockId);
                saveState();
            }
            // Delete from block (single)
            else if (contextMenuTarget && contextMenuTarget.classList.contains('image-row')) {
                const imageRow = contextMenuTarget;
                const blockId = imageRow.dataset.blockId;
                imageRow.remove();
                updateShortcode(blockId);
                saveState();
            }
        }

        // Alt text modal functionality
        let currentModalIndex = 0;
        let modalThumbnails = [];

        function openAltTextModal() {
            hideContextMenu();

            // Get all thumbnails in staging area
            modalThumbnails = Array.from(document.querySelectorAll('#stagingArea .thumbnail'));

            if (modalThumbnails.length === 0) return;

            // Find the index of the first selected thumbnail
            const selectedArray = Array.from(selectedThumbnails);
            if (selectedArray.length > 0) {
                currentModalIndex = modalThumbnails.indexOf(selectedArray[0]);
                if (currentModalIndex === -1) currentModalIndex = 0;
            } else {
                currentModalIndex = 0;
            }

            showModalForCurrentIndex();
            document.getElementById('altTextModal').classList.add('visible');
        }

        function showModalForCurrentIndex() {
            if (modalThumbnails.length === 0) return;

            const thumbnail = modalThumbnails[currentModalIndex];
            const url = thumbnail.dataset.url;
            const description = thumbnail.dataset.description || '';

            document.getElementById('modalImage').src = url;
            document.getElementById('modalAltText').value = description;

            // Update title with current position
            document.querySelector('.modal-title').textContent = `Edit Alt Text (${currentModalIndex + 1} of ${modalThumbnails.length})`;
        }

        // Autosave alt text on input
        document.getElementById('modalAltText').addEventListener('input', function() {
            if (modalThumbnails.length === 0) return;
            const thumbnail = modalThumbnails[currentModalIndex];
            thumbnail.dataset.description = this.value;
            saveState();
        });

        function closeAltTextModal() {
            document.getElementById('altTextModal').classList.remove('visible');
        }

        function nextImage() {
            currentModalIndex = (currentModalIndex + 1) % modalThumbnails.length;
            showModalForCurrentIndex();
        }

        function previousImage() {
            currentModalIndex = (currentModalIndex - 1 + modalThumbnails.length) % modalThumbnails.length;
            showModalForCurrentIndex();
        }

        // Keyboard shortcuts for modal
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('altTextModal');
            if (!modal.classList.contains('visible')) return;

            // Don't trigger shortcuts if user is typing in textarea
            const textarea = document.getElementById('modalAltText');
            if (document.activeElement === textarea && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                return;
            }

            if (e.key === 'Escape') {
                closeAltTextModal();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                previousImage();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                nextImage();
            }
        });

        // Close modal when clicking overlay
        document.getElementById('altTextModal').addEventListener('click', (e) => {
            if (e.target.id === 'altTextModal') {
                closeAltTextModal();
            }
        });

        // Resize handle functionality
        const resizeHandle = document.getElementById('resizeHandle');
        const leftColumn = document.getElementById('leftColumn');
        let isResizing = false;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;

        function isMobileView() {
            return window.innerWidth <= 1024;
        }

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            const isMobile = isMobileView();

            if (isMobile) {
                startY = e.clientY;
                startHeight = leftColumn.offsetHeight;
                document.body.style.cursor = 'row-resize';
            } else {
                startX = e.clientX;
                startWidth = leftColumn.offsetWidth;
                document.body.style.cursor = 'col-resize';
            }

            resizeHandle.classList.add('resizing');
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const isMobile = isMobileView();

            if (isMobile) {
                // Horizontal layout - resize height
                const delta = e.clientY - startY;
                const newHeight = startHeight + delta;

                // Apply min/max constraints for height
                const minHeight = 150;
                const maxHeight = window.innerHeight * 0.8; // 80vh
                const constrainedHeight = Math.min(Math.max(newHeight, minHeight), maxHeight);

                leftColumn.style.height = `${constrainedHeight}px`;
            } else {
                // Vertical layout - resize width
                const delta = e.clientX - startX;
                const newWidth = startWidth + delta;

                // Apply min/max constraints for width
                const minWidth = 250;
                const maxWidth = 600;
                const constrainedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);

                leftColumn.style.width = `${constrainedWidth}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizeHandle.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });

        // Load saved state when page loads
        loadState();
