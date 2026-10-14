'use strict';

// ===========================================================================
// Barathan 98 — the desktop shell.
//
// This file holds everything the apps share: DOM and storage helpers, Clippy,
// popup menus, the window manager, desktop icons, the Start menu, the taskbar
// and the wallpaper. Apps live in apps/*.js and register themselves with
// WM.register(); the CV renderer and boot sequence are at the bottom.
// ===========================================================================

// ---------------------------------------------------------------------------
// Small-screen support. Below this width ordinary windows fill the usable
// viewport (style.css), so the JS stops writing pixel geometry for them.
// Keep the breakpoint in sync with style.css.
// ---------------------------------------------------------------------------
const TASKBAR_HEIGHT = 28;
const smallScreen = window.matchMedia('(max-width: 700px)');

function isSmallScreen() {
    return smallScreen.matches;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Per-visitor preferences. Storage can be missing or throw (private windows,
// blocked site data), so every access is guarded and has a fallback.
const store = {
    get(key, fallback) {
        try {
            const raw = window.localStorage.getItem('b98.' + key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch (e) {
            return fallback;
        }
    },
    set(key, value) {
        try {
            window.localStorage.setItem('b98.' + key, JSON.stringify(value));
        } catch (e) { /* preference simply isn't remembered */ }
    },
    remove(key) {
        try {
            window.localStorage.removeItem('b98.' + key);
        } catch (e) { /* nothing to do */ }
    },
};

// h('div', {class: 'x', onclick: fn}, child, 'text', [more]) — builds an
// element. Strings always become text nodes, never markup.
function h(tag, attrs, ...children) {
    const node = document.createElement(tag);
    if (attrs) {
        Object.entries(attrs).forEach(([key, value]) => {
            if (value === null || value === undefined || value === false) return;
            if (key === 'class') node.className = value;
            else if (key === 'text') node.textContent = value;
            else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
            else if (key === 'dataset') Object.assign(node.dataset, value);
            else if (key.startsWith('on') && typeof value === 'function') {
                node.addEventListener(key.slice(2), value);
            } else if (value === true) node.setAttribute(key, '');
            else node.setAttribute(key, value);
        });
    }
    appendChildren(node, children);
    return node;
}

function appendChildren(node, children) {
    children.flat(Infinity).forEach(child => {
        if (child === null || child === undefined || child === false) return;
        node.appendChild(typeof child === 'string' || typeof child === 'number'
            ? document.createTextNode(String(child))
            : child);
    });
}

function iconSrc(name, size) {
    return `assets/icons/${name}-${size || 32}.png`;
}

// Off-site links always leave in a new tab and never get a window.opener.
function openLink(url) {
    const win = window.open(url, '_blank', 'noopener');
    if (win) win.opener = null;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Clippy
// ---------------------------------------------------------------------------
const clippyPopup = document.getElementById('clippy-popup');
const clippyBubble = clippyPopup.querySelector('.clippy-bubble');
let clippyTimeout;
let clippyFadeTimeout;

// showClippy('Main line', 'optional small print')
function showClippy(message, smallPrint) {
    clearTimeout(clippyTimeout);
    clearTimeout(clippyFadeTimeout);
    clippyBubble.textContent = '';
    clippyBubble.appendChild(h('p', null, message));
    if (smallPrint) clippyBubble.appendChild(h('p', { class: 'clippy-small' }, smallPrint));

    clippyPopup.classList.remove('fade-out');
    clippyPopup.classList.add('show');

    const words = (message + ' ' + (smallPrint || '')).split(/\s+/).length;
    clippyTimeout = setTimeout(hideClippy, clamp(words * 330, 3000, 9000));
}

function hideClippy() {
    if (clippyTimeout) clearTimeout(clippyTimeout);
    clippyPopup.classList.add('fade-out');
    clippyFadeTimeout = setTimeout(() => clippyPopup.classList.remove('show', 'fade-out'), 300);
}

clippyPopup.addEventListener('click', hideClippy);

// ---------------------------------------------------------------------------
// Popup menus — the Start menu, menu bars and the desktop's context menu.
//
// An item is {label, icon, action, submenu, disabled, checked, radio,
// shortcut} or {separator: true}. `submenu`, `disabled` and `checked` may be
// functions, evaluated each time the menu opens.
// ---------------------------------------------------------------------------
const Menus = (() => {
    let popups = [];      // open popups, index = depth
    let owner = null;     // element that opened the root menu
    let onCloseRoot = null;

    const resolve = value => (typeof value === 'function' ? value() : value);

    function build(items, depth, options) {
        const popup = h('div', { class: 'menu-popup ' + (options.className || ''), role: 'menu' });
        const list = resolve(items).filter(Boolean);
        const hasChecks = list.some(item => 'checked' in item);
        const size = options.iconSize || 16;

        list.forEach(item => {
            if (item.separator) {
                popup.appendChild(h('div', { class: 'menu-separator', role: 'separator' }));
                return;
            }
            const disabled = resolve(item.disabled);
            const checked = resolve(item.checked);
            const row = h('div', {
                class: 'menu-item' + (disabled ? ' disabled' : '') + (item.submenu ? ' has-submenu' : ''),
                role: 'menuitem',
                tabindex: '-1',
                'aria-disabled': disabled ? 'true' : null,
            },
                hasChecks ? h('span', { class: 'menu-check' }, checked ? (item.radio ? '●' : '✓') : '') : null,
                item.icon ? h('img', { class: 'menu-icon', src: iconSrc(item.icon, size), alt: '', width: size, height: size })
                    : (options.iconColumn ? h('span', { class: 'menu-icon', style: { width: size + 'px' } }) : null),
                h('span', { class: 'menu-label' }, item.label),
                item.shortcut ? h('span', { class: 'menu-shortcut' }, item.shortcut) : null,
                item.submenu ? h('span', { class: 'menu-arrow' }) : null);

            row.addEventListener('pointerenter', e => {
                if (e.pointerType === 'mouse') hover(row, item, depth, options);
            });
            row.addEventListener('click', e => {
                e.stopPropagation();
                activate(row, item, depth, options);
            });
            popup.appendChild(row);
        });

        if (options.banner) popup.prepend(options.banner);
        return popup;
    }

    function hover(row, item, depth, options) {
        closeFrom(depth + 1);
        markOpen(row);
        if (item.submenu && !resolve(item.disabled)) openSubmenu(row, item, depth, options);
    }

    function activate(row, item, depth, options) {
        if (resolve(item.disabled)) return;
        if (item.submenu) {
            if (popups[depth + 1] && row.classList.contains('open')) {
                closeFrom(depth + 1);
                row.classList.remove('open');
            } else {
                hover(row, item, depth, options);
            }
            return;
        }
        closeAll();
        if (item.action) item.action();
    }

    function markOpen(row) {
        row.parentNode.querySelectorAll('.menu-item.open').forEach(r => r.classList.remove('open'));
        row.classList.add('open');
    }

    function openSubmenu(row, item, depth, options) {
        const popup = build(item.submenu, depth + 1, { iconSize: 16, iconColumn: true });
        document.body.appendChild(popup);
        popups[depth + 1] = popup;
        const r = row.getBoundingClientRect();
        place(popup, r.right - 3, r.top - 3, r.left + 3);
    }

    // Puts a popup at (x, y), flipping to the left of `flipX` or pulling it
    // back inside the viewport when it would hang off an edge.
    function place(popup, x, y, flipX) {
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        const w = popup.offsetWidth;
        const hgt = popup.offsetHeight;
        if (x + w > vw) x = flipX !== undefined ? flipX - w : vw - w;
        if (x < 0) x = Math.max(0, vw - w);
        if (y + hgt > vh) y = vh - hgt;
        popup.style.left = `${Math.max(0, x)}px`;
        popup.style.top = `${Math.max(0, y)}px`;
    }

    function closeFrom(depth) {
        for (let i = popups.length - 1; i >= depth; i--) {
            if (popups[i]) popups[i].remove();
        }
        popups.length = Math.min(popups.length, depth);
        if (depth > 0 && popups[depth - 1]) {
            popups[depth - 1].querySelectorAll('.menu-item.open').forEach(r => r.classList.remove('open'));
        }
    }

    function closeAll() {
        closeFrom(0);
        const callback = onCloseRoot;
        owner = null;
        onCloseRoot = null;
        if (callback) callback();
    }

    // open(items, {x, y} | {anchor, above}, {owner, onClose, className, banner, iconSize})
    function open(items, options) {
        closeAll();
        const popup = build(items, 0, Object.assign({ iconColumn: true }, options));
        document.body.appendChild(popup);
        popups[0] = popup;
        owner = options.owner || null;
        onCloseRoot = options.onClose || null;

        if (options.anchor) {
            const r = options.anchor.getBoundingClientRect();
            if (options.above) {
                place(popup, r.left, r.top - popup.offsetHeight);
            } else {
                place(popup, r.left, r.bottom);
            }
        } else {
            place(popup, options.x, options.y);
        }
        const first = popup.querySelector('.menu-item');
        if (first && options.focusFirst) first.focus();
        return popup;
    }

    // A pointer press anywhere outside the open menus (and outside the
    // element that owns them, which toggles itself) closes everything.
    document.addEventListener('pointerdown', e => {
        if (!popups.length) return;
        if (e.target.closest('.menu-popup')) return;
        if (owner && owner.contains(e.target)) return;
        closeAll();
    }, true);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && popups.length) closeAll();
    });

    window.addEventListener('resize', () => { if (popups.length) closeAll(); });

    return {
        open,
        closeAll,
        isOpen: () => popups.length > 0,
        ownedBy: el => popups.length > 0 && owner === el,
        owner: () => owner,
    };
})();

// A Win98 menu bar: [{label, items}] where items is a list or a function.
function menubar(definitions) {
    const bar = h('div', { class: 'menubar', role: 'menubar' });

    function openFor(button, def) {
        button.classList.add('open');
        Menus.open(def.items, {
            anchor: button,
            owner: button,
            iconColumn: false,
            onClose: () => button.classList.remove('open'),
        });
    }

    definitions.forEach(def => {
        const button = h('div', { class: 'menubar-item', role: 'menuitem', tabindex: '0' }, def.label);
        button.addEventListener('pointerdown', e => {
            e.preventDefault();
            if (Menus.ownedBy(button)) Menus.closeAll();
            else openFor(button, def);
        });
        button.addEventListener('pointerenter', () => {
            const current = Menus.owner();
            if (current && current !== button && current.parentNode === bar) openFor(button, def);
        });
        button.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                openFor(button, def);
            }
        });
        bar.appendChild(button);
    });
    return bar;
}

// ---------------------------------------------------------------------------
// Window manager
//
// WM.register(id, options) declares an app; WM.open(id, args) shows it,
// building its window on first use. Options:
//   title, icon            title-bar text and icon name (assets/icons)
//   element                adopt existing markup instead of building it
//   className              extra classes for the window
//   width, height          initial size in px (desktop only)
//   dialog                 fixed size, close button only, no taskbar button
//   fixedSize              not resizable; sized by its content
//   maximizable, minimizable, resizable, taskbar   default true
//   create(body, app)      fills the window body, called once
//   onOpen(args, app)      called on every open, including re-opens
//   beforeClose(app)       may return false, or a Promise of a boolean, to
//                          keep the window open
//   onClose(app)           called when the window closes
//   onResize(app)          called after a resize or (un)maximise
//   destroyOnClose         remove the window from the DOM when closed
// ---------------------------------------------------------------------------
const WM = (() => {
    const desktop = document.getElementById('desktop');
    const taskbar = desktop.querySelector('.taskbar');
    const tasks = document.getElementById('taskbar-tasks');
    const apps = new Map();
    let topZ = 11;
    let active = null;
    let dialogCount = 0;

    function register(id, options) {
        const app = {
            id,
            options,
            el: null,
            body: null,
            task: null,
            state: 'closed',
            placed: false,
            setTitle: text => setTitle(app, text),
            close: force => close(app.id, force),
            focus: () => focus(app),
            minimize: () => minimize(app.id),
            isActive: () => active === app,
        };
        apps.set(id, app);
        return app;
    }

    function setTitle(app, text) {
        app.title = text;
        if (app.el) app.el.querySelector('.title-text').textContent = text;
        if (app.task) {
            app.task.querySelector('.task-label').textContent = text;
            app.task.title = text;
        }
    }

    function build(app) {
        const o = app.options;
        const dialog = !!o.dialog;
        const fixedSize = dialog || !!o.fixedSize;
        let win = o.element;

        if (!win) {
            win = h('div', { class: 'window app-window wm-hidden ' + (o.className || '') },
                h('div', { class: 'title-bar' },
                    h('div', { class: 'title-bar-text' }),
                    h('div', { class: 'title-bar-controls' },
                        dialog || o.minimizable === false ? null : h('button', { 'aria-label': 'Minimize' }),
                        dialog || o.maximizable === false || fixedSize ? null : h('button', { 'aria-label': 'Maximize' }),
                        h('button', { 'aria-label': 'Close' }))),
                h('div', { class: 'window-body' }));
            desktop.insertBefore(win, taskbar);
        }
        if (dialog) win.classList.add('dialog');
        if (fixedSize) win.classList.add('fixed-size');
        win.dataset.app = app.id;

        // Title: [icon] text. Adopted markup supplies its own text.
        const titleText = win.querySelector('.title-bar-text');
        const title = o.title || titleText.textContent.trim();
        titleText.textContent = '';
        const iconName = o.icon || win.dataset.icon;
        if (iconName && !dialog) {
            titleText.appendChild(h('img', { class: 'title-icon', src: iconSrc(iconName, 16), alt: '', width: 16, height: 16 }));
        }
        titleText.appendChild(h('span', { class: 'title-text' }, title));
        app.title = title;
        app.el = win;
        app.body = win.querySelector('.window-body');

        // Controls are matched by their accessible name.
        win.querySelectorAll('.title-bar-controls button').forEach(button => {
            const label = button.getAttribute('aria-label');
            button.addEventListener('click', e => {
                e.stopPropagation();
                if (label === 'Minimize') minimize(app.id);
                else if (label === 'Maximize') toggleMaximize(app.id);
                else if (label === 'Close') close(app.id);
            });
        });

        const titleBar = win.querySelector('.title-bar');
        makeDraggable(titleBar, win);
        if (!fixedSize && o.maximizable !== false) {
            titleBar.addEventListener('dblclick', e => {
                if (!e.target.closest('button')) toggleMaximize(app.id);
            });
        }

        if (!fixedSize && o.resizable !== false) addResizers(win);

        win.addEventListener('pointerdown', () => focus(app), true);

        if (o.create) o.create(app.body, app);
    }

    function addResizers(win) {
        ['l', 'r', 'b', 'br'].forEach(edge => {
            const handle = h('div', { class: 'resizer-' + edge });
            win.appendChild(handle);
            makeResizable(handle, win, edge);
        });
    }

    function open(id, args) {
        const app = apps.get(id);
        if (!app) return null;
        Menus.closeAll();
        if (!app.el) build(app);
        const wasClosed = app.state === 'closed';
        app.state = 'open';
        app.el.classList.remove('wm-hidden');

        if (app.options.taskbar !== false && !app.options.dialog && !app.task) addTask(app);
        if (wasClosed || !app.placed) place(app);
        focus(app);
        if (app.options.onOpen) app.options.onOpen(args || {}, app);
        return app;
    }

    // First placement: centred in the desktop, cascaded past any window that
    // already sits there. Later opens keep wherever the visitor left it.
    function place(app) {
        const win = app.el;
        const fillsScreen = isSmallScreen() && !win.classList.contains('fixed-size');
        if (fillsScreen) {
            clearGeometry(win);
            app.placed = true;
            return;
        }
        if (app.placed) {
            clampIntoView(win);
            return;
        }
        const o = app.options;
        if (o.width) win.style.width = `${o.width}px`;
        if (o.height) win.style.height = `${o.height}px`;

        const areaW = desktop.clientWidth;
        const areaH = desktop.clientHeight - TASKBAR_HEIGHT;
        if (win.offsetHeight > areaH) win.style.height = `${areaH}px`;

        let left = Math.max(0, (areaW - win.offsetWidth) / 2);
        let top = Math.max(0, (areaH - win.offsetHeight) / 2);
        const taken = [...apps.values()].filter(other => other !== app && other.state === 'open' && other.el);
        for (let step = 0; step < 8; step++) {
            const clash = taken.some(other =>
                Math.abs(other.el.offsetLeft - left) < 40 && Math.abs(other.el.offsetTop - top) < 40);
            if (!clash) break;
            left += 30;
            top += 30;
        }
        win.style.left = `${Math.round(left)}px`;
        win.style.top = `${Math.round(top)}px`;
        clampIntoView(win);
        app.placed = true;
    }

    function clearGeometry(win) {
        win.style.width = '';
        win.style.height = '';
        win.style.left = '';
        win.style.top = '';
    }

    // beforeClose may veto (return false) or ask first (return a Promise).
    function close(id, force) {
        const app = apps.get(id);
        if (!app || app.state === 'closed') return;
        if (!force && app.options.beforeClose) {
            Promise.resolve(app.options.beforeClose(app)).then(ok => {
                if (ok) close(id, true);
            });
            return;
        }
        app.state = 'closed';
        app.el.classList.add('wm-hidden');
        app.el.classList.remove('maximized');
        removeTask(app);
        if (app.options.onClose) app.options.onClose(app);
        if (app.options.destroyOnClose) {
            app.el.remove();
            apps.delete(id);
        }
        if (active === app) {
            active = null;
            focusTopmost();
        }
    }

    function minimize(id) {
        const app = apps.get(id);
        if (!app || app.state !== 'open') return;
        app.state = 'minimized';
        app.el.classList.add('wm-hidden');
        if (app.task) app.task.classList.remove('active');
        if (active === app) {
            active = null;
            focusTopmost();
        }
    }

    function restore(app) {
        app.state = 'open';
        app.el.classList.remove('wm-hidden');
        if (!app.placed) place(app);
        focus(app);
    }

    function toggleMaximize(id) {
        const app = apps.get(id);
        if (!app || app.el.classList.contains('fixed-size')) return;
        app.el.classList.toggle('maximized');
        if (app.options.onResize) app.options.onResize(app);
    }

    function focus(app) {
        if (!app.el || app.state !== 'open') return;
        // Already in front: nothing to do (and no z-index to burn).
        if (active === app && Number(app.el.style.zIndex) === topZ) return;
        // Keep window z-indexes well below the taskbar (9999) and menus.
        if (topZ > 5000) renumber();
        if (active && active !== app && active.el) {
            active.el.querySelector('.title-bar').classList.add('inactive');
            if (active.task) active.task.classList.remove('active');
        }
        active = app;
        topZ += 1;
        app.el.style.zIndex = topZ;
        app.el.querySelector('.title-bar').classList.remove('inactive');
        if (app.task) app.task.classList.add('active');
        if (app.options.onFocus) app.options.onFocus(app);
    }

    function renumber() {
        const open = [...apps.values()].filter(a => a.el)
            .sort((a, b) => Number(a.el.style.zIndex) - Number(b.el.style.zIndex));
        topZ = 11;
        open.forEach(a => { a.el.style.zIndex = ++topZ; });
    }

    function focusTopmost() {
        let best = null;
        apps.forEach(app => {
            if (app.state !== 'open' || !app.el) return;
            if (!best || Number(app.el.style.zIndex) > Number(best.el.style.zIndex)) best = app;
        });
        if (best) focus(best);
    }

    function addTask(app) {
        const label = h('span', { class: 'task-label' }, app.title);
        const icon = app.options.icon || app.el.dataset.icon;
        app.task = h('div', { class: 'task-button', role: 'button', tabindex: '0', title: app.title },
            icon ? h('img', { src: iconSrc(icon, 16), alt: '', width: 16, height: 16 }) : null,
            label);
        const toggle = () => {
            if (app.state === 'minimized') restore(app);
            else if (active === app) minimize(app.id);
            else focus(app);
        };
        app.task.addEventListener('click', toggle);
        app.task.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });
        tasks.appendChild(app.task);
    }

    function removeTask(app) {
        if (app.task) app.task.remove();
        app.task = null;
    }

    // Dragging by the title bar, for mouse, pen and touch alike.
    function makeDraggable(handle, win) {
        handle.addEventListener('pointerdown', e => {
            if (e.button !== 0 || e.target.closest('button')) return;
            if (win.classList.contains('maximized')) return;
            if (isSmallScreen() && !win.classList.contains('fixed-size')) return;
            const startX = e.clientX;
            const startY = e.clientY;
            const startLeft = win.offsetLeft;
            const startTop = win.offsetTop;
            handle.setPointerCapture(e.pointerId);

            const onMove = ev => {
                const areaW = desktop.clientWidth;
                const areaH = desktop.clientHeight - TASKBAR_HEIGHT;
                // Keep the title bar reachable: never above the desktop, and
                // never so far out that less than 60px of it remains.
                const left = clamp(startLeft + ev.clientX - startX, 60 - win.offsetWidth, areaW - 60);
                const top = clamp(startTop + ev.clientY - startY, 0, areaH - 20);
                win.style.left = `${left}px`;
                win.style.top = `${top}px`;
            };
            const onUp = () => {
                handle.removeEventListener('pointermove', onMove);
                handle.removeEventListener('pointerup', onUp);
                handle.removeEventListener('pointercancel', onUp);
            };
            handle.addEventListener('pointermove', onMove);
            handle.addEventListener('pointerup', onUp);
            handle.addEventListener('pointercancel', onUp);
        });
    }

    const MIN_WIDTH = 240;
    const MIN_HEIGHT = 160;

    function makeResizable(handle, win, edge) {
        handle.addEventListener('pointerdown', e => {
            if (e.button !== 0 || win.classList.contains('maximized')) return;
            e.preventDefault();
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const startW = win.offsetWidth;
            const startH = win.offsetHeight;
            const startLeft = win.offsetLeft;
            handle.setPointerCapture(e.pointerId);
            const app = apps.get(win.dataset.app);

            const onMove = ev => {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                if (edge === 'r' || edge === 'br') win.style.width = `${Math.max(startW + dx, MIN_WIDTH)}px`;
                if (edge === 'b' || edge === 'br') win.style.height = `${Math.max(startH + dy, MIN_HEIGHT)}px`;
                if (edge === 'l') {
                    const width = Math.max(startW - dx, MIN_WIDTH);
                    win.style.width = `${width}px`;
                    win.style.left = `${startLeft + startW - width}px`;
                }
                win.style.maxWidth = 'none';
                if (app && app.options.onResize) app.options.onResize(app);
            };
            const onUp = () => {
                handle.removeEventListener('pointermove', onMove);
                handle.removeEventListener('pointerup', onUp);
                handle.removeEventListener('pointercancel', onUp);
            };
            handle.addEventListener('pointermove', onMove);
            handle.addEventListener('pointerup', onUp);
            handle.addEventListener('pointercancel', onUp);
        });
    }

    // Pulls a window back on-screen if it hangs off an edge. Measures against
    // clientWidth, not innerWidth: on touch devices the layout viewport grows
    // to cover overflowing content, so innerWidth would always say "fits".
    function clampIntoView(win) {
        if (isSmallScreen() && !win.classList.contains('fixed-size')) return;
        const maxRight = desktop.clientWidth;
        const maxBottom = desktop.clientHeight - TASKBAR_HEIGHT;
        const left = Math.max(0, Math.min(win.offsetLeft, maxRight - win.offsetWidth));
        const top = Math.max(0, Math.min(win.offsetTop, maxBottom - win.offsetHeight));
        if (left !== win.offsetLeft) win.style.left = `${left}px`;
        if (top !== win.offsetTop) win.style.top = `${top}px`;
    }

    // A Win98 message box. Resolves with the label of the button pressed
    // (or null when closed with the X).
    function messageBox({ title, text, icon = 'info', buttons = ['OK'] }) {
        return new Promise(resolve => {
            const id = 'msgbox-' + (++dialogCount);
            let answer = null;
            register(id, {
                title: title || 'Barathan 98',
                dialog: true,
                destroyOnClose: true,
                className: 'message-box',
                create(body, app) {
                    const lines = Array.isArray(text) ? text : [text];
                    body.appendChild(h('div', { class: 'message-box-content' },
                        icon ? h('img', { src: iconSrc('msg-' + icon, 32), alt: '', width: 32, height: 32 }) : null,
                        h('div', { class: 'message-box-text' }, lines.map(line => h('p', null, line)))));
                    const row = h('div', { class: 'dialog-buttons' });
                    buttons.forEach(label => {
                        row.appendChild(h('button', {
                            onclick: () => {
                                answer = label;
                                app.close();
                            },
                        }, label));
                    });
                    body.appendChild(row);
                },
                onOpen(args, app) {
                    const first = app.el.querySelector('.dialog-buttons button');
                    if (first) first.focus();
                },
                onClose: () => resolve(answer),
            });
            open(id);
        });
    }

    // Re-fit windows when the viewport crosses the small-screen breakpoint
    // (rotation, or a desktop browser being resized).
    function handleScreenChange() {
        apps.forEach(app => {
            if (!app.el) return;
            app.el.classList.remove('maximized');
            if (app.el.classList.contains('fixed-size')) {
                if (app.options.onResize) app.options.onResize(app);
                clampIntoView(app.el);
                return;
            }
            clearGeometry(app.el);
            app.placed = false;
            if (app.state === 'open') place(app);
            if (app.options.onResize) app.options.onResize(app);
        });
    }

    if (typeof smallScreen.addEventListener === 'function') {
        smallScreen.addEventListener('change', handleScreenChange);
    }
    window.addEventListener('resize', () => {
        apps.forEach(app => {
            if (app.el && app.state === 'open') clampIntoView(app.el);
        });
    });

    return {
        register,
        open,
        close,
        minimize,
        toggleMaximize,
        messageBox,
        // Re-fit a window whose content changed size (a game changing level).
        refit(id) {
            const app = apps.get(id);
            if (!app || !app.el || app.state === 'closed') return;
            if (isSmallScreen()) {
                app.el.style.left = `${Math.max(0, (desktop.clientWidth - app.el.offsetWidth) / 2)}px`;
                app.el.style.top = `${Math.max(0, (desktop.clientHeight - TASKBAR_HEIGHT - app.el.offsetHeight) / 2)}px`;
            }
            clampIntoView(app.el);
        },
        get: id => apps.get(id),
        isOpen: id => apps.has(id) && apps.get(id).state !== 'closed',
        has: id => apps.has(id),
    };
})();

// Opens an app by id, or explains politely when it does not exist.
function launch(id, args) {
    if (WM.has(id)) return WM.open(id, args);
    showClippy("That program isn't installed on this computer.");
    return null;
}

// ---------------------------------------------------------------------------
// Icons — the desktop's and those inside folder windows.
//
// Mouse: a click selects, a double-click opens. Touch: a single tap opens
// (double-tap means zoom on iOS). Keyboard: Enter or Space opens.
// ---------------------------------------------------------------------------
const TAP_SLOP = 10; // px of finger travel still counted as a tap, not a drag

function wireIcon(el, onActivate, onSelect) {
    let startX = 0;
    let startY = 0;
    let moved = false;

    const select = () => {
        const group = el.parentNode;
        group.querySelectorAll('.selected').forEach(other => {
            if (other !== el) other.classList.remove('selected');
        });
        el.classList.add('selected');
        if (onSelect) onSelect();
    };

    el.addEventListener('click', select);
    el.addEventListener('focus', select);
    el.addEventListener('dblclick', e => onActivate(e));

    el.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) {
            moved = true;
            return;
        }
        moved = false;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    el.addEventListener('touchmove', e => {
        const touch = e.touches[0];
        if (!touch) return;
        if (Math.abs(touch.clientX - startX) > TAP_SLOP || Math.abs(touch.clientY - startY) > TAP_SLOP) {
            moved = true;
        }
    }, { passive: true });

    el.addEventListener('touchend', e => {
        if (moved) return;
        // Swallow the synthesised click/dblclick so the icon opens exactly once.
        e.preventDefault();
        select();
        onActivate(e);
    }, { passive: false });

    el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            onActivate(e);
        }
    });
}

// What a desktop icon does, read from its data attributes.
function activateIconData(el) {
    if (el.dataset.href) {
        openLink(el.dataset.href);
        return;
    }
    if (el.dataset.open) launch(el.dataset.open, el.dataset.file ? { file: el.dataset.file } : undefined);
}

document.querySelectorAll('#desktop-icons .desktop-icon').forEach(icon => {
    wireIcon(icon, () => activateIconData(icon));
});

// A press on the bare desktop clears the selection.
document.getElementById('desktop').addEventListener('pointerdown', e => {
    if (e.target.id === 'desktop' || e.target.id === 'desktop-icons') {
        document.querySelectorAll('#desktop-icons .selected').forEach(icon => icon.classList.remove('selected'));
    }
});

// Right-click on the bare desktop.
document.getElementById('desktop').addEventListener('contextmenu', e => {
    if (e.target.id !== 'desktop' && e.target.id !== 'desktop-icons') return;
    e.preventDefault();
    Menus.open([
        {
            label: 'Arrange Icons', submenu: [
                { label: 'by Name', action: () => arrangeIcons('name') },
                { label: 'by Type', action: () => arrangeIcons('type') },
            ],
        },
        { label: 'Line up Icons', action: () => arrangeIcons() },
        { separator: true },
        { label: 'Refresh', action: refreshDesktop },
        { separator: true },
        { label: 'New', submenu: [{ label: 'Text Document', icon: 'text-file', action: () => launch('notepad') }] },
        { separator: true },
        { label: 'Properties', action: () => launch('display') },
    ], { x: e.clientX, y: e.clientY, iconColumn: false });
});

function arrangeIcons(by) {
    const container = document.getElementById('desktop-icons');
    const icons = [...container.children];
    if (by) {
        const key = icon => (by === 'type'
            ? (icon.dataset.href ? '2' : icon.dataset.file ? '1' : '0') + icon.textContent.trim()
            : icon.textContent.trim()).toLowerCase();
        icons.sort((a, b) => key(a).localeCompare(key(b)));
    }
    icons.forEach(icon => container.appendChild(icon));
}

function refreshDesktop() {
    const container = document.getElementById('desktop-icons');
    container.style.visibility = 'hidden';
    setTimeout(() => { container.style.visibility = ''; }, 120);
}

// ---------------------------------------------------------------------------
// Start menu
// ---------------------------------------------------------------------------
const startButton = document.getElementById('start-button');

function startMenuItems() {
    return [
        {
            label: 'Programs', icon: 'programs', submenu: [
                {
                    label: 'Accessories', icon: 'folder', submenu: [
                        { label: 'MS-DOS Prompt', icon: 'dos', action: () => launch('dos') },
                        { label: 'Notepad', icon: 'notepad', action: () => launch('notepad') },
                    ],
                },
                {
                    label: 'Games', icon: 'games', submenu: [
                        { label: 'Minesweeper', icon: 'minesweeper', action: () => launch('minesweeper') },
                        { label: 'Solitaire', icon: 'solitaire', action: () => launch('solitaire') },
                    ],
                },
                { label: 'Internet Explorer', icon: 'ie', action: () => launch('ie') },
                { label: 'Outlook Express', icon: 'mail', action: () => launch('mail') },
            ],
        },
        {
            label: 'Documents', icon: 'my-documents', submenu: [
                { label: 'CV - Barathan Aslan.doc', icon: 'document', action: () => launch('cv') },
                { label: 'Craving Sugar', icon: 'internet', action: () => openLink('https://presser.ink/@barathan/craving-sugar') },
                { separator: true },
                { label: 'My Documents', icon: 'my-documents', action: () => launch('mydocuments') },
            ],
        },
        {
            label: 'Settings', icon: 'settings', submenu: [
                { label: 'Display...', icon: 'display', action: () => launch('display') },
            ],
        },
        { label: 'Help', icon: 'help', action: showHelpTip },
        { label: 'Run...', icon: 'run', action: () => launch('run') },
        { separator: true },
        { label: 'Shut Down...', icon: 'shutdown', action: () => launch('shutdown') },
    ];
}

function toggleStartMenu() {
    if (Menus.ownedBy(startButton)) {
        Menus.closeAll();
        return;
    }
    startButton.classList.add('active');
    startButton.setAttribute('aria-expanded', 'true');
    const banner = h('div', { class: 'start-banner', 'aria-hidden': 'true' },
        h('span', null, h('b', null, 'Barathan'), '98'));
    Menus.open(startMenuItems, {
        anchor: startButton,
        above: true,
        owner: startButton,
        className: 'start-menu',
        banner,
        iconSize: 32,
        onClose: () => {
            startButton.classList.remove('active');
            startButton.setAttribute('aria-expanded', 'false');
        },
    });
}

startButton.addEventListener('click', toggleStartMenu);

const HELP_TIPS = [
    ['My Computer shows which machines are awake.'],
    ['Start → Run: try "ping barathans-5090", "winmine" or "sol".'],
    ['Right-click the desktop → Properties to change the wallpaper.'],
    ['Minesweeper: the first click is always safe.', 'On a touch screen, press and hold to flag.'],
    ['Solitaire: click a card to move it to the best place it can go.'],
];
let helpTipIndex = 0;

function showHelpTip() {
    const [message, smallPrint] = HELP_TIPS[helpTipIndex % HELP_TIPS.length];
    helpTipIndex += 1;
    showClippy(message, smallPrint);
}

// ---------------------------------------------------------------------------
// Taskbar clock
// ---------------------------------------------------------------------------
const clockEl = document.getElementById('taskbar-time');

function updateTime() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    clockEl.textContent = `${hours}:${minutes} ${ampm}`;
    clockEl.title = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
setInterval(updateTime, 15000);
updateTime();

// ---------------------------------------------------------------------------
// Wallpaper. Settings are {color, wallpaper, display} and live in the
// visitor's browser only. The Display Properties dialog is in apps/system.js.
// ---------------------------------------------------------------------------
const Wallpaper = (() => {
    const COLORS = [
        ['Teal', '#008080'], ['Navy', '#000080'], ['Slate', '#3a6ea5'], ['Black', '#000000'],
        ['Gray', '#808080'], ['Olive', '#808000'], ['Green', '#008000'], ['Purple', '#800080'],
        ['Maroon', '#800000'],
    ];

    // 8x8 one-bit patterns, drawn in a translucent black over the colour.
    // Original designs in the spirit of the Win98 pattern editor.
    const PATTERNS = {
        bricks: ['########', '#.......', '#.......', '#.......', '########', '....#...', '....#...', '....#...'],
        checks: ['#.#.#.#.', '.#.#.#.#', '#.#.#.#.', '.#.#.#.#', '#.#.#.#.', '.#.#.#.#', '#.#.#.#.', '.#.#.#.#'],
        diamonds: ['...#....', '..#.#...', '.#...#..', '#.....#.', '.#...#..', '..#.#...', '...#....', '........'],
        zigzag: ['#......#', '.#....#.', '..#..#..', '...##...', '........', '........', '........', '........'],
        grid: ['########', '#.......', '#.......', '#.......', '#.......', '#.......', '#.......', '#.......'],
        dots: ['#.......', '........', '........', '........', '....#...', '........', '........', '........'],
        weave: ['###.#...', '##...#..', '#.....#.', '.#...###', '..#.###.', '...###..', '..#.#...', '.#...#..'],
    };

    function patternImage(rows) {
        let path = '';
        rows.forEach((row, y) => {
            [...row].forEach((pixel, x) => {
                if (pixel === '#') path += `M${x} ${y}h1v1h-1z`;
            });
        });
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" shape-rendering="crispEdges">` +
            `<path d="${path}" fill="rgba(0,0,0,0.42)"/></svg>`;
        return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    }

    // Photos added later go here: {id, name, src}. src is relative to the site.
    const PHOTOS = [];

    const ITEMS = [
        { id: 'none', name: '(None)' },
        { id: 'bricks', name: 'Bricks', pattern: 'bricks' },
        { id: 'checks', name: 'Checks', pattern: 'checks' },
        { id: 'diamonds', name: 'Diamonds', pattern: 'diamonds' },
        { id: 'dots', name: 'Dots', pattern: 'dots' },
        { id: 'grid', name: 'Grid', pattern: 'grid' },
        { id: 'weave', name: 'Weave', pattern: 'weave' },
        { id: 'zigzag', name: 'Zigzag', pattern: 'zigzag' },
        {
            id: 'sunset', name: 'Sunset', picture: true,
            css: 'radial-gradient(circle at 50% 68%, #ffd76a 0, #ffb347 9vmin, rgba(255,120,80,0) 9.3vmin),' +
                'repeating-linear-gradient(0deg, rgba(40,0,60,0.35) 0 2px, rgba(0,0,0,0) 2px 7px),' +
                'linear-gradient(#1b0638 0%, #5b1a63 42%, #d9485f 66%, #f7a541 82%, #2a0b3d 82.2%, #12031f 100%)',
        },
        {
            id: 'starfield', name: 'Starfield', picture: true,
            css: 'radial-gradient(circle at 20px 30px, #fff 0 1.2px, rgba(0,0,0,0) 1.8px),' +
                'radial-gradient(circle at 90px 120px, #cfe3ff 0 1px, rgba(0,0,0,0) 1.6px),' +
                'radial-gradient(circle at 160px 60px, #fff 0 0.8px, rgba(0,0,0,0) 1.4px),' +
                'radial-gradient(circle at 130px 170px, #ffe9b0 0 1.6px, rgba(0,0,0,0) 2.4px),' +
                'radial-gradient(circle at 50px 160px, #fff 0 0.8px, rgba(0,0,0,0) 1.4px),' +
                'radial-gradient(circle at 70px 80px, #b8c8ff 0 0.8px, rgba(0,0,0,0) 1.4px),' +
                'radial-gradient(ellipse at 70% 30%, rgba(80,60,160,0.35), rgba(0,0,0,0) 55%),' +
                'linear-gradient(#000010, #0b0b30)',
            size: '200px 200px, 170px 170px, 230px 230px, 290px 290px, 140px 140px, 110px 110px, 100% 100%, 100% 100%',
        },
        {
            id: 'blueprint', name: 'Blueprint', picture: true,
            css: 'linear-gradient(rgba(255,255,255,0.28) 1px, rgba(0,0,0,0) 1px),' +
                'linear-gradient(90deg, rgba(255,255,255,0.28) 1px, rgba(0,0,0,0) 1px),' +
                'linear-gradient(rgba(255,255,255,0.12) 1px, rgba(0,0,0,0) 1px),' +
                'linear-gradient(90deg, rgba(255,255,255,0.12) 1px, rgba(0,0,0,0) 1px),' +
                'linear-gradient(#1d4f8a, #1d4f8a)',
            size: '80px 80px, 80px 80px, 16px 16px, 16px 16px, 100% 100%',
        },
        ...PHOTOS.map(photo => Object.assign({ photo: true }, photo)),
    ];

    const DEFAULTS = { color: '#008080', wallpaper: 'none', display: 'stretch' };

    function load() {
        const saved = store.get('wallpaper', null);
        const settings = Object.assign({}, DEFAULTS, saved || {});
        if (!ITEMS.some(item => item.id === settings.wallpaper)) settings.wallpaper = 'none';
        return settings;
    }

    // The CSS for a setting, applied to the desktop or to a preview element.
    function styleFor(settings) {
        const item = ITEMS.find(i => i.id === settings.wallpaper) || ITEMS[0];
        const style = {
            backgroundColor: settings.color,
            backgroundImage: 'none',
            backgroundSize: 'auto',
            backgroundRepeat: 'repeat',
            backgroundPosition: '0 0',
        };
        if (item.pattern) {
            style.backgroundImage = patternImage(PATTERNS[item.pattern]);
            style.backgroundSize = '16px 16px';
        } else if (item.picture) {
            style.backgroundImage = item.css;
            style.backgroundSize = item.size || '100% 100%';
        } else if (item.photo) {
            style.backgroundImage = `url("${item.src}")`;
            if (settings.display === 'stretch') {
                style.backgroundSize = 'cover';
                style.backgroundRepeat = 'no-repeat';
                style.backgroundPosition = 'center';
            } else if (settings.display === 'center') {
                style.backgroundRepeat = 'no-repeat';
                style.backgroundPosition = 'center';
            }
        }
        return style;
    }

    function apply(settings) {
        Object.assign(document.body.style, styleFor(settings || load()));
    }

    function save(settings) {
        store.set('wallpaper', settings);
        apply(settings);
    }

    return { COLORS, ITEMS, load, save, apply, styleFor };
})();

Wallpaper.apply();

// ---------------------------------------------------------------------------
// Built-in windows: the CV and Send Mail, both adopted from index.html.
// ---------------------------------------------------------------------------
WM.register('cv', {
    element: document.getElementById('cv-window'),
    icon: 'document',
});

WM.register('mail', {
    element: document.getElementById('mail-window'),
    icon: 'mail',
});

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

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

// Kick the fetch off immediately, but hold the fade-in until the CV is in the
// DOM so the window never flashes empty.
const cvLoaded = loadCV();

window.addEventListener('load', () => {
    WM.open('cv');
    cvLoaded.then(() => {
        document.querySelector('.screen-layout').classList.add('ready');
    });
});
