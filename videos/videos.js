let videos = [];
let videoIdCounter = 0;

// Fetch Vimeo oEmbed data with retry logic
async function fetchVimeoOEmbed(vimeoId, width = 500) {
    for (let i = 0; i < 3; i++) {
        try {
            const response = await fetch(`https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F${vimeoId}&width=${width}`);
            const text = await response.text();
            if (text.startsWith('<')) {
                console.error(`[Vimeo ${vimeoId}] Got HTML response (attempt ${i + 1}/3):`, text.substring(0, 500));
                throw new Error('Got HTML instead of JSON');
            }
            return JSON.parse(text);
        } catch (error) {
            if (i === 2) throw error; // Last attempt, rethrow
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// Fetch YouTube oEmbed data
async function fetchYouTubeTitle(url) {
    try {
        const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        return data.title;
    } catch (error) {
        console.error('Failed to fetch YouTube title:', error);
        return null;
    }
}

// Fetch PeerTube oEmbed data
async function fetchPeerTubeTitle(url) {
    try {
        // Extract the instance domain from the PeerTube URL
        const urlObj = new URL(url);
        const instance = urlObj.origin;

        const response = await fetch(`${instance}/services/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        return data.title;
    } catch (error) {
        console.error('Failed to fetch PeerTube title:', error);
        return null;
    }
}

// Format duration from seconds
function formatDuration(seconds) {
    let duration = "";
    if (seconds > 3600) {
        duration = new Date(seconds * 1000).toISOString().substring(11, 19);
    } else {
        duration = new Date(seconds * 1000).toISOString().substring(14, 19);
    }
    duration = duration.replace(/^0/, '');
    return duration;
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// Hide error message
function hideError() {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.style.display = 'none';
}

// Load video data from TSV or API
async function loadVideoData(event) {
    const input = document.getElementById('tsvInput').value.trim();

    if (!input) {
        showError('Please paste TSV data or API key first');
        return;
    }

    hideError();

    const btn = event.target;

    // Check if input is an API key (40 character alphanumeric string)
    const apiKeyPattern = /^[a-zA-Z0-9]{40}$/;
    if (apiKeyPattern.test(input)) {
        await loadFromAPI(input, btn);
        return;
    }

    // Otherwise, treat as TSV
    await loadFromTSV(input, btn);
}

// Load video data from API
async function loadFromAPI(apiKey, btn, retryCount = 0) {
    const originalText = btn.textContent;
    btn.textContent = 'Loading from API...';
    btn.disabled = true;

    try {
        // Use CORS proxy to avoid cross-origin credential issues
        const proxyUrl = 'https://perfectsky.institute/proxy/https://grist.perfectsky.institute/api/docs/bbwBKGd1ZMiHdfQPzUA3ab/tables/Videos/records';

        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            },
            // Add cache: 'no-store' to prevent cached authentication issues
            cache: 'no-store'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);

            // Retry once on 500 errors (likely proxy session issue)
            if (response.status === 500 && retryCount === 0) {
                console.log('Retrying API request...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                return await loadFromAPI(apiKey, btn, retryCount + 1);
            }

            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Store API key and data in localStorage
        localStorage.setItem('gristApiKey', apiKey);
        localStorage.setItem('gristVideoData', JSON.stringify(data));
        localStorage.setItem('gristDataLoadedAt', new Date().toISOString());

        // Clear input
        document.getElementById('tsvInput').value = '';

        // Update UI to show database is loaded
        updateDatabaseStatus();

    } catch (error) {
        console.error('Error loading from API:', error);
        showError(`Failed to fetch data from API: ${error.message}`);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Refresh video data from API
async function refreshFromAPI() {
    const apiKey = localStorage.getItem('gristApiKey');
    if (!apiKey) {
        showError('No API key found. Please paste your API key first.');
        return;
    }

    const btn = document.querySelector('#refreshDatabaseBtn');
    await loadFromAPI(apiKey, btn);

    // Show success feedback - need to get the button again since updateDatabaseStatus() recreated it
    const refreshBtn = document.querySelector('#refreshDatabaseBtn');
    if (refreshBtn) {
        refreshBtn.textContent = 'Refreshed!';
        setTimeout(() => {
            refreshBtn.textContent = 'Refresh Database';
        }, 1200);
    }
}

// Clear API key and data
function clearAPIData() {
    if (!confirm('Are you sure you want to clear the API key and database? This will not affect videos you\'ve already added.')) {
        return;
    }

    // Clear from localStorage
    localStorage.removeItem('gristApiKey');
    localStorage.removeItem('gristVideoData');
    localStorage.removeItem('gristDataLoadedAt');

    // Update UI
    updateDatabaseStatus();
}

// Update database status UI
function updateDatabaseStatus() {
    const section = document.getElementById('databaseSection');
    const statusDiv = document.getElementById('databaseStatus');
    const data = localStorage.getItem('gristVideoData');
    const loadedAt = localStorage.getItem('gristDataLoadedAt');

    if (data && loadedAt) {
        const parsedData = JSON.parse(data);
        const recordCount = parsedData.records ? parsedData.records.length : 0;
        const loadedDate = new Date(loadedAt);
        const timeStr = loadedDate.toLocaleString();

        statusDiv.innerHTML = `
            <div style="color: var(--color-green-light); font-size: 12px; margin-bottom: 8px;">
                ✓ Video database loaded from Grist (${recordCount} videos)
            </div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 8px;">
                Last updated: ${timeStr}
            </div>
            <button onclick="openBrowseModal()">Browse Videos</button>
            <button id="refreshDatabaseBtn" onclick="refreshFromAPI()">Refresh Database</button>
            <button class="clear-btn" onclick="clearAPIData()">Clear API Data</button>
        `;
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
    }
}

// Track selected videos in browse modal
let selectedVideos = [];

// Open the browse videos modal
function openBrowseModal() {
    const modal = document.getElementById('browseModal');
    modal.classList.add('visible');
    selectedVideos = [];
    loadBrowseVideos();
}

// Close the browse videos modal
function closeBrowseModal() {
    const modal = document.getElementById('browseModal');
    modal.classList.remove('visible');
    selectedVideos = [];
}

// Toggle video selection
function toggleVideoSelection(record, itemElement) {
    const index = selectedVideos.findIndex(v => v.record.id === record.id);

    if (index > -1) {
        // Deselect
        selectedVideos.splice(index, 1);
        itemElement.style.backgroundColor = 'var(--bg-secondary)';
        itemElement.style.borderColor = 'var(--border-secondary)';
    } else {
        // Select
        selectedVideos.push({ record });
        itemElement.style.backgroundColor = 'var(--bg-tertiary)';
        itemElement.style.borderColor = 'var(--color-blue-light)';
    }

    updateCreateBlocksButton();
}

// Update the create blocks button
function updateCreateBlocksButton() {
    const button = document.getElementById('createBlocksBtn');
    const count = selectedVideos.length;

    if (count > 0) {
        button.textContent = `Create ${count} Block${count !== 1 ? 's' : ''}`;
        button.disabled = false;
        button.style.opacity = '1';
    } else {
        button.textContent = 'Create Blocks';
        button.disabled = true;
        button.style.opacity = '0.5';
    }
}

// Load and display videos in browse modal
async function loadBrowseVideos() {
    const data = localStorage.getItem('gristVideoData');
    if (!data) {
        console.error('No video data found');
        return;
    }

    const parsedData = JSON.parse(data);
    const container = document.getElementById('browseVideosContainer');

    // Reverse order (highest id first)
    const reversedVideos = [...parsedData.records].reverse();

    // Clear container
    container.innerHTML = '';

    // Create placeholder items first to prevent scrollbar growth
    const placeholders = [];
    for (const record of reversedVideos) {
        const fields = record.fields;

        // Check if video is embeddable
        const isEmbeddable = fields.vimeo_id && fields.vimeo_id !== '' &&
                            fields.c720p_video_file_url && fields.c720p_video_file_url !== '';

        // Create video item
        const item = document.createElement('div');
        item.className = 'browse-video-item';

        // Style based on embeddable status
        const baseStyle = 'display: flex; gap: 12px; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--border-secondary); border-radius: 3px; margin-bottom: 10px; transition: all 0.2s;';

        if (isEmbeddable) {
            item.style.cssText = baseStyle + ' cursor: pointer;';
        } else {
            item.style.cssText = baseStyle + ' opacity: 0.5;';
        }

        // Thumbnail container with fixed 4:3 aspect ratio
        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.style.cssText = 'width: 120px; height: 90px; background: var(--bg-primary); border-radius: 3px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;';

        // Info
        const info = document.createElement('div');
        info.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; overflow: hidden;';

        let statusText = '';
        if (!isEmbeddable) {
            const missing = [];
            if (!fields.vimeo_id || fields.vimeo_id === '') missing.push('vimeo_id');
            if (!fields.c720p_video_file_url || fields.c720p_video_file_url === '') missing.push('video_file_url');
            statusText = `<div style="font-size: 11px; color: var(--color-red-light); margin-top: 4px;">⚠ Missing: ${missing.join(', ')}</div>`;
        }

        // Truncate description
        const description = fields.description_credits || '';
        const truncatedDescription = description.length > 100 ? description.substring(0, 100) + '...' : description;

        // Check for YouTube and PeerTube URLs
        const youtubeUrl = fields.youtube_ && fields.youtube_ !== 'yes' && fields.youtube_ !== 'no' ? fields.youtube_ : '';
        const peertubeUrl = fields.peertube_ && fields.peertube_ !== 'yes' && fields.peertube_ !== 'no' ? fields.peertube_ : '';

        const platformBadges = [];
        if (youtubeUrl) {
            platformBadges.push(`<span style="color: var(--text-secondary);">✓ YouTube</span>`);
        }
        if (peertubeUrl) {
            platformBadges.push(`<span style="color: var(--text-secondary);">✓ PeerTube</span>`);
        }

        info.innerHTML = `
            <div style="font-weight: 600; color: var(--text-primary); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${fields.title || 'Untitled'}</div>
            ${truncatedDescription ? `<div style="font-size: 11px; color: var(--text-secondary); line-height: 1.3; margin-top: 2px;">${truncatedDescription}</div>` : ''}
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">${fields.year || ''}</div>
            ${platformBadges.length > 0 ? `<div style="font-size: 11px; margin-top: 4px; display: flex; gap: 10px;">${platformBadges.join('')}</div>` : ''}
            ${statusText}
        `;

        item.appendChild(thumbnailContainer);
        item.appendChild(info);

        // Add to container immediately
        container.appendChild(item);

        // Save for async thumbnail loading
        if (isEmbeddable) {
            placeholders.push({ record, item, thumbnailContainer });
        } else {
            thumbnailContainer.innerHTML = '<div style="font-size: 10px; color: var(--text-secondary); text-align: center;">No preview</div>';
        }
    }

    // Now fetch thumbnails asynchronously without changing layout
    for (const { record, item, thumbnailContainer } of placeholders) {
        const fields = record.fields;
        try {
            // Fetch smaller oEmbed data for browsing (width 250px)
            const oEmbed = await fetchVimeoOEmbed(fields.vimeo_id, 250);

            // Thumbnail - strip height from URL to preserve aspect ratio
            // e.g. "_200x150" becomes "_200"
            const thumbnailUrl = oEmbed.thumbnail_url.replace(/_(\d+)x\d+/, '_$1');
            const thumbnail = document.createElement('img');
            thumbnail.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 3px; opacity: 0; transition: opacity 0.3s ease;';
            thumbnail.src = thumbnailUrl;
            thumbnail.onload = () => {
                thumbnail.style.opacity = '1';
            };
            thumbnailContainer.innerHTML = '';
            thumbnailContainer.appendChild(thumbnail);

            // Click handler to toggle selection
            item.onclick = () => toggleVideoSelection(record, item);

        } catch (error) {
            console.error(`Failed to load video ${fields.vimeo_id}:`, error);
            thumbnailContainer.innerHTML = '<div style="font-size: 10px; color: var(--text-secondary); text-align: center;">Failed to load</div>';
        }
    }

    if (reversedVideos.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No videos found in database.</div>';
    }

    // Initialize button state
    updateCreateBlocksButton();
}

// Create blocks for selected videos
async function createSelectedBlocks() {
    if (selectedVideos.length === 0) return;

    const button = document.getElementById('createBlocksBtn');
    const originalText = button.textContent;
    button.textContent = 'Creating...';
    button.disabled = true;

    try {
        // Create cards for each selected video
        for (const { record } of selectedVideos) {
            const fields = record.fields;

            try {
                // Fetch the full-size oEmbed data for the actual card (width 500)
                const fullOEmbed = await fetchVimeoOEmbed(fields.vimeo_id, 500);

                // Fetch YouTube and PeerTube titles if URLs exist
                let youtubeTitle = null;
                let peertubeTitle = null;

                const youtubeUrl = fields.youtube_ && fields.youtube_ !== 'yes' && fields.youtube_ !== 'no' ? fields.youtube_ : '';
                const peertubeUrl = fields.peertube_ && fields.peertube_ !== 'yes' && fields.peertube_ !== 'no' ? fields.peertube_ : '';

                if (youtubeUrl) {
                    youtubeTitle = await fetchYouTubeTitle(youtubeUrl);
                }

                if (peertubeUrl) {
                    peertubeTitle = await fetchPeerTubeTitle(peertubeUrl);
                }

                // Create video object
                const videoId = `video-${videoIdCounter++}`;
                const videoData = {
                    id: videoId,
                    title: fields.title,
                    vimeoId: fields.vimeo_id,
                    videoFileUrl: fields.c720p_video_file_url,
                    youtubeUrl: youtubeUrl,
                    youtubeTitle: youtubeTitle,
                    peertubeUrl: peertubeUrl,
                    peertubeTitle: peertubeTitle,
                    oEmbed: fullOEmbed
                };

                // Add to beginning of array (new videos appear at top)
                videos.unshift(videoData);

                // Create and display video card
                createVideoCard(videoData);

            } catch (error) {
                console.error(`Failed to create card for video ${fields.title}:`, error);
            }
        }

        // Save state
        saveState();

        // Close modal
        closeBrowseModal();

    } catch (error) {
        console.error('Error creating blocks:', error);
        showError(`Failed to create video blocks: ${error.message}`);
    } finally {
        button.textContent = originalText;
        button.disabled = false;
    }
}

// Load video data from TSV
async function loadFromTSV(input, btn) {
    // Split by tabs
    const columns = input.split('\t');

    // Check if we have enough columns
    if (columns.length < 10) {
        showError(`Invalid TSV format. Expected at least 10 columns. Got ${columns.length}`);
        return;
    }

    // Extract relevant fields
    const title = columns[0] || '';
    const vimeoId = columns[4] || '';
    const videoFileUrl = columns[6] || '';
    const youtubeUrl = columns[7] || '';
    const peertubeUrl = columns[9] || '';

    // Validate required fields
    if (!vimeoId) {
        showError('Missing required field: Vimeo ID (column 5)');
        return;
    }

    if (!videoFileUrl) {
        showError('Missing required field: 720p video file URL (column 7)');
        return;
    }

    // Show loading state
    const originalText = btn.textContent;
    btn.textContent = 'Loading...';
    btn.disabled = true;

    try {
        // Fetch Vimeo oEmbed data
        const oEmbed = await fetchVimeoOEmbed(vimeoId);

        // Fetch YouTube and PeerTube titles if URLs exist
        let youtubeTitle = null;
        let peertubeTitle = null;

        if (youtubeUrl) {
            youtubeTitle = await fetchYouTubeTitle(youtubeUrl);
        }

        if (peertubeUrl) {
            peertubeTitle = await fetchPeerTubeTitle(peertubeUrl);
        }

        // Create video object
        const videoId = `video-${videoIdCounter++}`;
        const videoData = {
            id: videoId,
            title: title,
            vimeoId: vimeoId,
            videoFileUrl: videoFileUrl,
            youtubeUrl: youtubeUrl,
            youtubeTitle: youtubeTitle,
            peertubeUrl: peertubeUrl,
            peertubeTitle: peertubeTitle,
            oEmbed: oEmbed
        };

        // Add to beginning of array (new videos appear at top)
        videos.unshift(videoData);

        // Create and display video card
        createVideoCard(videoData);

        // Clear input on success
        document.getElementById('tsvInput').value = '';

        // Save state
        saveState();

    } catch (error) {
        console.error('Error loading video:', error);
        showError(`Failed to fetch video data from Vimeo: ${error.message}`);
    } finally {
        // Restore button
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Create video card
function createVideoCard(videoData) {
    const container = document.getElementById('videosContainer');
    const emptyState = document.getElementById('emptyState');

    // Hide empty state
    if (emptyState) {
        emptyState.style.display = 'none';
    }

    const card = document.createElement('div');
    card.className = 'video-card';
    card.id = videoData.id;

    // Generate shortcode
    const shortcode = generateShortcode(videoData);

    // Get thumbnail URL
    const thumbnailUrl = videoData.oEmbed.thumbnail_url.split("-d_")[0] + "-d_1440.jpg";

    // Format duration
    const duration = formatDuration(videoData.oEmbed.duration);

    // Build watch links with titles
    let watchLinksItem = '';
    if (videoData.youtubeUrl || videoData.peertubeUrl) {
        const vimeoTitle = videoData.oEmbed.title;
        const links = [];

        if (videoData.youtubeUrl) {
            let titleHtml = '';
            if (videoData.youtubeTitle) {
                const matches = videoData.youtubeTitle === vimeoTitle;
                const emoji = matches ? '✅' : '⚠️';
                titleHtml = `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${emoji} ${videoData.youtubeTitle}</div>`;
            }
            links.push(`
                <div style="display: flex; flex-direction: column;">
                    <a href="${videoData.youtubeUrl}" target="_blank" rel="noopener" style="color: var(--color-blue-light); text-decoration: none;">YouTube ↗</a>
                    ${titleHtml}
                </div>
            `);
        }

        if (videoData.peertubeUrl) {
            let titleHtml = '';
            if (videoData.peertubeTitle) {
                const matches = videoData.peertubeTitle === vimeoTitle;
                const emoji = matches ? '✅' : '⚠️';
                titleHtml = `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${emoji} ${videoData.peertubeTitle}</div>`;
            }
            links.push(`
                <div style="display: flex; flex-direction: column;">
                    <a href="${videoData.peertubeUrl}" target="_blank" rel="noopener" style="color: var(--color-blue-light); text-decoration: none;">PeerTube ↗</a>
                    ${titleHtml}
                </div>
            `);
        }

        watchLinksItem = `
            <div class="video-metadata-item" style="flex-basis: 100%;">
                <div class="video-metadata-label">Watch Links</div>
                <div class="video-metadata-value" style="display: flex; gap: 20px; flex-wrap: wrap;">${links.join('')}</div>
            </div>
        `;
    }

    // Build metadata items
    const metadataItems = `
        <div class="video-metadata-item">
            <div class="video-metadata-label">Vimeo ID</div>
            <div class="video-metadata-value">${videoData.vimeoId}</div>
        </div>
        <div class="video-metadata-item">
            <div class="video-metadata-label">Duration</div>
            <div class="video-metadata-value">${duration}</div>
        </div>
        ${watchLinksItem}
    `;

    card.innerHTML = `
        <div class="video-card-header">
            <div class="video-card-title">${videoData.title || 'Untitled Video'}</div>
            <button class="delete-btn" onclick="deleteVideo('${videoData.id}')">Delete</button>
        </div>

        <div class="video-metadata">
            ${metadataItems}
        </div>

        <div class="video-preview">
            <div class="video-preview-item">
                <div class="video-preview-label">Vimeo Embed</div>
                <iframe src="https://player.vimeo.com/video/${videoData.vimeoId}?dnt=1&title=1&byline=0&portrait=0"
                    frameborder="0"
                    allow="fullscreen; picture-in-picture"
                    allowfullscreen
                    loading="lazy"
                    style="aspect-ratio: ${videoData.oEmbed.width} / ${videoData.oEmbed.height};"></iframe>
            </div>

            <div class="video-preview-item">
                <div class="video-preview-label">HTML5 Video (Direct File)</div>
                <video controls preload="metadata" playsinline poster="${thumbnailUrl}" style="aspect-ratio: ${videoData.oEmbed.width} / ${videoData.oEmbed.height};">
                    <source src="${videoData.videoFileUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>

            <div class="video-preview-item">
                <div class="video-preview-label">Thumbnail</div>
                <img src="${thumbnailUrl}" alt="${videoData.title || 'Video thumbnail'}">
            </div>
        </div>

        <div class="shortcode-output">
            <div class="output-header">
                <div class="output-label">Shortcode</div>
                <button class="copy-btn" onclick="copyShortcode('${videoData.id}', this)">Copy</button>
            </div>
            <pre id="${videoData.id}-shortcode">${shortcode}</pre>
        </div>
    `;

    // Insert at the beginning (newest at top)
    container.insertBefore(card, container.firstChild);
}

// Generate shortcode for a video
function generateShortcode(videoData) {
    // Build watch links JSON
    const watchLinks = {};

    if (videoData.youtubeUrl) {
        watchLinks.Youtube = videoData.youtubeUrl;
    }

    if (videoData.peertubeUrl) {
        watchLinks.Peertube = videoData.peertubeUrl;
    }

    // Generate shortcode
    let shortcode = `{% video "${videoData.vimeoId}", "${videoData.videoFileUrl}"`;

    if (Object.keys(watchLinks).length > 0) {
        const watchLinksJson = JSON.stringify(watchLinks);
        shortcode += `, '${watchLinksJson}'`;
    }

    shortcode += ' %}';

    return shortcode;
}

// Copy shortcode to clipboard
function copyShortcode(videoId, btn) {
    const output = document.getElementById(`${videoId}-shortcode`);
    const text = output.textContent;

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

// Delete a video
function deleteVideo(videoId) {
    // Remove from array
    videos = videos.filter(v => v.id !== videoId);

    // Remove from DOM
    const card = document.getElementById(videoId);
    if (card) {
        card.remove();
    }

    // Show empty state if no videos
    if (videos.length === 0) {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'block';
        }
    }

    // Save state
    saveState();
}

// Clear all data
function clearAllData() {
    if (videos.length === 0) {
        return;
    }

    if (!confirm('Are you sure you want to clear all videos? This cannot be undone.')) {
        return;
    }

    videos = [];
    videoIdCounter = 0;

    // Clear container
    const container = document.getElementById('videosContainer');
    container.innerHTML = '';

    // Show empty state
    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
        emptyState.style.display = 'block';
    }

    // Clear input and error
    document.getElementById('tsvInput').value = '';
    hideError();

    // Save state
    saveState();
}

// LocalStorage functions
function saveState() {
    const state = {
        videos: videos,
        videoIdCounter: videoIdCounter
    };

    localStorage.setItem('videoShortcodeGeneratorState', JSON.stringify(state));
}

function loadState() {
    const savedState = localStorage.getItem('videoShortcodeGeneratorState');
    if (!savedState) return;

    try {
        const state = JSON.parse(savedState);

        // Restore counter
        videoIdCounter = state.videoIdCounter || 0;

        // Restore videos
        if (state.videos && state.videos.length > 0) {
            videos = state.videos;

            // Create cards for all videos (in order)
            videos.forEach(videoData => {
                createVideoCard(videoData);
            });
        }
    } catch (err) {
        console.error('Failed to load state:', err);
    }
}

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
updateDatabaseStatus();
