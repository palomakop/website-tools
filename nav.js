class WebsiteNav extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        // Get the current path to determine active link
        const currentPath = window.location.pathname;
        const isRoot = currentPath === '/' || currentPath.endsWith('/index.html');
        const isImages = currentPath.includes('/images/');
        const isVideos = currentPath.includes('/videos/');
        const isFrontmatter = currentPath.includes('/frontmatter/');
        const isColors = currentPath.includes('/colors/');

        this.innerHTML = `
            <nav class="site-nav">
                <div class="nav-container">
                    <a href="/" class="nav-title ${isRoot ? 'active' : ''}">Website Tools</a>
                    <button class="nav-hamburger" id="navHamburger" aria-label="Menu">
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                    <div class="nav-links">
                        <a href="/images/" class="nav-link ${isImages ? 'active' : ''}">Images</a>
                        <a href="/videos/" class="nav-link ${isVideos ? 'active' : ''}">Videos</a>
                        <a href="/frontmatter/" class="nav-link ${isFrontmatter ? 'active' : ''}">Frontmatter</a>
                        <a href="/colors/" class="nav-link ${isColors ? 'active' : ''}">Colors</a>
                    </div>
                </div>
                <div class="nav-drawer" id="navDrawer">
                    <div class="nav-drawer-overlay" id="navDrawerOverlay"></div>
                    <div class="nav-drawer-content">
                        <div class="nav-drawer-header">
                            <span class="nav-drawer-title">Tools</span>
                            <button class="nav-drawer-close" id="navDrawerClose" aria-label="Close menu">×</button>
                        </div>
                        <div class="nav-drawer-links">
                            <a href="/images/" class="nav-drawer-link ${isImages ? 'active' : ''}">Images</a>
                            <a href="/videos/" class="nav-drawer-link ${isVideos ? 'active' : ''}">Videos</a>
                            <a href="/frontmatter/" class="nav-drawer-link ${isFrontmatter ? 'active' : ''}">Frontmatter</a>
                            <a href="/colors/" class="nav-drawer-link ${isColors ? 'active' : ''}">Colors</a>
                        </div>
                    </div>
                </div>
            </nav>
        `;

        // Setup mobile menu toggle
        this.setupMobileMenu();
    }

    setupMobileMenu() {
        const hamburger = this.querySelector('#navHamburger');
        const drawer = this.querySelector('#navDrawer');
        const overlay = this.querySelector('#navDrawerOverlay');
        const closeBtn = this.querySelector('#navDrawerClose');

        const openDrawer = () => {
            drawer.classList.add('open');
            document.body.style.overflow = 'hidden';
        };

        const closeDrawer = () => {
            drawer.classList.remove('open');
            document.body.style.overflow = '';
        };

        if (hamburger) {
            hamburger.addEventListener('click', openDrawer);
        }

        if (overlay) {
            overlay.addEventListener('click', closeDrawer);
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', closeDrawer);
        }

        // Close drawer when clicking a link
        const drawerLinks = this.querySelectorAll('.nav-drawer-link');
        drawerLinks.forEach(link => {
            link.addEventListener('click', closeDrawer);
        });
    }
}

customElements.define('website-nav', WebsiteNav);
