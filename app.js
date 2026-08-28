const cvWindow = document.getElementById('cv-window');
const taskbarBtn = document.getElementById('taskbar-cv');
const titleBar = document.getElementById('cv-title-bar');

const mcWindow = document.getElementById('mycomputer-window');
const mcTaskbarBtn = document.getElementById('taskbar-mycomputer');
const mcTitleBar = document.getElementById('mycomputer-title-bar');

const mailWindow = document.getElementById('mail-window');
const mailTaskbarBtn = document.getElementById('taskbar-mail');
const mailTitleBar = document.getElementById('mail-title-bar');

// Clippy popup
const clippyPopup = document.getElementById('clippy-popup');
let clippyTimeout;

function showClippy() {
    // Clear any existing timeout
    if (clippyTimeout) clearTimeout(clippyTimeout);

    // Remove fade-out class and show
    clippyPopup.classList.remove('fade-out');
    clippyPopup.classList.add('show');

    // Auto-hide after 3 seconds
    clippyTimeout = setTimeout(() => {
        clippyPopup.classList.add('fade-out');
        setTimeout(() => {
            clippyPopup.classList.remove('show', 'fade-out');
        }, 300);
    }, 3000);
}

// Open/Close Logic
function openCV() {
    cvWindow.style.setProperty('display', 'flex', 'important');
    taskbarBtn.style.display = 'flex';
    taskbarBtn.classList.add('active');

    // Bring to front or ensure initial center if not set
    // Check if top/left are set. If not (first open), calculate center.
    if (!cvWindow.style.left) {
        centerWindow();
    }
}

function centerWindow() {
    const rect = cvWindow.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    // Default size 900x600 if not set
    const width = rect.width || 900;
    const height = rect.height || 600;

    const left = (winWidth - width) / 2;
    const top = (winHeight - height) / 2 > 0 ? (winHeight - height) / 2 : 50;

    cvWindow.style.width = `${width}px`;
    cvWindow.style.left = `${left}px`;
    cvWindow.style.top = `${top}px`;
    cvWindow.style.transform = 'none'; // Ensure no CSS transform
    cvWindow.style.margin = '0'; // Ensure no margin auto
}

function closeWindow() {
    cvWindow.style.setProperty('display', 'none', 'important');
    taskbarBtn.style.display = 'none';
    taskbarBtn.classList.remove('active');
}

function minimizeWindow() {
    cvWindow.style.setProperty('display', 'none', 'important');
    taskbarBtn.classList.remove('active');
}

function maximizeWindow() {
    // Simplified maximize logic
    if (cvWindow.dataset.state === 'maximized') {
        // Restore
        cvWindow.style.width = cvWindow.dataset.prevWidth || '900px';
        cvWindow.style.height = cvWindow.dataset.prevHeight || '';
        cvWindow.style.top = cvWindow.dataset.prevTop || '50px';
        cvWindow.style.left = cvWindow.dataset.prevLeft || '100px';
        cvWindow.dataset.state = 'normal';
        // No transform needed
    } else {
        // Save current state
        cvWindow.dataset.prevWidth = cvWindow.style.width;
        cvWindow.dataset.prevHeight = cvWindow.style.height;
        cvWindow.dataset.prevTop = cvWindow.style.top;
        cvWindow.dataset.prevLeft = cvWindow.style.left;

        // Maximize
        cvWindow.style.width = '100vw';
        cvWindow.style.height = 'calc(100vh - 28px)'; // Subtract taskbar
        cvWindow.style.top = '0';
        cvWindow.style.left = '0';
        cvWindow.dataset.state = 'maximized';
    }
}

function toggleWindow() {
    if (cvWindow.style.display === 'none' || getComputedStyle(cvWindow).display === 'none') {
        cvWindow.style.setProperty('display', 'flex', 'important');
        // Ensure centered if first time
        if (!cvWindow.style.left) centerWindow();
        taskbarBtn.classList.add('active');
    } else {
        cvWindow.style.setProperty('display', 'none', 'important');
        taskbarBtn.classList.remove('active');
    }
}

// Dragging Logic
makeDraggable(titleBar, cvWindow);


// Resizing Logic (works for any window with .resizer-* children)
const MIN_WIDTH = 300;
const MIN_HEIGHT = 200;
const MAX_WIDTH = window.innerWidth;
const MAX_HEIGHT = window.innerHeight;

document.querySelectorAll('.resizer-r, .resizer-b, .resizer-br, .resizer-l').forEach(resizer => {
    resizer.addEventListener('mousedown', (e) => {
        const win = resizer.closest('.window');
        const sx = e.clientX, sy = e.clientY;
        const rect = win.getBoundingClientRect();
        const iw = rect.width, ih = rect.height, il = rect.left;
        e.preventDefault();

        const onMove = (e) => {
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (resizer.classList.contains('resizer-r')) {
                win.style.width = `${Math.min(Math.max(iw + dx, MIN_WIDTH), MAX_WIDTH)}px`;
            } else if (resizer.classList.contains('resizer-b')) {
                win.style.height = `${Math.min(Math.max(ih + dy, MIN_HEIGHT), MAX_HEIGHT)}px`;
            } else if (resizer.classList.contains('resizer-br')) {
                win.style.width = `${Math.min(Math.max(iw + dx, MIN_WIDTH), MAX_WIDTH)}px`;
                win.style.height = `${Math.min(Math.max(ih + dy, MIN_HEIGHT), MAX_HEIGHT)}px`;
            } else if (resizer.classList.contains('resizer-l')) {
                let nw = Math.min(Math.max(iw - dx, MIN_WIDTH), MAX_WIDTH);
                win.style.width = `${nw}px`;
                win.style.left = `${il + iw - nw}px`;
            }
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
});

// My Computer window
function openMyComputer() {
    mcWindow.style.setProperty('display', 'flex', 'important');
    mcTaskbarBtn.style.display = 'flex';
    mcTaskbarBtn.classList.add('active');
    bringToFront(mcWindow);
}

function closeMyComputer() {
    mcWindow.style.setProperty('display', 'none', 'important');
    mcTaskbarBtn.style.display = 'none';
    mcTaskbarBtn.classList.remove('active');
}

function minimizeMyComputer() {
    mcWindow.style.setProperty('display', 'none', 'important');
    mcTaskbarBtn.classList.remove('active');
}

function maximizeMyComputer() {
    if (mcWindow.dataset.state === 'maximized') {
        mcWindow.style.width = mcWindow.dataset.prevWidth || '550px';
        mcWindow.style.height = mcWindow.dataset.prevHeight || '350px';
        mcWindow.style.top = mcWindow.dataset.prevTop || '100px';
        mcWindow.style.left = mcWindow.dataset.prevLeft || '200px';
        mcWindow.dataset.state = 'normal';
    } else {
        mcWindow.dataset.prevWidth = mcWindow.style.width;
        mcWindow.dataset.prevHeight = mcWindow.style.height;
        mcWindow.dataset.prevTop = mcWindow.style.top;
        mcWindow.dataset.prevLeft = mcWindow.style.left;
        mcWindow.style.width = '100vw';
        mcWindow.style.height = 'calc(100vh - 28px)';
        mcWindow.style.top = '0';
        mcWindow.style.left = '0';
        mcWindow.dataset.state = 'maximized';
    }
}

function toggleMyComputer() {
    if (mcWindow.style.display === 'none' || getComputedStyle(mcWindow).display === 'none') {
        mcWindow.style.setProperty('display', 'flex', 'important');
        mcTaskbarBtn.classList.add('active');
        bringToFront(mcWindow);
    } else {
        mcWindow.style.setProperty('display', 'none', 'important');
        mcTaskbarBtn.classList.remove('active');
    }
}

// Mail window
function openMail() {
    mailWindow.style.setProperty('display', 'flex', 'important');
    mailTaskbarBtn.style.display = 'flex';
    mailTaskbarBtn.classList.add('active');
    bringToFront(mailWindow);
}

function closeMail() {
    mailWindow.style.setProperty('display', 'none', 'important');
    mailTaskbarBtn.style.display = 'none';
    mailTaskbarBtn.classList.remove('active');
}

function minimizeMail() {
    mailWindow.style.setProperty('display', 'none', 'important');
    mailTaskbarBtn.classList.remove('active');
}

function maximizeMail() {
    if (mailWindow.dataset.state === 'maximized') {
        mailWindow.style.width = mailWindow.dataset.prevWidth || '500px';
        mailWindow.style.height = mailWindow.dataset.prevHeight || '400px';
        mailWindow.style.top = mailWindow.dataset.prevTop || '80px';
        mailWindow.style.left = mailWindow.dataset.prevLeft || '300px';
        mailWindow.dataset.state = 'normal';
    } else {
        mailWindow.dataset.prevWidth = mailWindow.style.width;
        mailWindow.dataset.prevHeight = mailWindow.style.height;
        mailWindow.dataset.prevTop = mailWindow.style.top;
        mailWindow.dataset.prevLeft = mailWindow.style.left;
        mailWindow.style.width = '100vw';
        mailWindow.style.height = 'calc(100vh - 28px)';
        mailWindow.style.top = '0';
        mailWindow.style.left = '0';
        mailWindow.dataset.state = 'maximized';
    }
}

function toggleMail() {
    if (mailWindow.style.display === 'none' || getComputedStyle(mailWindow).display === 'none') {
        mailWindow.style.setProperty('display', 'flex', 'important');
        mailTaskbarBtn.classList.add('active');
        bringToFront(mailWindow);
    } else {
        mailWindow.style.setProperty('display', 'none', 'important');
        mailTaskbarBtn.classList.remove('active');
    }
}

// Z-index management
let topZ = 11;
function bringToFront(win) {
    topZ++;
    win.style.zIndex = topZ;
}

// Bring window to front on mousedown
cvWindow.addEventListener('mousedown', () => bringToFront(cvWindow));
mcWindow.addEventListener('mousedown', () => bringToFront(mcWindow));
mailWindow.addEventListener('mousedown', () => bringToFront(mailWindow));

// Generic drag setup
function makeDraggable(titleBarEl, windowEl) {
    titleBarEl.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        let dragging = true;
        const sx = e.clientX, sy = e.clientY;
        const il = windowEl.offsetLeft, it = windowEl.offsetTop;
        bringToFront(windowEl);

        const onMove = (e) => {
            if (!dragging) return;
            windowEl.style.left = `${il + (e.clientX - sx)}px`;
            windowEl.style.top = `${it + (e.clientY - sy)}px`;
        };
        const onUp = () => {
            dragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}
makeDraggable(mcTitleBar, mcWindow);
makeDraggable(mailTitleBar, mailWindow);

// Simple clock
function updateTime() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    document.querySelector('.taskbar-time').textContent = `${hours}:${minutes} ${ampm}`;
}
setInterval(updateTime, 60000);
updateTime();

// ---------------------------------------------------------------------------
// CV rendering — cv.json is the single source of truth for the CV content.
// The DOM built here must keep the class names style.css and print.js rely on.
// ---------------------------------------------------------------------------

const cvContent = document.querySelector('.cv-content');

// Build an element with an optional class, appending inline nodes or text.
function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
}

// An "inline node" is either a plain string, {text, href} for a link, or
// {text, bold: true} for a <b>. Everything becomes a text node, so nothing is
// ever interpreted as markup.
function appendInline(parent, nodes) {
    const list = Array.isArray(nodes) ? nodes : [nodes];
    list.forEach(item => {
        if (item === null || item === undefined) return;
        if (typeof item === 'string') {
            parent.appendChild(document.createTextNode(item));
            return;
        }
        let node;
        if (item.href) {
            node = document.createElement('a');
            node.setAttribute('href', item.href);
        } else if (item.bold) {
            node = document.createElement('b');
        } else {
            node = document.createElement('span');
        }
        node.appendChild(document.createTextNode(item.text || ''));
        parent.appendChild(node);
    });
}

function divider() {
    return el('div', 'section-divider');
}

function heading(text) {
    const h = el('div', 'section-heading');
    h.textContent = text;
    return h;
}

function section(className, headingText) {
    const s = el('section', className);
    s.appendChild(heading(headingText));
    return s;
}

function bulletList(className, items) {
    const ul = el('ul', className);
    items.forEach(item => {
        const li = document.createElement('li');
        appendInline(li, item);
        ul.appendChild(li);
    });
    return ul;
}

function renderHeader(data) {
    const header = document.createElement('header');

    const h1 = document.createElement('h1');
    appendInline(h1, { text: data.name, href: data.nameHref });
    header.appendChild(h1);

    const contact = el('div', 'contact-info');
    contact.appendChild(document.createTextNode(data.location));
    contact.appendChild(document.createElement('br'));
    appendInline(contact, { text: data.email, href: 'mailto:' + data.email });
    header.appendChild(contact);

    return header;
}

function renderProfile(text) {
    const s = section('profile', 'PROFILE');
    const p = document.createElement('p');
    p.textContent = text;
    s.appendChild(p);
    return s;
}

function renderEducation(entries) {
    const s = section('education', 'EDUCATION');
    entries.forEach(entry => {
        const row = el('div', 'two-column');

        const left = el('div', 'column-left');
        left.textContent = entry.period;
        row.appendChild(left);

        const right = el('div', 'column-right');
        right.setAttribute('style', 'display: flex; justify-content: space-between;');
        const school = document.createElement('div');
        school.textContent = entry.school;
        const place = document.createElement('div');
        place.textContent = entry.location;
        right.appendChild(school);
        right.appendChild(place);
        row.appendChild(right);

        s.appendChild(row);
    });
    return s;
}

function renderLanguages(entries) {
    const s = section('languages', 'LANGUAGES');
    entries.forEach(entry => {
        const item = el('div', 'language-item');
        const name = document.createElement('span');
        name.textContent = entry.language;
        const level = document.createElement('span');
        level.textContent = entry.level;
        item.appendChild(name);
        // The two spans are inline on screen; the separating space is part of
        // the original markup and must be kept.
        item.appendChild(document.createTextNode(' '));
        item.appendChild(level);
        s.appendChild(item);
    });
    return s;
}

function renderExperience(jobs) {
    const s = section('experience', 'EXPERIENCE');
    jobs.forEach(job => {
        const wrapper = el('div', 'job');
        const row = el('div', 'two-column');

        const left = el('div', 'column-left');
        const company = el('div', 'job-company');
        company.textContent = job.company;
        const title = el('div', 'job-title');
        title.textContent = job.title;
        const period = el('div', 'job-period');
        period.textContent = job.period;
        left.appendChild(company);
        left.appendChild(title);
        left.appendChild(period);

        const right = el('div', 'column-right');
        const details = el('div', 'job-details');
        if (job.subtitle) {
            const subtitle = el('div', 'job-subtitle');
            subtitle.textContent = job.subtitle;
            details.appendChild(subtitle);
        }
        const ul = document.createElement('ul');
        (job.bullets || []).forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            ul.appendChild(li);
        });
        details.appendChild(ul);
        right.appendChild(details);

        row.appendChild(left);
        row.appendChild(right);
        wrapper.appendChild(row);
        s.appendChild(wrapper);
    });
    return s;
}

function renderProfiles(entries) {
    const s = section('profiles', 'PROFILES');
    entries.forEach(entry => {
        const item = el('div', 'profile-item');

        const platform = el('div', 'profile-platform');
        platform.textContent = entry.platform;

        const handle = el('div', 'profile-handle');
        appendInline(handle, { text: entry.handle, href: entry.href });

        const description = document.createElement('div');
        description.textContent = entry.description;

        item.appendChild(platform);
        item.appendChild(handle);
        item.appendChild(description);
        s.appendChild(item);
    });
    return s;
}

function renderCertifications(items) {
    const s = section('certifications', 'CERTIFICATIONS AND COURSES');
    const ul = el('ul', 'cert-list');
    items.forEach(item => {
        const li = document.createElement('li');
        appendInline(li, item.title);
        if (item.subitem) {
            // Whitespace between the title and the subitem is significant:
            // .subitem is only block-level in the print stylesheet.
            li.appendChild(document.createTextNode(' '));
            const sub = el('span', 'subitem');
            appendInline(sub, item.subitem);
            li.appendChild(sub);
        }
        ul.appendChild(li);
    });
    s.appendChild(ul);
    return s;
}

function renderCV(data) {
    const frag = document.createDocumentFragment();

    frag.appendChild(renderHeader(data));
    frag.appendChild(divider());
    frag.appendChild(renderProfile(data.profile));
    frag.appendChild(divider());
    frag.appendChild(renderEducation(data.education));
    frag.appendChild(divider());
    frag.appendChild(renderLanguages(data.languages));
    frag.appendChild(divider());
    frag.appendChild(renderExperience(data.experience));
    frag.appendChild(divider());
    frag.appendChild(bulletListSection('events', 'COMPETITIONS & ACHIEVEMENTS', data.competitions));
    frag.appendChild(divider());
    frag.appendChild(renderProfiles(data.profiles));
    frag.appendChild(divider());
    frag.appendChild(renderCertifications(data.certifications));
    frag.appendChild(divider());
    frag.appendChild(bulletListSection('events', 'ATTENDED EVENTS', data.attendedEvents));

    cvContent.textContent = '';
    cvContent.appendChild(frag);
}

function bulletListSection(className, headingText, items) {
    const s = section(className, headingText);
    s.appendChild(bulletList('events-list', items));
    return s;
}

// Renders a readable notice instead of an empty window when cv.json cannot be
// fetched — most commonly when the page is opened straight off the filesystem.
function renderCVError() {
    cvContent.textContent = '';
    const p = document.createElement('p');
    p.textContent = 'The CV could not be loaded. This page needs to be served over HTTP — see https://barathanaslan.com';
    cvContent.appendChild(p);
}

// Always resolves, so the desktop is revealed whatever happens.
function loadCV() {
    return fetch('cv.json')
        .then(response => {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        })
        .then(renderCV)
        .catch(error => {
            console.error('Could not load cv.json:', error);
            try { renderCVError(); } catch (e) { /* nothing more we can do */ }
        });
}

// Kick the fetch off immediately, but hold the fade-in until the CV is in the
// DOM so the window never flashes empty.
const cvLoaded = loadCV();

// Open on load
// Initial center calculation
window.addEventListener('load', () => {
    centerWindow();
    openCV();
    // Reveal the page after positioning is complete
    cvLoaded.then(() => {
        document.querySelector('.screen-layout').classList.add('ready');
    });
});
