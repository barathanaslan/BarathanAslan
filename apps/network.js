'use strict';

// ===========================================================================
// My computers: live status, My Computer, Properties, the MS-DOS Prompt
// (ping, tailmon) and the network icon in the tray.
//
// How the status gets here: every couple of minutes the Mac mini runs
// `tailmon json`, keeps only the fields below and posts them to a Cloudflare
// Worker (status/ in this repo). This page only ever reads that Worker's
// cached summary. Visitors never reach the machines themselves.
// ===========================================================================

const STATUS_URL = 'https://status.barathanaslan.com/v1/status';
const STATUS_STALE_MS = 6 * 60 * 1000;   // the mini reports every 2 minutes
const STATUS_CACHE_MS = 20 * 1000;

const MACHINES = [
    {
        id: 'barathans-mini',
        label: 'Mac mini',
        aliases: ['mini', 'mac-mini', 'macmini'],
        role: 'My main machine, and always on. Code, data and anything that runs fine on a CPU live here.',
    },
    {
        id: 'barathans-5090',
        label: 'The CUDA box',
        aliases: ['5090', 'cuda', 'box', 'cuda-box', 'rtx5090'],
        role: 'A Windows 11 PC with an RTX 5090. Training runs and big data live here.',
    },
    {
        id: 'barathans-macbook',
        label: 'MacBook',
        aliases: ['macbook', 'laptop'],
        role: 'The screen and keyboard I carry around. It mostly talks to the mini.',
    },
];

function findMachine(name) {
    const key = String(name || '').toLowerCase().replace(/\.$/, '');
    return MACHINES.find(m => m.id === key || m.aliases.includes(key)) || null;
}

const MachineStatus = (() => {
    let snapshot = null;
    let fetchedAt = 0;
    let inflight = null;
    let failed = false;
    const listeners = new Set();

    // Ages are measured against the Worker's clock, not the visitor's, so a
    // wrong clock on this computer cannot make a machine look asleep.
    function normalise(data) {
        const now = Date.parse(data.now) || Date.now();
        const reportedAt = data.reported_at ? Date.parse(data.reported_at) : null;
        const reportAge = reportedAt ? Math.max(0, now - reportedAt) : null;
        const hosts = {};
        (data.hosts || []).forEach(host => {
            hosts[host.id] = Object.assign({}, host, {
                lastLiveAge: host.last_live ? Math.max(0, now - Date.parse(host.last_live)) : null,
            });
        });
        return { reportAgeAtFetch: reportAge, hosts, receivedAt: Date.now() };
    }

    // How old the mini's last report is now, not when it was fetched.
    function reportAge(snap) {
        if (!snap || snap.reportAgeAtFetch === null) return null;
        return snap.reportAgeAtFetch + (Date.now() - snap.receivedAt);
    }

    function isStale(snap) {
        const age = reportAge(snap);
        return age === null || age > STATUS_STALE_MS;
    }

    function get(force) {
        if (!force && snapshot && Date.now() - fetchedAt < STATUS_CACHE_MS) return Promise.resolve(snapshot);
        if (inflight) return inflight;
        inflight = fetch(STATUS_URL, { cache: 'no-store', credentials: 'omit' })
            .then(response => {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(data => {
                snapshot = normalise(data);
                fetchedAt = Date.now();
                failed = false;
                listeners.forEach(fn => fn(snapshot));
                return snapshot;
            })
            .catch(error => {
                failed = true;
                listeners.forEach(fn => fn(snapshot));
                throw error;
            })
            .finally(() => { inflight = null; });
        return inflight;
    }

    // 'online' | 'offline' | 'unknown'
    function stateOf(id, snap) {
        if (!snap || isStale(snap)) return 'unknown';
        const host = snap.hosts[id];
        if (!host) return 'unknown';
        if (host.status === 'live' || host.status === 'no-agent') return 'online';
        return host.status === 'offline' ? 'offline' : 'unknown';
    }

    return {
        get,
        stateOf,
        reportAge,
        isStale,
        failed: () => failed,
        current: () => snapshot,
        onChange: fn => listeners.add(fn),
    };
})();

function formatAge(ms) {
    if (ms === null || ms === undefined) return 'never';
    const s = Math.round(ms / 1000);
    if (s < 90) return `${s}s ago`;
    const m = Math.round(s / 60);
    if (m < 90) return `${m} min ago`;
    const hrs = Math.round(m / 60);
    if (hrs < 36) return `${hrs} hours ago`;
    return `${Math.round(hrs / 24)} days ago`;
}

function formatUptime(hours) {
    if (hours === null || hours === undefined) return '-';
    if (hours < 1) return 'under an hour';
    if (hours < 48) return `${hours}h`;
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

const pct = value => (value === null || value === undefined ? '-' : `${Math.round(value)}%`);

const STATE_WORD = { online: 'awake', offline: 'asleep', unknown: 'unknown' };

function machineSummary(machine, snap) {
    const state = MachineStatus.stateOf(machine.id, snap);
    const host = snap && snap.hosts[machine.id];
    if (state === 'online') return `Awake · last report ${formatAge(MachineStatus.reportAge(snap))}`;
    if (state === 'offline') {
        return host && host.lastLiveAge !== null ? `Asleep · last seen awake ${formatAge(host.lastLiveAge)}` : 'Asleep';
    }
    if (snap && MachineStatus.isStale(snap)) return `Unknown · no report since ${formatAge(MachineStatus.reportAge(snap))}`;
    if (snap) return 'Unknown · the Mac mini cannot see it right now';
    return 'Unknown · status service unreachable';
}

// One line of hardware, e.g. "Windows · 24 cores · 64 GB · RTX 5090 32 GB"
function hardwareLine(host) {
    if (!host) return null;
    const parts = [];
    if (host.os) parts.push(host.os);
    if (host.cpu_cores) parts.push(`${host.cpu_cores} cores`);
    if (host.mem_total_gb) parts.push(`${host.mem_total_gb} GB RAM`);
    if (host.gpu_name) parts.push(host.gpu_name.replace(/^NVIDIA GeForce /, '') + (host.vram_total_gb ? ` ${host.vram_total_gb} GB` : ''));
    return parts.join(' · ');
}

function loadBar(label, value) {
    const width = value === null || value === undefined ? 0 : clamp(value, 0, 100);
    return h('div', { class: 'load-row' },
        h('span', { class: 'load-label' }, label),
        h('div', { class: 'progress-indicator segmented load-bar' },
            h('span', { class: 'progress-indicator-bar', style: { width: `${width}%` } })),
        h('span', { class: 'load-value' }, pct(value)));
}

function machineDetail(machine, snap) {
    const host = snap && snap.hosts[machine.id];
    const online = MachineStatus.stateOf(machine.id, snap) === 'online';
    const box = h('div', { class: 'machine-detail' },
        h('p', { class: 'machine-state' }, machineSummary(machine, snap)));
    const hw = hardwareLine(host);
    if (hw) box.appendChild(h('p', null, hw));
    if (online && host && host.status === 'live') {
        box.appendChild(loadBar('CPU', host.cpu_pct));
        box.appendChild(loadBar('RAM', host.mem_pct));
        if (host.gpu_pct !== null && host.gpu_pct !== undefined) box.appendChild(loadBar('GPU', host.gpu_pct));
        box.appendChild(h('p', null, `Up for ${formatUptime(host.uptime_h)}`));
    }
    return box;
}

// ---------------------------------------------------------------------------
// My Computer
// ---------------------------------------------------------------------------
WM.register('mycomputer', {
    title: 'My Computer',
    icon: 'my-computer',
    className: 'folder-window',
    width: 640,
    height: 420,
    create(body, app) {
        app.view = FolderView(body, app, {
            title: 'My Computer',
            icon: 'my-computer',
            address: 'My Computer',
            hint: 'Select a computer to see whether it is awake. Double-click it for its properties.',
            status: () => {
                const snap = MachineStatus.current();
                if (!snap) return MachineStatus.failed() ? 'Status service unreachable' : 'Asking the status service...';
                const age = formatAge(MachineStatus.reportAge(snap));
                return MachineStatus.isStale(snap) ? `No report since ${age}` : `Last report ${age}`;
            },
            footer: () => h('p', { class: 'folder-side-note' },
                'The Mac mini reports through tailmon every two minutes. Your browser never talks to my computers directly.'),
            menus: folderMenus(app, () => [
                {
                    label: 'Ping',
                    disabled: () => !app.view || !app.view.selected(),
                    action: () => launch('dos', { run: `ping ${app.view.selected().name}` }),
                },
                {
                    label: 'Properties',
                    disabled: () => !app.view || !app.view.selected(),
                    action: () => openMachineProperties(findMachine(app.view.selected().name)),
                },
                { separator: true },
            ]),
            items: () => {
                const snap = MachineStatus.current();
                return MACHINES.map(machine => ({
                    name: machine.id,
                    icon: 'computer',
                    badge: MachineStatus.stateOf(machine.id, snap),
                    desc: `${machine.label}. ${machine.role}`,
                    status: machineSummary(machine, snap),
                    detail: () => machineDetail(machine, MachineStatus.current()),
                    open: () => openMachineProperties(machine),
                }));
            },
        });
        MachineStatus.onChange(() => {
            if (app.state !== 'closed') app.view.render();
        });
    },
    onOpen(args, app) {
        const poll = () => MachineStatus.get().catch(() => { /* listeners re-render */ });
        poll();
        clearInterval(app.timer);
        app.timer = setInterval(poll, 30000);
    },
    onClose(app) {
        clearInterval(app.timer);
    },
});

function openMachineProperties(machine) {
    if (!machine) return;
    const id = 'props-' + machine.id;
    if (!WM.has(id)) {
        WM.register(id, {
            title: `${machine.id} Properties`,
            dialog: true,
            className: 'properties-window',
            create(body, app) {
                const panelBody = h('div', { class: 'window-body' });
                const render = () => {
                    const snap = MachineStatus.current();
                    const host = snap && snap.hosts[machine.id];
                    const state = MachineStatus.stateOf(machine.id, snap);
                    panelBody.textContent = '';
                    panelBody.appendChild(h('div', { class: 'props-head' },
                        h('span', { class: 'icon-img' },
                            h('img', { src: iconSrc('computer', 32), alt: '', width: 32, height: 32 }),
                            h('span', { class: 'status-light ' + state, 'aria-hidden': 'true' })),
                        h('div', null, h('b', null, machine.id), h('br'), machine.label)));
                    panelBody.appendChild(h('div', { class: 'props-rule' }));
                    const rows = [
                        ['Status:', machineSummary(machine, snap)],
                        ['Role:', machine.role],
                        ['Hardware:', hardwareLine(host) || 'Not reported'],
                    ];
                    if (state === 'online' && host && host.status === 'live') rows.push(['Uptime:', formatUptime(host.uptime_h)]);
                    panelBody.appendChild(h('table', { class: 'props-table' },
                        rows.map(([k, v]) => h('tr', null, h('td', null, k), h('td', null, v)))));
                    if (state === 'online' && host && host.status === 'live') {
                        panelBody.appendChild(h('div', { class: 'props-rule' }));
                        panelBody.appendChild(loadBar('CPU', host.cpu_pct));
                        panelBody.appendChild(loadBar('RAM', host.mem_pct));
                        if (host.gpu_pct !== null && host.gpu_pct !== undefined) panelBody.appendChild(loadBar('GPU', host.gpu_pct));
                    }
                };
                body.appendChild(h('menu', { role: 'tablist' },
                    h('li', { role: 'tab', 'aria-selected': 'true' }, h('a', null, 'General'))));
                body.appendChild(h('div', { class: 'window props-panel', role: 'tabpanel' }, panelBody));
                body.appendChild(h('div', { class: 'dialog-buttons right' },
                    h('button', { onclick: () => launch('dos', { run: `ping ${machine.id}` }) }, 'Ping'),
                    h('button', { onclick: () => app.close() }, 'OK')));
                app.renderProps = render;
                MachineStatus.onChange(() => {
                    if (app.state !== 'closed') render();
                });
            },
            onOpen(args, app) {
                app.renderProps();
                MachineStatus.get().catch(() => app.renderProps());
            },
        });
    }
    WM.open(id);
}

// ---------------------------------------------------------------------------
// MS-DOS Prompt
// ---------------------------------------------------------------------------
const DOS_FILES = [
    ['README', 'TXT', README_TEXT.length],
    ['CV', 'DOC', 48640],
    ['WINMINE', 'EXE', 24064],
    ['SOL', 'EXE', 59904],
    ['NOTEPAD', 'EXE', 53248],
    ['IEXPLORE', 'EXE', 93184],
    ['PING', 'EXE', 16384],
    ['TAILMON', 'EXE', 7340032],
];

WM.register('dos', {
    title: 'MS-DOS Prompt',
    icon: 'dos',
    className: 'dos-window',
    width: 680,
    height: 420,
    create(body, app) {
        const output = h('pre', { class: 'dos-output' });
        const prompt = h('span', { class: 'dos-prompt' }, 'C:\\WINDOWS>');
        const input = h('input', {
            type: 'text', class: 'dos-input', spellcheck: 'false', autocomplete: 'off',
            autocapitalize: 'off', autocorrect: 'off', 'aria-label': 'Command',
        });
        const line = h('div', { class: 'dos-line' }, prompt, input);
        const screen = h('div', { class: 'dos-screen' }, output, line);
        body.appendChild(screen);

        const history = [];
        let historyIndex = 0;
        let busy = null;   // {cancel()} while a command is running

        function print(text) {
            output.appendChild(document.createTextNode(text + '\n'));
            screen.scrollTop = screen.scrollHeight;
        }

        function setBusy(task) {
            busy = task;
            line.classList.toggle('hidden', !!task);
            if (!task) {
                screen.scrollTop = screen.scrollHeight;
                if (app.isActive()) input.focus({ preventScroll: true });
            }
        }

        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

        async function ping(args) {
            let count = 4;
            let target = null;
            for (let i = 0; i < args.length; i++) {
                if (args[i] === '-n' && args[i + 1]) count = clamp(parseInt(args[++i], 10) || 4, 1, 20);
                else if (args[i] === '-t') count = 100;
                else if (!target) target = args[i];
            }
            if (!target || target === '/?') {
                print('Usage: ping [-n count] [-t] host');
                print('');
                print('Hosts on this network: ' + MACHINES.map(m => m.id).join(', '));
                print('Replies are relayed by status.barathanaslan.com; your browser never');
                print('contacts my computers directly.');
                return;
            }
            const lower = target.toLowerCase();
            let cancelled = false;
            setBusy({ cancel: () => { cancelled = true; } });

            const sent = [];
            const finish = (name, received) => {
                print('');
                print(`Ping statistics for ${name}:`);
                const lost = sent.length - received;
                print(`    Packets: Sent = ${sent.length}, Received = ${received}, Lost = ${lost} (${Math.round(100 * lost / Math.max(1, sent.length))}% loss),`);
            };

            if (lower === 'localhost' || lower === '127.0.0.1') {
                print(`Pinging ${lower} [127.0.0.1] with 32 bytes of data:`);
                print('');
                for (let i = 0; i < count && !cancelled; i++) {
                    if (i) await wait(1000);
                    if (cancelled) break;
                    sent.push(1);
                    print('Reply from 127.0.0.1: bytes=32 time<1ms TTL=128');
                }
                finish('127.0.0.1', sent.length);
                print('That is your own computer. It seems fine.');
                return;
            }
            if (lower === 'barathanaslan.com' || lower === 'www.barathanaslan.com') {
                print(`Pinging ${lower} with 32 bytes of data:`);
                print('');
                for (let i = 0; i < count && !cancelled; i++) {
                    if (i) await wait(1000);
                    if (cancelled) break;
                    sent.push(1);
                    print(`Reply from ${lower}: you are already here.`);
                }
                finish(lower, sent.length);
                return;
            }

            const machine = findMachine(lower);
            if (!machine) {
                print(`Ping request could not find host ${target}. Please check the name and try again.`);
                print('Hosts on this network: ' + MACHINES.map(m => m.id).join(', '));
                return;
            }

            print(`Pinging ${machine.id} [via status.barathanaslan.com] with 32 bytes of data:`);
            print('');
            let snap = null;
            let failed = false;
            try {
                snap = await MachineStatus.get(true);
            } catch (e) {
                failed = true;
            }
            const state = MachineStatus.stateOf(machine.id, snap);
            const host = snap && snap.hosts[machine.id];
            let received = 0;
            for (let i = 0; i < count && !cancelled; i++) {
                if (i) await wait(1000);
                if (cancelled) break;
                sent.push(1);
                if (state === 'online') {
                    received += 1;
                    const age = Math.round(MachineStatus.reportAge(snap) / 1000);
                    const load = host.status === 'live'
                        ? ` cpu=${pct(host.cpu_pct)}` + (host.gpu_pct !== null && host.gpu_pct !== undefined ? ` gpu=${pct(host.gpu_pct)}` : '')
                        : '';
                    print(`Reply from ${machine.id}: status=awake report=${age}s ago${load}`);
                } else {
                    if (i) await wait(1000);   // timeouts are slow
                    if (cancelled) break;
                    print('Request timed out.');
                }
            }
            if (cancelled) print('^C');
            finish(machine.id, received);
            print('');
            if (failed) {
                print('Could not reach status.barathanaslan.com, so nobody knows right now.');
            } else if (state === 'online') {
                const hw = hardwareLine(host);
                print(`${machine.id} is awake.` + (hw ? ` ${hw}.` : ''));
                if (host.status === 'live') {
                    print(`Load: CPU ${pct(host.cpu_pct)}, RAM ${pct(host.mem_pct)}` +
                        (host.gpu_pct !== null && host.gpu_pct !== undefined ? `, GPU ${pct(host.gpu_pct)}` : '') +
                        `. Up for ${formatUptime(host.uptime_h)}.`);
                }
            } else if (state === 'offline') {
                print(`${machine.id} is asleep or away.` +
                    (host && host.lastLiveAge !== null ? ` Last seen awake ${formatAge(host.lastLiveAge)}.` : ''));
            } else if (MachineStatus.isStale(snap)) {
                print(`The Mac mini has not reported since ${formatAge(MachineStatus.reportAge(snap))}, so nobody knows.`);
            } else {
                print(`The Mac mini cannot see ${machine.id} right now, so nobody knows.`);
            }
        }

        async function tailmon() {
            setBusy({ cancel() { } });
            let snap;
            try {
                snap = await MachineStatus.get(true);
            } catch (e) {
                print('tailmon: could not reach status.barathanaslan.com');
                return;
            }
            const pad = (s, n) => String(s).padEnd(n);
            const padL = (s, n) => String(s).padStart(n);
            print(pad('HOST', 20) + pad('STATUS', 10) + padL('CPU', 5) + padL('RAM', 6) + padL('GPU', 6) + '  UPTIME');
            MACHINES.forEach(machine => {
                const state = MachineStatus.stateOf(machine.id, snap);
                const host = snap.hosts[machine.id];
                const live = state === 'online' && host && host.status === 'live';
                print(pad(machine.id, 20) + pad(STATE_WORD[state], 10) +
                    padL(live ? pct(host.cpu_pct) : '-', 5) +
                    padL(live ? pct(host.mem_pct) : '-', 6) +
                    padL(live ? pct(host.gpu_pct) : '-', 6) +
                    '  ' + (live ? formatUptime(host.uptime_h) : '-'));
            });
            print('');
            print(`Report from the Mac mini, ${formatAge(MachineStatus.reportAge(snap))}.`);
        }

        function dir() {
            print(' Volume in drive C is BARATHAN98');
            print(' Directory of C:\\WINDOWS');
            print('');
            print('.              <DIR>        10-13-26  4:20p .');
            print('..             <DIR>        10-13-26  4:20p ..');
            DOS_FILES.forEach(([name, ext, size]) => {
                print(`${name.padEnd(8)} ${ext.padEnd(3)} ${String(size.toLocaleString('en-US')).padStart(12)}  10-13-26  4:20p ${name.toLowerCase()}.${ext.toLowerCase()}`);
            });
            const total = DOS_FILES.reduce((sum, f) => sum + f[2], 0);
            print(`         ${DOS_FILES.length} file(s)  ${total.toLocaleString('en-US').padStart(12)} bytes`);
            print('         2 dir(s)   98,000,000 bytes free');
        }

        function help() {
            [
                'Commands:',
                '  PING host     ask whether one of my computers is awake (try: ping barathans-5090)',
                '  TAILMON       status of all my computers',
                '  DIR           list files          TYPE file     show a text file',
                '  START prog    run a program (winmine, sol, notepad, iexplore...)',
                '  CLS           clear the screen    VER           show the version',
                '  DATE, TIME    what it says        EXIT          close this window',
            ].forEach(print);
        }

        async function execute(raw) {
            const commandLine = raw.trim();
            print(prompt.textContent + raw);
            if (!commandLine) return;
            history.push(commandLine);
            historyIndex = history.length;

            const [command, ...args] = commandLine.split(/\s+/);
            const cmd = command.toLowerCase().replace(/\.(exe|com)$/, '');
            try {
                switch (cmd) {
                    case 'help':
                    case '?':
                        help();
                        break;
                    case 'cls':
                        output.textContent = '';
                        break;
                    case 'ver':
                        print('');
                        print('Barathan 98 [Version 4.10.1998]');
                        print('');
                        break;
                    case 'date':
                        print('Current date is ' + new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }));
                        break;
                    case 'time':
                        print('Current time is ' + new Date().toLocaleTimeString('en-US'));
                        break;
                    case 'echo':
                        print(args.join(' '));
                        break;
                    case 'whoami':
                        print('barathan98\\visitor');
                        break;
                    case 'hostname':
                        print('barathan98');
                        break;
                    case 'cd':
                    case 'chdir':
                        print(args.length ? 'Invalid directory' : 'C:\\WINDOWS');
                        break;
                    case 'dir':
                        dir();
                        break;
                    case 'type':
                        if ((args[0] || '').toLowerCase() === 'readme.txt') README_TEXT.split('\n').forEach(print);
                        else print(args[0] ? 'File not found - ' + args[0] : 'Required parameter missing');
                        break;
                    case 'ping':
                        await ping(args);
                        break;
                    case 'tailmon':
                        await tailmon();
                        break;
                    case 'format':
                    case 'del':
                    case 'deltree':
                    case 'erase':
                    case 'rd':
                        print('Access denied. Nice try.');
                        break;
                    case 'ipconfig':
                    case 'winipcfg':
                        print('');
                        print('Barathan 98 IP Configuration');
                        print('');
                        print('        This computer keeps its addresses to itself.');
                        break;
                    case 'exit':
                        if (app.el.classList.contains('dos-fullscreen')) {
                            bootAgain();
                        } else {
                            app.close();
                        }
                        break;
                    case 'start':
                        // ping and tailmon belong to this prompt; run them here.
                        if (/^ping$/i.test(args[0] || '')) await ping(args.slice(1));
                        else if (/^tailmon$/i.test(args[0] || '')) await tailmon();
                        else if (!args.length || !runCommand(args.join(' '))) print('Bad command or file name');
                        break;
                    default:
                        if (!runCommand(commandLine)) print('Bad command or file name');
                }
            } finally {
                if (cmd !== 'cls' && cmd !== 'exit') print('');
                setBusy(null);
            }
        }

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const value = input.value;
                input.value = '';
                execute(value);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (historyIndex > 0) input.value = history[--historyIndex];
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                historyIndex = Math.min(history.length, historyIndex + 1);
                input.value = history[historyIndex] || '';
            }
        });

        // Ctrl+C stops a running ping, as it should.
        app.el.addEventListener('keydown', e => {
            if (busy && e.ctrlKey && e.key.toLowerCase() === 'c') busy.cancel();
        });
        screen.addEventListener('click', () => {
            if (!busy && !window.getSelection().toString()) input.focus({ preventScroll: true });
        });

        print('');
        print('Barathan 98 [Version 4.10.1998]');
        print('(C)Copyright 1981-1998 Barathan Aslan. Type HELP for a list of commands.');
        print('');

        app.execute = command => {
            if (busy) return;
            input.value = '';
            execute(command);
        };
        app.focusInput = () => input.focus({ preventScroll: true });
    },
    onOpen(args, app) {
        if (args.fullscreen) app.el.classList.add('dos-fullscreen');
        if (args.run) app.execute(args.run);
        else app.focusInput();
    },
    onFocus(app) {
        if (app.focusInput) setTimeout(app.focusInput, 0);
    },
    onClose(app) {
        app.el.classList.remove('dos-fullscreen');
    },
});

// ---------------------------------------------------------------------------
// Tray: a network icon that says how many of my computers are awake.
// ---------------------------------------------------------------------------
(() => {
    const tray = document.getElementById('taskbar-tray');
    const icon = h('img', {
        class: 'tray-icon', src: iconSrc('network', 16), alt: 'My computers', width: 16, height: 16,
        title: 'My computers',
        onclick: () => launch('mycomputer'),
    });
    tray.prepend(icon);

    function update(snap) {
        icon.title = MACHINES.map(m => `${m.id}: ${STATE_WORD[MachineStatus.stateOf(m.id, snap)]}`).join('\n');
    }
    MachineStatus.onChange(update);
    setTimeout(() => MachineStatus.get().catch(() => { icon.title = 'Status service unreachable'; }), 4000);
})();
