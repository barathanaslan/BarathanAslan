'use strict';

// ===========================================================================
// System apps: folder windows (My Documents, Recycle Bin), Internet Explorer,
// Notepad, Display Properties, Run and Shut Down.
// ===========================================================================

// Places worth a visit. My Documents, Internet Explorer and the Start menu
// all read from this list.
const LINKS = [
    {
        id: 'observatory', name: 'TRACE Observatory', url: 'https://observatory.barathanaslan.com',
        desc: 'Earthquakes solved by several models on one map, with their focal mechanisms. ' +
            'The research project I work on: TRACE, at Kandilli Observatory, Boğaziçi University.',
    },
    {
        id: 'blog', name: 'Craving Sugar', url: 'https://presser.ink/@barathan/craving-sugar',
        desc: 'My blog on Presser. On fruit flies, Millennium Problems, and what makes a stranger feel familiar.',
    },
    {
        id: 'github', name: 'GitHub', url: 'https://github.com/barathanaslan',
        desc: 'Internship projects and personal projects.',
    },
    {
        id: 'tailmon', name: 'tailmon', url: 'https://github.com/barathanaslan/tailmon',
        desc: 'A tailnet-wide resource monitor in one Go binary. It is also how this desktop knows which of my computers are awake.',
    },
    {
        id: 'whisper', name: 'phonetic-whisper-mlx', url: 'https://github.com/barathanaslan/phonetic-whisper-mlx',
        desc: 'Whisper-decoder fine-tunes for IPA transcription on Apple Silicon (MLX).',
    },
    {
        id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/in/barathanaslan/',
        desc: 'The professional version of this desktop.',
    },
    {
        id: 'kaggle', name: 'Kaggle', url: 'https://www.kaggle.com/barathanaslan',
        desc: 'Competitions, dataset creation and ML models.',
    },
    {
        id: 'huggingface', name: 'Hugging Face', url: 'https://huggingface.co/barathanasln',
        desc: 'Language and image models, and synthetic data.',
    },
];

// A labelled radio button in the 98.css markup (input + label).
let controlCount = 0;

function radio(name, value, label, checked) {
    const id = `ctl-${++controlCount}`;
    return h('div', { class: 'field-row' },
        h('input', { type: 'radio', id, name, value, checked: checked || null }),
        h('label', { for: id }, label));
}

// ---------------------------------------------------------------------------
// Folder windows
//
// FolderView(body, app, config) builds an Explorer-style window: menu bar,
// address bar, the Win98 "web view" side panel, an icon grid and a status
// bar. config.items() returns [{name, icon, shortcut, badge, desc, url,
// detail, open}]; call view.render() whenever it would return something new.
// ---------------------------------------------------------------------------
function FolderView(body, app, config) {
    const grid = h('div', { class: 'folder-grid', role: 'listbox', 'aria-label': config.title });
    const sideInfo = h('div', { class: 'folder-side-info' });
    const statusCount = h('p', { class: 'status-count' });
    const statusInfo = h('p');
    let selected = null;

    if (config.menus) body.appendChild(menubar(config.menus));
    body.appendChild(h('div', { class: 'address-bar' },
        h('span', { class: 'address-label' }, 'Address'),
        h('div', { class: 'address-field' },
            h('img', { src: iconSrc(config.icon, 16), alt: '', width: 16, height: 16 }),
            h('span', null, config.address))));

    body.appendChild(h('div', { class: 'folder-main sunken' },
        h('div', { class: 'folder-side' },
            h('img', { class: 'folder-side-icon', src: iconSrc(config.icon, 32), alt: '', width: 32, height: 32 }),
            h('div', { class: 'folder-side-title' }, config.title),
            h('div', { class: 'folder-side-rule' }),
            sideInfo),
        grid));
    body.appendChild(h('div', { class: 'window-status' }, statusCount, statusInfo));

    function describe(item) {
        sideInfo.textContent = '';
        if (!item) {
            sideInfo.appendChild(h('p', null, config.hint || 'Select an item to view its description.'));
            if (config.footer) sideInfo.appendChild(config.footer());
            statusInfo.textContent = config.status ? config.status() : '';
            return;
        }
        sideInfo.appendChild(h('p', { class: 'folder-side-name' }, item.name));
        if (item.desc) sideInfo.appendChild(h('p', null, item.desc));
        if (item.detail) sideInfo.appendChild(item.detail());
        if (item.url) {
            sideInfo.appendChild(h('p', null,
                h('a', { href: item.url, target: '_blank', rel: 'noopener' }, item.url.replace(/^https:\/\//, ''))));
        }
        statusInfo.textContent = item.status || item.desc || '';
    }

    function render() {
        const items = config.items();
        const selectedName = selected && selected.name;
        grid.textContent = '';
        selected = null;
        items.forEach(item => {
            const el = h('div', { class: 'folder-item', tabindex: '0', role: 'option', title: item.desc || item.name },
                h('span', { class: 'icon-img' + (item.shortcut ? ' shortcut' : '') },
                    h('img', { src: iconSrc(item.icon, 32), alt: '', width: 32, height: 32 }),
                    item.badge ? h('span', { class: 'status-light ' + item.badge, 'aria-hidden': 'true' }) : null),
                h('span', { class: 'icon-label' }, item.name));
            wireIcon(el, () => item.open && item.open(), () => {
                selected = item;
                describe(item);
            });
            grid.appendChild(el);
            if (item.name === selectedName) {
                el.classList.add('selected');
                selected = item;
            }
        });
        statusCount.textContent = `${items.length} object(s)`;
        describe(selected);
    }

    grid.addEventListener('pointerdown', e => {
        if (e.target === grid) {
            grid.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
            selected = null;
            describe(null);
        }
    });

    render();
    return { render, selected: () => selected };
}

function folderMenus(app, extraFile) {
    return [
        { label: 'File', items: () => [...(extraFile ? extraFile() : []), { label: 'Close', action: () => app.close() }] },
        { label: 'View', items: [{ label: 'Refresh', action: () => app.view && app.view.render() }] },
        { label: 'Help', items: [{ label: 'About Barathan 98', action: aboutBarathan98 }] },
    ];
}

function aboutBarathan98() {
    WM.messageBox({
        title: 'About Barathan 98',
        icon: 'info',
        text: [
            'Barathan 98',
            'A Windows 98 desktop in hand-written HTML, CSS and JavaScript. No frameworks, no trackers.',
            'Styles from 98.css by Jordan Scales. Everything else by Barathan Aslan.',
        ],
    });
}

// ---------------------------------------------------------------------------
// My Documents
// ---------------------------------------------------------------------------
WM.register('mydocuments', {
    title: 'My Documents',
    icon: 'my-documents',
    className: 'folder-window',
    width: 640,
    height: 420,
    create(body, app) {
        const documents = [
            {
                name: 'CV - Barathan Aslan.doc', icon: 'document',
                desc: 'My CV. There is a PDF download inside the document.',
                open: () => launch('cv'),
            },
            {
                name: 'readme.txt', icon: 'text-file',
                desc: 'Who I am, where to look and what to try on this desktop.',
                open: () => launch('notepad', { file: 'readme.txt' }),
            },
        ];
        app.view = FolderView(body, app, {
            title: 'My Documents',
            icon: 'my-documents',
            address: 'C:\\My Documents',
            menus: folderMenus(app),
            items: () => documents.concat(LINKS.map(link => ({
                name: link.name,
                icon: 'internet',
                shortcut: true,
                desc: link.desc,
                url: link.url,
                open: () => openLink(link.url),
            }))),
        });
    },
});

// ---------------------------------------------------------------------------
// Recycle Bin
// ---------------------------------------------------------------------------
const RECYCLED = [
    {
        name: "Barathan'sMacStudio", icon: 'computer',
        desc: 'Retired. Its work now runs on barathans-mini and barathans-5090.',
        restore: 'This computer has been retired. It is happier where it is.',
    },
    {
        name: 'BarathanNeedsRAMforCudaSetup', icon: 'computer',
        desc: 'Got the RAM. Now lives in My Computer as barathans-5090.',
        restore: 'No need: the RAM arrived. Look for barathans-5090 in My Computer.',
    },
    {
        name: 'sleep_schedule.txt', icon: 'text-file',
        desc: 'Deleted during finals week.',
        restore: 'sleep_schedule.txt is corrupted and cannot be restored.',
    },
    {
        name: 'final_v3_REAL_final.ipynb', icon: 'notebook',
        desc: 'Superseded by final_v4.ipynb.',
        restore: 'A newer version of this file (final_v4.ipynb) already exists.',
    },
    {
        name: 'model_that_overfit.pt', icon: 'notebook',
        desc: 'Training accuracy: 100%. Validation accuracy: let’s not talk about it.',
        restore: 'Restoring this model would only make it memorise the Recycle Bin.',
    },
    {
        name: 'Clippy.exe', icon: 'help', permanent: true,
        desc: 'The Office Assistant. Deleted many times.',
    },
];

let recycleBinItems = RECYCLED.slice();

function updateRecycleBinIcon() {
    const img = document.querySelector('#recycle-bin-icon img');
    if (img) img.src = iconSrc(recycleBinItems.length > 1 ? 'recycle-full' : 'recycle-empty', 32);
}

function restoreRecycled(item) {
    if (item.permanent) {
        showClippy("You can't get rid of me that easily.", 'I live in the Recycle Bin now. It is quite cosy.');
        return;
    }
    WM.messageBox({ title: 'Recycle Bin', icon: 'info', text: item.restore });
}

function emptyRecycleBin() {
    const deletable = recycleBinItems.filter(item => !item.permanent);
    if (!deletable.length) {
        showClippy('Still here.', 'Clippy.exe is in use and cannot be deleted.');
        return;
    }
    WM.messageBox({
        title: 'Confirm Multiple File Delete',
        icon: 'question',
        text: `Are you sure you want to delete these ${deletable.length} items?`,
        buttons: ['Yes', 'No'],
    }).then(answer => {
        if (answer !== 'Yes') return;
        recycleBinItems = recycleBinItems.filter(item => item.permanent);
        updateRecycleBinIcon();
        const app = WM.get('recyclebin');
        if (app && app.view) app.view.render();
        setTimeout(() => showClippy('Clippy.exe could not be deleted: it is in use.', 'By me.'), 400);
    });
}

WM.register('recyclebin', {
    title: 'Recycle Bin',
    icon: 'recycle-full',
    className: 'folder-window',
    width: 620,
    height: 400,
    create(body, app) {
        app.view = FolderView(body, app, {
            title: 'Recycle Bin',
            icon: 'recycle-full',
            address: 'C:\\RECYCLED',
            hint: 'Select an item to view its description. Double-click it to restore it.',
            menus: folderMenus(app, () => [
                {
                    label: 'Restore',
                    disabled: () => !app.view || !app.view.selected(),
                    action: () => restoreRecycled(app.view.selected()),
                },
                { label: 'Empty Recycle Bin', action: emptyRecycleBin },
                { separator: true },
            ]),
            items: () => recycleBinItems.map(item => Object.assign({}, item, { open: () => restoreRecycled(item) })),
        });
    },
});

// ---------------------------------------------------------------------------
// Internet Explorer — a home page of links. Real sites open in a new tab:
// most of them (GitHub, the Observatory) refuse to be framed by another site.
// ---------------------------------------------------------------------------
WM.register('ie', {
    title: "Barathan's Home Page - Microsoft Internet Explorer",
    icon: 'ie',
    className: 'ie-window',
    width: 720,
    height: 520,
    create(body, app) {
        const history = [];
        let position = -1;
        const page = h('div', { class: 'ie-page sunken' });
        const address = h('input', { type: 'text', class: 'ie-address', spellcheck: 'false', autocapitalize: 'off', 'aria-label': 'Address' });
        const status = h('p', null, 'Done');
        const backButton = h('button', { class: 'ie-tool', onclick: () => go(-1) }, h('span', { class: 'ie-glyph' }, '◀'), 'Back');
        const forwardButton = h('button', { class: 'ie-tool', onclick: () => go(1) }, h('span', { class: 'ie-glyph' }, '▶'), 'Forward');

        body.appendChild(menubar([
            {
                label: 'File', items: [
                    { label: 'Open...', action: () => { address.focus(); address.select(); } },
                    { separator: true },
                    { label: 'Close', action: () => app.close() },
                ],
            },
            {
                label: 'Favorites', items: () => [
                    { label: "Barathan's Home Page", icon: 'web-page', action: () => navigate('about:home') },
                    { separator: true },
                    ...LINKS.map(link => ({ label: link.name, icon: 'internet', action: () => navigate(link.url) })),
                ],
            },
            {
                label: 'Help', items: [
                    {
                        label: 'About Internet Explorer', action: () => WM.messageBox({
                            title: 'About Internet Explorer',
                            icon: 'info',
                            text: ['Microsoft Internet Explorer, more or less.',
                                'Most of the web refuses to load inside another site, so pages open in a new window, the way pop-ups used to.'],
                        }),
                    },
                ],
            },
        ]));

        body.appendChild(h('div', { class: 'ie-toolbar' },
            backButton,
            forwardButton,
            h('button', { class: 'ie-tool', onclick: () => render(history[position], false) }, h('span', { class: 'ie-glyph' }, '↻'), 'Refresh'),
            h('button', { class: 'ie-tool', onclick: () => navigate('about:home') }, h('span', { class: 'ie-glyph' }, '⌂'), 'Home')));

        body.appendChild(h('form', {
            class: 'address-bar',
            onsubmit: e => {
                e.preventDefault();
                navigate(address.value.trim());
            },
        },
            h('label', { class: 'address-label' }, 'Address'),
            address,
            h('button', { type: 'submit', class: 'ie-go' }, 'Go')));

        body.appendChild(page);
        body.appendChild(h('div', { class: 'window-status' }, status, h('p', { class: 'ie-zone' }, 'Internet zone')));

        function normalise(url) {
            if (!url) return 'about:home';
            if (/^about:/i.test(url)) return url.toLowerCase();
            if (!/^[a-z]+:\/\//i.test(url)) return 'https://' + url;
            return url;
        }

        function navigate(raw) {
            const url = normalise(raw);
            history.length = position + 1;
            history.push(url);
            position = history.length - 1;
            render(url, true);
        }

        function go(step) {
            const next = position + step;
            if (next < 0 || next >= history.length) return;
            position = next;
            render(history[position], false);
        }

        function render(url, fresh) {
            address.value = url;
            backButton.disabled = position <= 0;
            forwardButton.disabled = position >= history.length - 1;
            page.textContent = '';
            page.scrollTop = 0;
            if (url === 'about:home') {
                app.setTitle("Barathan's Home Page - Microsoft Internet Explorer");
                page.appendChild(homePage(navigate));
                status.textContent = 'Done';
                return;
            }
            if (/^https?:\/\/[^\s]+$/i.test(url)) {
                const link = LINKS.find(l => l.url === url);
                app.setTitle(`${link ? link.name : url} - Microsoft Internet Explorer`);
                page.appendChild(newWindowPage(url, link));
                status.textContent = 'Opened in a new window';
                if (fresh) openLink(url);
                return;
            }
            app.setTitle('Cannot find server - Microsoft Internet Explorer');
            page.appendChild(h('div', { class: 'ie-content' },
                h('h1', { class: 'ie-error-title' }, 'The page cannot be displayed'),
                h('p', null, `"${url}" is not something this browser understands.`),
                h('p', null, 'Try a web address, like barathanaslan.com, or go back to the ',
                    h('a', { href: '#', onclick: e => { e.preventDefault(); navigate('about:home'); } }, 'home page'), '.')));
            status.textContent = 'Done';
        }

        app.navigate = navigate;
        navigate('about:home');
    },
    onOpen(args, app) {
        if (args.url) app.navigate(args.url);
    },
});

function homePage(navigate) {
    const appLink = (label, id, args) => h('a', {
        href: '#',
        onclick: e => {
            e.preventDefault();
            launch(id, args);
        },
    }, label);

    return h('div', { class: 'ie-content home-page' },
        h('div', { class: 'home-banner' },
            h('h1', null, "Welcome to Barathan's Home Page!"),
            h('div', { class: 'marquee', 'aria-hidden': 'true' },
                h('span', null, '★ Now: Research Assistant at TRACE, tracing earthquakes at Kandilli Observatory ★ ' +
                    'New on this site: Minesweeper, Solitaire and a live ping to my computers ★'))),
        h('p', null, "Hi! I'm Barathan, a Computer Engineering student at Boğaziçi University. " +
            'I like pattern recognition and prediction, and I apply it wherever I can: ML and LLM models, earthquakes, markets.'),
        h('h2', null, 'Cool Links'),
        h('ul', { class: 'home-links' },
            LINKS.map(link => h('li', null,
                h('a', {
                    href: link.url,
                    onclick: e => {
                        e.preventDefault();
                        navigate(link.url);
                    },
                }, link.name),
                ' — ', link.desc))),
        h('h2', null, 'Things To Do On This Computer'),
        h('ul', { class: 'home-links' },
            h('li', null, appLink('Play Minesweeper', 'minesweeper'), ' — the first click is always safe.'),
            h('li', null, appLink('Play Solitaire', 'solitaire'), ' — Klondike, draw one or draw three.'),
            h('li', null, appLink('Ping my computers', 'dos', { run: 'ping barathans-5090' }), ' — live status, relayed safely.'),
            h('li', null, appLink('Read my CV', 'cv'), ' or ', appLink('send me mail', 'mail'), '.')),
        h('div', { class: 'under-construction' }, h('span', null, 'UNDER CONSTRUCTION')),
        h('p', { class: 'home-footer' },
            'Best viewed with Internet Explorer 4.0 at 800 × 600.', h('br'),
            '© 1998–2026 Barathan Aslan'));
}

function newWindowPage(url, link) {
    return h('div', { class: 'ie-content' },
        h('h1', { class: 'ie-error-title' }, link ? link.name : 'Opening page...'),
        link ? h('p', null, link.desc) : null,
        h('p', null, 'This page opened in a new window. Most sites will not load inside someone else’s page, so this browser hands them to yours.'),
        h('p', null, 'If nothing happened, ', h('a', { href: url, target: '_blank', rel: 'noopener' }, 'click here'), '.'));
}

// ---------------------------------------------------------------------------
// Notepad
//
// readme.txt ships with the site. A visitor may edit and save it; the saved
// copy lives in their browser only and is dropped if the original changes.
// "Untitled" is a scratch pad that saves itself as you type.
// ---------------------------------------------------------------------------
const README_TEXT = `readme.txt
==========

Hi, I'm Barathan.

I'm a senior Computer Engineering student at Boğaziçi University and a
research assistant on TRACE (Türkiye Real-time AI Catalog for Earthquake
Monitoring & Early Warning) at Kandilli Observatory, supported by
Google.org. In short: I trace earthquakes.

Before that I was an associate data scientist at Pegasus, and an intern
at Fimple and at Doping Technology.


WHERE TO LOOK
-------------
  CV - Barathan Aslan.doc   my CV, on the desktop
  TRACE Observatory         earthquakes solved by several models on one map
  Craving Sugar             my blog
  My Documents              shortcuts to all of the above, and to GitHub


THINGS TO TRY
-------------
  * Double-click My Computer to see which of my computers are awake.
  * Start > Run..., then type:  ping barathans-5090
  * Start > Programs > Games. The first Minesweeper click is always safe.
  * Right-click the desktop > Properties to change the wallpaper.

You can edit this file. Your changes stay in your own browser.

Say hi: Send Mail on the desktop, or barathanasln@gmail.com
`;

const NOTEPAD_FILES = { 'readme.txt': README_TEXT };

WM.register('notepad', {
    title: 'Untitled - Notepad',
    icon: 'notepad',
    className: 'notepad-window',
    width: 600,
    height: 440,
    create(body, app) {
        const state = { file: null, saved: '', wrap: store.get('notepad.wrap', true) };
        const text = h('textarea', { class: 'notepad-text', spellcheck: 'false', 'aria-label': 'Document' });

        const savedCopyKey = file => 'notepad.copy.' + file;

        function load(file) {
            if (file && NOTEPAD_FILES[file] !== undefined) {
                state.file = file;
                const copy = store.get(savedCopyKey(file), null);
                text.value = copy && copy.orig === NOTEPAD_FILES[file] ? copy.text : NOTEPAD_FILES[file];
            } else {
                state.file = null;
                text.value = store.get('notepad.untitled', '');
            }
            state.saved = text.value;
            text.scrollTop = 0;
            text.setSelectionRange(0, 0);
            app.setTitle(`${state.file || 'Untitled'} - Notepad`);
        }

        function save() {
            if (state.file) {
                store.set(savedCopyKey(state.file), { orig: NOTEPAD_FILES[state.file], text: text.value });
            } else {
                store.set('notepad.untitled', text.value);
            }
            state.saved = text.value;
        }

        function revert() {
            if (!state.file) return;
            store.remove(savedCopyKey(state.file));
            load(state.file);
        }

        // Resolves true when it is fine to drop the current text.
        function confirmDiscard() {
            if (!state.file || text.value === state.saved) return Promise.resolve(true);
            return WM.messageBox({
                title: 'Notepad',
                icon: 'warning',
                text: `The text in the ${state.file} file has changed. Do you want to save the changes?`,
                buttons: ['Yes', 'No', 'Cancel'],
            }).then(answer => {
                if (answer === 'Yes') save();
                return answer === 'Yes' || answer === 'No';
            });
        }

        app.openFile = file => {
            // Opening the file that is already open keeps any unsaved edits.
            if (file && file === state.file) return Promise.resolve();
            return confirmDiscard().then(ok => {
                if (!ok) return;
                flushDraft();
                load(file);
            });
        };
        app.confirmDiscard = confirmDiscard;
        // Closing without saving ("No") drops the edits.
        app.discardEdits = () => {
            flushDraft();
            text.value = state.saved;
        };

        function applyWrap() {
            text.classList.toggle('nowrap', !state.wrap);
            text.setAttribute('wrap', state.wrap ? 'soft' : 'off');
        }

        let draftTimer;
        // The Untitled draft saves itself shortly after typing stops; write
        // it now before switching away, so it never lands in another file.
        function flushDraft() {
            if (!draftTimer) return;
            clearTimeout(draftTimer);
            draftTimer = null;
            if (!state.file) save();
        }
        text.addEventListener('input', () => {
            if (state.file) return;
            clearTimeout(draftTimer);
            draftTimer = setTimeout(save, 400);
        });

        function insertTimeDate() {
            const now = new Date();
            const stamp = `${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} ${now.toLocaleDateString()}`;
            text.setRangeText(stamp, text.selectionStart, text.selectionEnd, 'end');
            text.focus();
        }

        body.appendChild(menubar([
            {
                label: 'File', items: () => [
                    { label: 'New', action: () => app.openFile(null) },
                    { label: 'Open readme.txt', action: () => app.openFile('readme.txt') },
                    { label: 'Save', shortcut: 'Ctrl+S', action: save },
                    {
                        label: 'Revert to Original',
                        disabled: () => !state.file || store.get(savedCopyKey(state.file), null) === null,
                        action: revert,
                    },
                    { separator: true },
                    { label: 'Exit', action: () => app.close() },
                ],
            },
            {
                label: 'Edit', items: [
                    { label: 'Select All', action: () => { text.focus(); text.select(); } },
                    { label: 'Time/Date', shortcut: 'F5', action: insertTimeDate },
                ],
            },
            {
                label: 'Format', items: () => [
                    {
                        label: 'Word Wrap', checked: state.wrap, action: () => {
                            state.wrap = !state.wrap;
                            store.set('notepad.wrap', state.wrap);
                            applyWrap();
                        },
                    },
                ],
            },
            {
                label: 'Help', items: [
                    {
                        label: 'About Notepad', action: () => WM.messageBox({
                            title: 'About Notepad', icon: 'info',
                            text: ['Notepad', 'Whatever you save here stays in your browser. Nothing is sent anywhere.'],
                        }),
                    },
                ],
            },
        ]));
        body.appendChild(text);

        text.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                save();
            } else if (e.key === 'F5') {
                e.preventDefault();
                insertTimeDate();
            }
        });

        applyWrap();
        load('readme.txt');
    },
    onOpen(args, app) {
        if ('file' in args) app.openFile(args.file);
    },
    beforeClose: app => app.confirmDiscard(),
    onClose(app) {
        app.discardEdits();
    },
});

// ---------------------------------------------------------------------------
// Display Properties — wallpaper and desktop colour.
// ---------------------------------------------------------------------------
WM.register('display', {
    title: 'Display Properties',
    icon: 'display',
    dialog: true,
    className: 'display-window',
    create(body, app) {
        let pending = Wallpaper.load();

        // The preview is a full-size copy of the desktop, scaled down, so
        // every wallpaper looks exactly as it will on the real screen.
        const previewDesktop = h('div', { class: 'preview-desktop' });
        const previewScreen = h('div', { class: 'preview-screen' }, previewDesktop);

        const list = h('div', { class: 'listbox sunken', role: 'listbox', tabindex: '0', 'aria-label': 'Wallpaper' });
        const displaySelect = h('select', { 'aria-label': 'Display' },
            h('option', { value: 'stretch' }, 'Stretch'),
            h('option', { value: 'center' }, 'Center'),
            h('option', { value: 'tile' }, 'Tile'));
        const colorSelect = h('select', { 'aria-label': 'Colour' },
            Wallpaper.COLORS.map(([name, value]) => h('option', { value }, name)));

        function refresh() {
            const desktopEl = document.getElementById('desktop');
            const w = desktopEl.clientWidth;
            const hgt = desktopEl.clientHeight;
            const scale = 152 / w;
            Object.assign(previewDesktop.style, Wallpaper.styleFor(pending), {
                width: `${w}px`,
                height: `${hgt}px`,
                transform: `scale(${scale})`,
            });
            previewScreen.style.height = `${Math.round(hgt * scale)}px`;
            list.querySelectorAll('.listbox-item').forEach(row => {
                const on = row.dataset.id === pending.wallpaper;
                row.classList.toggle('selected', on);
                row.setAttribute('aria-selected', on ? 'true' : 'false');
                if (on && row.offsetParent) {
                    const top = row.offsetTop - list.scrollTop;
                    if (top < 0 || top + row.offsetHeight > list.clientHeight) list.scrollTop = row.offsetTop - 2;
                }
            });
            const item = Wallpaper.ITEMS.find(i => i.id === pending.wallpaper);
            displaySelect.disabled = !(item && item.photo);
            displaySelect.value = pending.display;
            colorSelect.value = pending.color;
        }

        Wallpaper.ITEMS.forEach(item => {
            list.appendChild(h('div', {
                class: 'listbox-item',
                role: 'option',
                dataset: { id: item.id },
                onclick: () => {
                    pending = Object.assign({}, pending, { wallpaper: item.id });
                    refresh();
                },
            }, item.name));
        });

        list.addEventListener('keydown', e => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault();
            const ids = Wallpaper.ITEMS.map(i => i.id);
            const next = clamp(ids.indexOf(pending.wallpaper) + (e.key === 'ArrowDown' ? 1 : -1), 0, ids.length - 1);
            pending = Object.assign({}, pending, { wallpaper: ids[next] });
            refresh();
        });

        displaySelect.addEventListener('change', () => {
            pending = Object.assign({}, pending, { display: displaySelect.value });
            refresh();
        });
        colorSelect.addEventListener('change', () => {
            pending = Object.assign({}, pending, { color: colorSelect.value });
            refresh();
        });

        body.appendChild(h('menu', { role: 'tablist' },
            h('li', { role: 'tab', 'aria-selected': 'true' }, h('a', null, 'Background'))));
        body.appendChild(h('div', { class: 'window display-panel', role: 'tabpanel' },
            h('div', { class: 'window-body' },
                h('div', { class: 'monitor' }, previewScreen, h('div', { class: 'monitor-stand' })),
                h('div', { class: 'display-controls' },
                    h('div', { class: 'display-list' },
                        h('p', null, 'Wallpaper:'),
                        list),
                    h('div', { class: 'display-options' },
                        h('div', { class: 'field-stack' }, h('label', null, 'Display:'), displaySelect),
                        h('div', { class: 'field-stack' }, h('label', null, 'Colour:'), colorSelect),
                        h('p', { class: 'display-note' }, 'Saved in this browser only.'))))));

        body.appendChild(h('div', { class: 'dialog-buttons right' },
            h('button', { onclick: () => { Wallpaper.save(pending); app.close(); } }, 'OK'),
            h('button', { onclick: () => app.close() }, 'Cancel'),
            h('button', { onclick: () => Wallpaper.save(pending) }, 'Apply')));

        app.resetDisplay = () => {
            pending = Wallpaper.load();
            refresh();
        };
    },
    onOpen(args, app) {
        app.resetDisplay();
    },
});

// ---------------------------------------------------------------------------
// Run...
// ---------------------------------------------------------------------------
const RUN_COMMANDS = {
    notepad: () => launch('notepad'),
    'readme.txt': () => launch('notepad', { file: 'readme.txt' }),
    readme: () => launch('notepad', { file: 'readme.txt' }),
    winmine: () => launch('minesweeper'),
    minesweeper: () => launch('minesweeper'),
    sol: () => launch('solitaire'),
    solitaire: () => launch('solitaire'),
    command: () => launch('dos'),
    cmd: () => launch('dos'),
    dos: () => launch('dos'),
    iexplore: () => launch('ie'),
    ie: () => launch('ie'),
    explorer: () => launch('mycomputer'),
    'my computer': () => launch('mycomputer'),
    'my documents': () => launch('mydocuments'),
    recycled: () => launch('recyclebin'),
    'recycle bin': () => launch('recyclebin'),
    msimn: () => launch('mail'),
    outlook: () => launch('mail'),
    mail: () => launch('mail'),
    winword: () => launch('cv'),
    cv: () => launch('cv'),
    'cv.doc': () => launch('cv'),
    control: () => launch('display'),
    'control desk.cpl': () => launch('display'),
    'desk.cpl': () => launch('display'),
    display: () => launch('display'),
    shutdown: () => launch('shutdown'),
    clippy: () => showClippy('You rang?', 'Start → Help has a few tips.'),
    'about:home': () => launch('ie', { url: 'about:home' }),
};

// Returns true when the command did something.
function runCommand(raw) {
    const input = raw.trim();
    if (!input) return false;
    const lower = input.toLowerCase();
    const name = lower.replace(/\.exe$/, '');

    if (RUN_COMMANDS[name]) {
        RUN_COMMANDS[name]();
        return true;
    }
    // Anything the MS-DOS prompt understands (ping, tailmon) runs there.
    if (/^(ping|tailmon)\b/.test(name)) {
        launch('dos', { run: input });
        return true;
    }
    if (/^https?:\/\/\S+$/.test(lower) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/.test(lower)) {
        launch('ie', { url: input });
        return true;
    }
    return false;
}

WM.register('run', {
    title: 'Run',
    dialog: true,
    className: 'run-window',
    create(body, app) {
        const input = h('input', {
            type: 'text', list: 'run-suggestions', spellcheck: 'false', autocomplete: 'off',
            autocapitalize: 'off', 'aria-label': 'Open',
        });
        const suggestions = h('datalist', { id: 'run-suggestions' },
            ['ping barathans-5090', 'ping barathans-mini', 'winmine', 'sol', 'notepad', 'command', 'tailmon', 'iexplore', 'control desk.cpl']
                .map(value => h('option', { value })));

        const submit = () => {
            const value = input.value;
            if (!value.trim()) return;
            store.set('run.last', value);
            if (runCommand(value)) {
                app.close();
                return;
            }
            WM.messageBox({
                title: value.trim(),
                icon: 'error',
                text: `Cannot find the file '${value.trim()}' (or one of its components). ` +
                    'Make sure the path and filename are correct and that all required libraries are available.',
            });
        };

        body.appendChild(h('div', { class: 'run-intro' },
            h('img', { src: iconSrc('run', 32), alt: '', width: 32, height: 32 }),
            h('p', null, 'Type the name of a program, folder, document, or Internet resource, and Barathan 98 will open it for you.')));
        body.appendChild(h('form', {
            class: 'run-form',
            onsubmit: e => {
                e.preventDefault();
                submit();
            },
        },
            h('div', { class: 'run-row' }, h('label', null, h('u', null, 'O'), 'pen:'), input, suggestions),
            h('div', { class: 'dialog-buttons right' },
                h('button', { type: 'submit' }, 'OK'),
                h('button', { type: 'button', onclick: () => app.close() }, 'Cancel'),
                h('button', { type: 'button', onclick: () => { app.close(); launch('mydocuments'); } }, 'Browse...'))));
        app.input = input;
    },
    onOpen(args, app) {
        app.input.value = store.get('run.last', 'ping barathans-5090');
        setTimeout(() => {
            app.input.focus();
            app.input.select();
        }, 0);
    },
});

// ---------------------------------------------------------------------------
// Shut Down...
// ---------------------------------------------------------------------------
function powerScreen(className, content) {
    const screen = h('div', { class: 'power-screen ' + className }, content);
    document.body.appendChild(screen);
    return screen;
}

function bootAgain() {
    powerScreen('booting', h('p', null, 'Starting Barathan 98...'));
    setTimeout(() => window.location.reload(), 1200);
}

function shutDown(mode) {
    Menus.closeAll();
    if (mode === 'standby') {
        const screen = powerScreen('standby', null);
        const wake = () => {
            screen.remove();
            window.removeEventListener('keydown', wake);
        };
        screen.addEventListener('pointerdown', wake);
        window.addEventListener('keydown', wake);
        return;
    }
    if (mode === 'dos') {
        launch('dos', { fullscreen: true });
        return;
    }
    powerScreen('shutting-down', h('div', null,
        h('p', { class: 'shutting-down-title' }, h('b', null, 'Barathan'), '98'),
        h('p', null, 'Barathan 98 is shutting down...')));
    setTimeout(() => {
        if (mode === 'restart') {
            bootAgain();
            return;
        }
        const screen = powerScreen('safe-to-turn-off', h('div', null,
            h('p', null, "It's now safe to turn off"),
            h('p', null, 'your computer.'),
            h('p', { class: 'power-hint' }, 'Click anywhere to turn it back on.')));
        let booted = false;
        const boot = () => {
            if (booted) return;
            booted = true;
            bootAgain();
        };
        screen.addEventListener('pointerdown', boot);
        window.addEventListener('keydown', boot);
    }, 1600);
}

WM.register('shutdown', {
    title: 'Shut Down Barathan 98',
    dialog: true,
    className: 'shutdown-window',
    create(body, app) {
        const form = h('form', {
            onsubmit: e => {
                e.preventDefault();
                const mode = new FormData(form).get('shutdown-mode');
                app.close();
                shutDown(mode);
            },
        },
            h('div', { class: 'shutdown-content' },
                h('img', { src: iconSrc('shutdown', 32), alt: '', width: 32, height: 32 }),
                h('div', null,
                    h('p', null, 'What do you want the computer to do?'),
                    h('div', { class: 'field-row-stacked' },
                        radio('shutdown-mode', 'standby', 'Stand by'),
                        radio('shutdown-mode', 'shutdown', 'Shut down', true),
                        radio('shutdown-mode', 'restart', 'Restart'),
                        radio('shutdown-mode', 'dos', 'Restart in MS-DOS mode')))),
            h('div', { class: 'dialog-buttons right' },
                h('button', { type: 'submit' }, 'OK'),
                h('button', { type: 'button', onclick: () => app.close() }, 'Cancel'),
                h('button', {
                    type: 'button',
                    onclick: () => showClippy('Shutting down only turns off this page.', 'My real computers stay on. Promise.'),
                }, 'Help')));
        body.appendChild(form);
    },
});
