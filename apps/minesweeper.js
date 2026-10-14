'use strict';

// ===========================================================================
// Minesweeper. Written from scratch; the graphics are inline SVG and CSS.
//
// Mouse: left reveals, right flags, both buttons (or middle, or a left click
// on a number) chord. Touch: tap reveals, press and hold flags; the Flag
// button turns every tap into a flag. The first reveal is always safe and
// always opens an area.
// ===========================================================================

const MINE_LEVELS = {
    beginner: { label: 'Beginner', rows: 9, cols: 9, mines: 10 },
    intermediate: { label: 'Intermediate', rows: 16, cols: 16, mines: 40 },
    expert: { label: 'Expert', rows: 16, cols: 30, mines: 99 },
};

// Seven-segment digits for the two counters.
const SEGMENTS = {
    a: 'M2 1H11L9 3H4Z',
    b: 'M12 2V11L10 9.5V4Z',
    c: 'M12 12V21L10 19V13.5Z',
    d: 'M2 22H11L9 20H4Z',
    e: 'M1 12L3 13.5V19L1 21Z',
    f: 'M1 2L3 4V9.5L1 11Z',
    g: 'M2 11.5L4 10.5H9L11 11.5L9 12.5H4Z',
};
const DIGIT_SEGMENTS = {
    0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg',
    6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g',
};

function ledDigits(value) {
    const n = Math.round(value);
    const text = n < 0 ? '-' + String(Math.min(99, -n)).padStart(2, '0') : String(Math.min(999, n)).padStart(3, '0');
    let svg = '<svg viewBox="0 0 39 23" width="39" height="23" aria-hidden="true">';
    [...text].forEach((ch, i) => {
        const lit = DIGIT_SEGMENTS[ch] || '';
        svg += `<g transform="translate(${i * 13} 0)">`;
        Object.entries(SEGMENTS).forEach(([seg, d]) => {
            svg += `<path d="${d}" fill="${lit.includes(seg) ? '#ff0000' : '#4a0000'}"/>`;
        });
        svg += '</g>';
    });
    return svg + '</svg>';
}

// The face on the button: smile, ooh (while pressing), dead, cool (won).
const FACES = (() => {
    const head = '<circle cx="8.5" cy="8.5" r="7.5" fill="#ffff00" stroke="#000"/>';
    const dotEyes = '<rect x="5" y="5" width="2" height="2"/><rect x="10" y="5" width="2" height="2"/>';
    const wrap = inner => `<svg viewBox="0 0 17 17" width="17" height="17" aria-hidden="true">${head}<g fill="#000" stroke="none">${inner}</g></svg>`;
    return {
        smile: wrap(dotEyes + '<path d="M5 10.5q3.5 3 7 0" fill="none" stroke="#000" stroke-width="1.2"/>'),
        ooh: wrap(dotEyes + '<circle cx="8.5" cy="11.5" r="1.8" fill="none" stroke="#000" stroke-width="1.2"/>'),
        dead: wrap('<path d="M4.5 4.5l3 3m0-3l-3 3M9.5 4.5l3 3m0-3l-3 3" stroke="#000" stroke-width="1.1"/>' +
            '<path d="M5 12.5q3.5-3 7 0" fill="none" stroke="#000" stroke-width="1.2"/>'),
        cool: wrap('<path d="M3 5.5h11v1.2l-1 2.3h-3l-1-2h-1l-1 2h-3l-1-2.3z"/>' +
            '<path d="M5 10.5q3.5 3 7 0" fill="none" stroke="#000" stroke-width="1.2"/>'),
    };
})();

WM.register('minesweeper', {
    title: 'Minesweeper',
    icon: 'minesweeper',
    fixedSize: true,
    className: 'mine-window',
    create(body, app) {
        const coarse = window.matchMedia('(pointer: coarse)').matches;
        let level = store.get('mines.level', 'beginner');
        if (!MINE_LEVELS[level]) level = 'beginner';
        let marks = store.get('mines.marks', false);
        let large = store.get('mines.large', false);
        let flagMode = false;

        let cells = [];
        let state = 'ready';     // ready | playing | won | lost
        let flags = 0;
        let revealedCount = 0;
        let seconds = 0;
        let timer = null;

        const mineCounter = h('div', { class: 'mine-led', role: 'status', 'aria-label': 'Mines left' });
        const timeCounter = h('div', { class: 'mine-led', role: 'timer', 'aria-label': 'Seconds' });
        const face = h('button', { class: 'mine-face', 'aria-label': 'New game', onclick: () => newGame() });
        const board = h('div', { class: 'mine-board', role: 'grid', 'aria-label': 'Minefield' });
        const flagButton = h('button', {
            class: 'mine-flag-toggle',
            'aria-pressed': 'false',
            onclick: () => {
                flagMode = !flagMode;
                flagButton.setAttribute('aria-pressed', String(flagMode));
                flagButton.classList.toggle('active', flagMode);
            },
        }, h('span', { class: 'mine-flag-icon', 'aria-hidden': 'true' }), 'Flag mode');

        body.appendChild(menubar([
            {
                label: 'Game', items: () => [
                    { label: 'New', shortcut: 'F2', action: () => newGame() },
                    { separator: true },
                    ...Object.entries(MINE_LEVELS).map(([key, def]) => ({
                        label: def.label, checked: level === key, radio: true, action: () => setLevel(key),
                    })),
                    { separator: true },
                    {
                        label: 'Marks (?)', checked: marks, action: () => {
                            marks = !marks;
                            store.set('mines.marks', marks);
                        },
                    },
                    {
                        label: 'Large Squares', checked: large, action: () => {
                            large = !large;
                            store.set('mines.large', large);
                            sizeBoard();
                        },
                    },
                    { separator: true },
                    { label: 'Best Times...', action: showBestTimes },
                    { separator: true },
                    { label: 'Exit', action: () => app.close() },
                ],
            },
            {
                label: 'Help', items: [
                    {
                        label: 'How to Play', action: () => WM.messageBox({
                            title: 'Minesweeper Help', icon: 'info',
                            text: [
                                'Uncover every square that is not a mine. A number tells you how many mines touch that square.',
                                coarse
                                    ? 'Tap to uncover. Press and hold to plant a flag, or switch on Flag mode. Tap a number whose mines are all flagged to clear around it.'
                                    : 'Left-click to uncover, right-click to plant a flag. Click a number whose mines are all flagged (or press both buttons) to clear around it.',
                                'Your first click is always safe.',
                            ],
                        }),
                    },
                    { label: 'About Minesweeper', action: () => WM.messageBox({ title: 'About Minesweeper', icon: 'info', text: 'Minesweeper' }) },
                ],
            },
        ]));

        body.appendChild(h('div', { class: 'mine-frame' },
            h('div', { class: 'mine-header' }, mineCounter, face, timeCounter),
            h('div', { class: 'mine-board-wrap' }, board),
            coarse ? h('div', { class: 'mine-touchbar' }, flagButton) : null));

        // -------------------------------------------------------------------
        // Board
        // -------------------------------------------------------------------
        const def = () => MINE_LEVELS[level];

        function neighbours(i) {
            const { rows, cols } = def();
            const r = Math.floor(i / cols);
            const c = i % cols;
            const out = [];
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (!dr && !dc) continue;
                    const rr = r + dr;
                    const cc = c + dc;
                    if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc);
                }
            }
            return out;
        }

        function sizeBoard() {
            const { cols } = def();
            let size = large ? 24 : 16;
            if (isSmallScreen()) {
                size = clamp(Math.floor((document.documentElement.clientWidth - 40) / cols), 12, 30);
            }
            board.style.setProperty('--cell', `${size}px`);
            board.style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;
            WM.refit('minesweeper');
        }

        function newGame() {
            const { rows, cols, mines } = def();
            clearInterval(timer);
            timer = null;
            state = 'ready';
            flags = 0;
            revealedCount = 0;
            seconds = 0;
            cells = [];
            board.textContent = '';
            for (let i = 0; i < rows * cols; i++) {
                const el = h('div', { class: 'mine-cell', role: 'gridcell', dataset: { i: String(i) } });
                cells.push({ el, mine: false, adj: 0, revealed: false, mark: 0 });
                board.appendChild(el);
            }
            setFace('smile');
            mineCounter.innerHTML = ledDigits(mines);
            timeCounter.innerHTML = ledDigits(0);
            sizeBoard();
        }

        function setLevel(key) {
            level = key;
            store.set('mines.level', key);
            newGame();
        }

        // Mines are laid on the first reveal, away from the square clicked
        // and, where there is room, from its neighbours as well.
        function layMines(first) {
            const { mines } = def();
            const safe = new Set([first, ...neighbours(first)]);
            if (cells.length - safe.size < mines) safe.clear();
            safe.add(first);
            const pool = [];
            for (let i = 0; i < cells.length; i++) if (!safe.has(i)) pool.push(i);
            for (let k = 0; k < mines; k++) {
                const j = k + Math.floor(Math.random() * (pool.length - k));
                [pool[k], pool[j]] = [pool[j], pool[k]];
                cells[pool[k]].mine = true;
            }
            cells.forEach((cell, i) => {
                cell.adj = neighbours(i).filter(n => cells[n].mine).length;
            });
        }

        function startClock() {
            state = 'playing';
            seconds = 1;
            timeCounter.innerHTML = ledDigits(seconds);
            timer = setInterval(() => {
                seconds = Math.min(999, seconds + 1);
                timeCounter.innerHTML = ledDigits(seconds);
            }, 1000);
        }

        function paint(i) {
            const cell = cells[i];
            let cls = 'mine-cell';
            if (cell.revealed) {
                cls += ' revealed';
                if (cell.mine) cls += ' mine';
                else if (cell.adj) cls += ' n' + cell.adj;
            } else if (cell.mark === 1) {
                cls += ' flag';
            } else if (cell.mark === 2) {
                cls += ' question';
            }
            if (cell.exploded) cls += ' exploded';
            if (cell.wrong) cls += ' wrong';
            cell.el.className = cls;
            cell.el.textContent = cell.revealed && !cell.mine && cell.adj ? String(cell.adj) : '';
        }

        function reveal(i) {
            if (state === 'won' || state === 'lost') return;
            const cell = cells[i];
            if (cell.revealed || cell.mark === 1) return;
            if (state === 'ready') {
                layMines(i);
                startClock();
            }
            if (cell.mine) {
                cell.exploded = true;
                lose();
                return;
            }
            // Flood fill from empty squares.
            const stack = [i];
            while (stack.length) {
                const j = stack.pop();
                const c = cells[j];
                if (c.revealed || c.mark === 1) continue;
                c.revealed = true;
                c.mark = 0;
                revealedCount += 1;
                paint(j);
                if (c.adj === 0) neighbours(j).forEach(n => { if (!cells[n].revealed) stack.push(n); });
            }
            if (revealedCount === cells.length - def().mines) win();
        }

        function chord(i) {
            const cell = cells[i];
            if (!cell.revealed || !cell.adj || state !== 'playing') return;
            const around = neighbours(i);
            const flagged = around.filter(n => cells[n].mark === 1).length;
            if (flagged !== cell.adj) return;
            around.forEach(n => {
                if (state === 'playing') reveal(n);
            });
        }

        function toggleMark(i) {
            if (state === 'won' || state === 'lost') return;
            const cell = cells[i];
            if (cell.revealed) return;
            if (cell.mark === 0) {
                cell.mark = 1;
                flags += 1;
            } else if (cell.mark === 1) {
                flags -= 1;
                cell.mark = marks ? 2 : 0;
            } else {
                cell.mark = 0;
            }
            paint(i);
            mineCounter.innerHTML = ledDigits(def().mines - flags);
        }

        function lose() {
            state = 'lost';
            clearInterval(timer);
            cells.forEach((cell, i) => {
                if (cell.mine && cell.mark !== 1) cell.revealed = true;
                if (!cell.mine && cell.mark === 1) cell.wrong = true;
                paint(i);
            });
            setFace('dead');
        }

        function win() {
            state = 'won';
            clearInterval(timer);
            cells.forEach((cell, i) => {
                if (cell.mine) {
                    cell.mark = 1;
                    paint(i);
                }
            });
            flags = def().mines;
            mineCounter.innerHTML = ledDigits(0);
            setFace('cool');
            const best = store.get('mines.best', {});
            if (!best[level] || seconds < best[level]) {
                best[level] = seconds;
                store.set('mines.best', best);
                setTimeout(() => WM.messageBox({
                    title: 'Minesweeper', icon: 'info',
                    text: [`You have the fastest time for ${def().label.toLowerCase()} level: ${seconds} second${seconds === 1 ? '' : 's'}.`,
                        'Saved in this browser.'],
                }), 300);
            }
        }

        function showBestTimes() {
            const best = store.get('mines.best', {});
            WM.messageBox({
                title: 'Fastest Mine Sweepers', icon: null,
                text: Object.entries(MINE_LEVELS).map(([key, d]) =>
                    `${d.label}:  ${best[key] ? `${best[key]} second${best[key] === 1 ? '' : 's'}` : '999 seconds  (Anonymous)'}`),
                buttons: ['Reset Scores', 'OK'],
            }).then(answer => {
                if (answer === 'Reset Scores') store.remove('mines.best');
            });
        }

        function setFace(name) {
            face.innerHTML = FACES[name];
            face.dataset.face = name;
        }

        // -------------------------------------------------------------------
        // Input
        // -------------------------------------------------------------------
        let pressMode = null;   // 'reveal' | 'chord' | 'touch'
        let pressed = [];
        let pressIndex = -1;
        let longPress = null;
        let touchStart = null;
        let touchConsumed = false;

        const cellAt = (x, y) => {
            const el = document.elementFromPoint(x, y);
            return el && el.parentNode === board && el.dataset.i !== undefined ? Number(el.dataset.i) : -1;
        };

        function showPressed(i) {
            pressed.forEach(j => cells[j] && cells[j].el.classList.remove('pressed'));
            pressed = [];
            pressIndex = i;
            if (i < 0 || state === 'won' || state === 'lost') return;
            const targets = pressMode === 'chord' ? [i, ...neighbours(i)] : [i];
            targets.forEach(j => {
                const c = cells[j];
                if (!c.revealed && c.mark !== 1) {
                    c.el.classList.add('pressed');
                    pressed.push(j);
                }
            });
        }

        function endPress() {
            showPressed(-1);
            pressMode = null;
            if (state === 'ready' || state === 'playing') setFace('smile');
        }

        board.addEventListener('contextmenu', e => e.preventDefault());

        board.addEventListener('pointerdown', e => {
            const i = cellAt(e.clientX, e.clientY);
            if (i < 0 || state === 'won' || state === 'lost') return;
            e.preventDefault();
            try {
                board.setPointerCapture(e.pointerId);
            } catch (err) { /* pointer already gone */ }

            if (e.pointerType !== 'mouse') {
                pressMode = 'touch';
                touchConsumed = false;
                touchStart = { x: e.clientX, y: e.clientY, i };
                showPressed(i);
                setFace('ooh');
                clearTimeout(longPress);
                longPress = setTimeout(() => {
                    touchConsumed = true;
                    showPressed(-1);
                    toggleMark(i);
                    if (navigator.vibrate) navigator.vibrate(25);
                    setFace('smile');
                }, 380);
                return;
            }

            const both = (e.buttons & 3) === 3;
            if (e.button === 1 || both) {
                pressMode = 'chord';
            } else if (e.button === 2) {
                toggleMark(i);
                return;
            } else if (e.button === 0) {
                pressMode = cells[i].revealed ? 'chord' : 'reveal';
            } else {
                return;
            }
            setFace('ooh');
            showPressed(i);
        });

        board.addEventListener('pointermove', e => {
            // A second mouse button pressed during a press arrives as a move.
            if (e.pointerType === 'mouse' && pressMode === 'reveal' && (e.buttons & 3) === 3) {
                pressMode = 'chord';
                showPressed(cellAt(e.clientX, e.clientY));
                return;
            }
            if (!pressMode) return;
            if (pressMode === 'touch') {
                if (touchStart && (Math.abs(e.clientX - touchStart.x) > TAP_SLOP || Math.abs(e.clientY - touchStart.y) > TAP_SLOP)) {
                    clearTimeout(longPress);
                    touchStart = null;
                    endPress();
                }
                return;
            }
            const i = cellAt(e.clientX, e.clientY);
            if (i !== pressIndex) showPressed(i);
        });

        board.addEventListener('pointerup', e => {
            if (!pressMode) return;
            const mode = pressMode;
            if (mode === 'touch') {
                clearTimeout(longPress);
                const start = touchStart;
                touchStart = null;
                endPress();
                if (!start || touchConsumed) return;
                const cell = cells[start.i];
                if (cell.revealed) chord(start.i);
                else if (flagMode) toggleMark(start.i);
                else reveal(start.i);
                return;
            }
            const i = cellAt(e.clientX, e.clientY);
            endPress();
            if (i < 0) return;
            if (mode === 'chord') chord(i);
            else reveal(i);
        });

        board.addEventListener('pointercancel', () => {
            clearTimeout(longPress);
            touchStart = null;
            endPress();
        });

        app.el.addEventListener('keydown', e => {
            if (e.key === 'F2') {
                e.preventDefault();
                newGame();
            }
        });

        app.newGame = newGame;
        app.sizeBoard = sizeBoard;
        newGame();
    },
    onOpen(args, app) {
        app.sizeBoard();
    },
    onResize(app) {
        app.sizeBoard();
    },
    // Closing the window ends the game, as it did on Windows.
    onClose(app) {
        app.newGame();
    },
});
