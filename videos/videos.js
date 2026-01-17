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

// Load video data from TSV
async function loadVideoData() {
    const input = document.getElementById('tsvInput').value.trim();

    if (!input) {
        showError('Please paste TSV data first');
        return;
    }

    hideError();

    // Split by tabs
    const columns = input.split('\t');

    // Check if we have enough columns
    if (columns.length < 11) {
        showError(`Invalid TSV format. Expected at least 11 columns. Got ${columns.length}`);
        return;
    }

    // Extract relevant fields
    const title = columns[0] || '';
    const vimeoId = columns[4] || '';
    const videoFileUrl = columns[5] || '';
    const youtubeUrl = columns[7] || '';
    const peertubeUrl = columns[10] || '';

    // Validate required fields
    if (!vimeoId) {
        showError('Missing required field: Vimeo ID (column 5)');
        return;
    }

    if (!videoFileUrl) {
        showError('Missing required field: 720p video file URL (column 6)');
        return;
    }

    // Show loading state
    const btn = event.target;
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
        btn.textContent = 'Copied!';
        btn.style.background = 'var(--color-success)';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 2000);
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
