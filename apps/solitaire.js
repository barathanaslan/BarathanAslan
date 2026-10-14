'use strict';

// ===========================================================================
// Solitaire (Klondike). Written from scratch; cards are drawn with CSS, and
// with canvas for the bouncing-cards finale.
//
// Drag cards, or just click/tap one: it jumps to the best place it can go
// (a foundation first, then the tableau). Face-down cards turn over by
// themselves. Standard Windows scoring.
// ===========================================================================

const SUITS = [
    { glyph: '♠', red: false, name: 'spades' },
    { glyph: '♥', red: true, name: 'hearts' },
    { glyph: '♣', red: false, name: 'clubs' },
    { glyph: '♦', red: true, name: 'diamonds' },
];
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Pip positions (fractions of the card's inner area) for 2–10.
const PIPS = (() => {
    const L = 0.28;
    const R = 0.72;
    const C = 0.5;
    const top4 = [[L, 0.18], [R, 0.18], [L, 0.82], [R, 0.82]];
    const mid2 = [[L, 0.5], [R, 0.5]];
    return {
        2: [[C, 0.18], [C, 0.82]],
        3: [[C, 0.18], [C, 0.5], [C, 0.82]],
        4: top4,
        5: [...top4, [C, 0.5]],
        6: [...top4, ...mid2],
        7: [...top4, ...mid2, [C, 0.34]],
        8: [...top4, ...mid2, [C, 0.34], [C, 0.66]],
        9: [[L, 0.18], [R, 0.18], [L, 0.39], [R, 0.39], [L, 0.61], [R, 0.61], [L, 0.82], [R, 0.82], [C, 0.5]],
        10: [[L, 0.18], [R, 0.18], [L, 0.39], [R, 0.39], [L, 0.61], [R, 0.61], [L, 0.82], [R, 0.82], [C, 0.29], [C, 0.71]],
    };
})();

WM.register('solitaire', {
    title: 'Solitaire',
    icon: 'solitaire',
    className: 'sol-window',
    width: 660,
    height: 500,
    create(body, app) {
        const table = h('div', { class: 'sol-table' });
        const modeField = h('p', { class: 'sol-mode' });
        const scoreField = h('p', { class: 'sol-score' });
        const timeField = h('p', { class: 'sol-time' });
        let drawThree = store.get('sol.drawThree', false);

        body.appendChild(menubar([
            {
                label: 'Game', items: () => [
                    { label: 'Deal', shortcut: 'F2', action: deal },
                    { label: 'Undo', disabled: () => !undoStack.length || won, action: undo },
                    { separator: true },
                    { label: 'Draw One', checked: !drawThree, radio: true, action: () => setDraw(false) },
                    { label: 'Draw Three', checked: drawThree, radio: true, action: () => setDraw(true) },
                    { separator: true },
                    { label: 'Exit', action: () => app.close() },
                ],
            },
            {
                label: 'Help', items: [
                    {
                        label: 'How to Play', action: () => WM.messageBox({
                            title: 'Solitaire Help', icon: 'info',
                            text: [
                                'Build four piles on the top right, one per suit, from Ace up to King.',
                                'On the seven piles below, stack cards downwards in alternating colours. Only a King may go to an empty pile.',
                                'Drag a card, or simply click it: it jumps to the best place it can go. Click the deck to turn over more cards.',
                            ],
                        }),
                    },
                    { label: 'About Solitaire', action: () => WM.messageBox({ title: 'About Solitaire', icon: 'info', text: 'Solitaire' }) },
                ],
            },
        ]));
        body.appendChild(table);
        body.appendChild(h('div', { class: 'window-status' }, modeField, scoreField, timeField));

        // -------------------------------------------------------------------
        // Cards and piles
        // -------------------------------------------------------------------
        const cards = [];
        for (let s = 0; s < 4; s++) {
            for (let r = 1; r <= 13; r++) {
                const card = { id: s * 13 + r - 1, suit: s, rank: r, up: false, el: null };
                card.el = buildCardElement(card);
                table.appendChild(card.el);
                cards.push(card);
            }
        }

        const slot = cls => {
            const el = h('div', { class: 'sol-slot ' + cls });
            table.appendChild(el);
            return el;
        };
        const stockSlot = slot('stock');
        const foundationSlots = [0, 1, 2, 3].map(() => slot('foundation'));
        const tableauSlots = [0, 1, 2, 3, 4, 5, 6].map(() => slot('tableau'));

        let stock = [];
        let waste = [];
        let foundations = [[], [], [], []];
        let tableau = [[], [], [], [], [], [], []];
        let score = 0;
        let seconds = 0;
        let timer = null;
        let started = false;
        let won = false;
        let undoStack = [];
        let metrics = null;

        function buildCardElement(card) {
            const suit = SUITS[card.suit];
            const face = h('div', { class: 'sol-face' },
                h('span', { class: 'sol-corner tl' }, RANKS[card.rank], h('br'), suit.glyph),
                h('span', { class: 'sol-corner br' }, RANKS[card.rank], h('br'), suit.glyph));
            if (card.rank === 1) {
                face.appendChild(h('span', { class: 'sol-ace' }, suit.glyph));
            } else if (card.rank > 10) {
                face.appendChild(h('span', { class: 'sol-court' },
                    h('span', { class: 'sol-court-letter' }, RANKS[card.rank]),
                    h('span', { class: 'sol-court-suit' }, suit.glyph)));
            } else {
                PIPS[card.rank].forEach(([x, y]) => {
                    face.appendChild(h('span', {
                        class: 'sol-pip' + (y > 0.55 ? ' flip' : ''),
                        style: { left: `calc(16% + ${x * 68}%)`, top: `calc(9% + ${y * 82}%)` },
                    }, suit.glyph));
                });
            }
            return h('div', {
                class: 'sol-card back' + (suit.red ? ' red' : ''),
                dataset: { id: String(card.id) },
                'aria-label': `${RANKS[card.rank]} of ${suit.name}`,
            }, face);
        }

        const top = pile => pile[pile.length - 1];
        const isRed = card => SUITS[card.suit].red;

        function locate(card) {
            if (stock.includes(card)) return { kind: 'stock', pile: stock };
            if (waste.includes(card)) return { kind: 'waste', pile: waste };
            for (let i = 0; i < 4; i++) if (foundations[i].includes(card)) return { kind: 'foundation', pile: foundations[i], index: i };
            for (let i = 0; i < 7; i++) if (tableau[i].includes(card)) return { kind: 'tableau', pile: tableau[i], index: i };
            return null;
        }

        function canFoundation(card, pile) {
            const t = top(pile);
            return t ? t.suit === card.suit && card.rank === t.rank + 1 : card.rank === 1;
        }

        function canTableau(card, pile) {
            const t = top(pile);
            return t ? t.up && isRed(t) !== isRed(card) && card.rank === t.rank - 1 : card.rank === 13;
        }

        // -------------------------------------------------------------------
        // Game flow
        // -------------------------------------------------------------------
        function shuffle(list) {
            for (let i = list.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [list[i], list[j]] = [list[j], list[i]];
            }
            return list;
        }

        function deal() {
            stopCascade();
            clearTimeout(autoTimer);
            autoTimer = null;
            clearInterval(timer);
            timer = null;
            started = false;
            won = false;
            score = 0;
            seconds = 0;
            undoStack = [];
            const deck = shuffle(cards.slice());
            deck.forEach(card => { card.up = false; });
            tableau = [[], [], [], [], [], [], []];
            for (let col = 0; col < 7; col++) {
                for (let row = col; row < 7; row++) tableau[row].push(deck.pop());
            }
            tableau.forEach(pile => { top(pile).up = true; });
            foundations = [[], [], [], []];
            waste = [];
            stock = deck;
            updateStatus();
            render();
        }

        function setDraw(three) {
            if (three === drawThree) return;
            drawThree = three;
            store.set('sol.drawThree', three);
            deal();
        }

        function startClock() {
            if (started) return;
            started = true;
            timer = setInterval(() => {
                seconds += 1;
                // Windows docked two points every ten seconds.
                if (seconds % 10 === 0) score = Math.max(0, score - 2);
                updateStatus();
            }, 1000);
        }

        function addScore(points) {
            score = Math.max(0, score + points);
            updateStatus();
        }

        function updateStatus() {
            modeField.textContent = drawThree ? 'Draw Three' : 'Draw One';
            scoreField.textContent = `Score: ${score}`;
            timeField.textContent = `Time: ${seconds}`;
        }

        function snapshot() {
            undoStack.push({
                stock: stock.slice(), waste: waste.slice(),
                foundations: foundations.map(p => p.slice()), tableau: tableau.map(p => p.slice()),
                up: cards.map(c => c.up), score,
            });
            if (undoStack.length > 200) undoStack.shift();
        }

        function undo() {
            const snap = undoStack.pop();
            if (!snap || won) return;
            clearTimeout(autoTimer);
            autoTimer = null;
            stock = snap.stock;
            waste = snap.waste;
            foundations = snap.foundations;
            tableau = snap.tableau;
            cards.forEach((c, i) => { c.up = snap.up[i]; });
            score = snap.score;
            updateStatus();
            render();
        }

        function drawFromStock() {
            startClock();
            if (!stock.length) {
                if (!waste.length) return;
                snapshot();
                stock = waste.reverse();
                waste = [];
                stock.forEach(c => { c.up = false; });
                addScore(drawThree ? -20 : -100);
                render();
                return;
            }
            snapshot();
            const n = drawThree ? 3 : 1;
            for (let i = 0; i < n && stock.length; i++) {
                const card = stock.pop();
                card.up = true;
                waste.push(card);
            }
            render();
        }

        // Moves `group` (cards on top of each other) from its pile to target.
        function move(group, from, target, targetKind) {
            snapshot();
            startClock();
            from.pile.splice(from.pile.length - group.length, group.length);
            target.push(...group);

            if (targetKind === 'foundation') addScore(10);
            else if (from.kind === 'waste') addScore(5);
            if (from.kind === 'foundation' && targetKind === 'tableau') addScore(-15);

            if (from.kind === 'tableau' && from.pile.length && !top(from.pile).up) {
                top(from.pile).up = true;
                addScore(5);
            }
            render();
            checkWin();
        }

        // The best destination for a click: a foundation, then a non-empty
        // tableau pile, then an empty one.
        function bestTarget(group, from) {
            const card = group[0];
            // As in Windows, a click on a foundation card does nothing; it
            // can still be dragged back down.
            if (from.kind === 'foundation') return null;
            if (group.length === 1) {
                const f = foundations.findIndex(p => canFoundation(card, p));
                if (f >= 0) return { pile: foundations[f], kind: 'foundation' };
            }
            const order = [...tableau.keys()].filter(i => !(from.kind === 'tableau' && from.index === i));
            const filled = order.find(i => tableau[i].length && canTableau(card, tableau[i]));
            if (filled !== undefined) return { pile: tableau[filled], kind: 'tableau' };
            // A King already at the bottom of a pile gains nothing by moving.
            if (from.kind === 'tableau' && from.pile[0] === card) return null;
            const empty = order.find(i => !tableau[i].length && canTableau(card, tableau[i]));
            if (empty !== undefined) return { pile: tableau[empty], kind: 'tableau' };
            return null;
        }

        function checkWin() {
            if (foundations.every(p => p.length === 13)) {
                won = true;
                clearInterval(timer);
                if (seconds >= 30) score += Math.round(700000 / seconds);
                updateStatus();
                setTimeout(startCascade, 350);
                return;
            }
            maybeAutoFinish();
        }

        // Once every card is face up and the deck is used up, the rest is a
        // formality: play the remaining cards home one by one.
        let autoTimer = null;
        function maybeAutoFinish() {
            if (stock.length || waste.length || tableau.some(p => p.some(c => !c.up)) || autoTimer) return;
            const step = () => {
                autoTimer = null;
                for (let i = 0; i < 7; i++) {
                    const card = top(tableau[i]);
                    if (!card) continue;
                    const f = foundations.findIndex(p => canFoundation(card, p));
                    if (f >= 0) {
                        tableau[i].pop();
                        foundations[f].push(card);
                        addScore(10);
                        render();
                        if (foundations.every(p => p.length === 13)) {
                            checkWin();
                        } else {
                            autoTimer = setTimeout(step, 70);
                        }
                        return;
                    }
                }
            };
            autoTimer = setTimeout(step, 250);
        }

        // -------------------------------------------------------------------
        // Layout and rendering
        // -------------------------------------------------------------------
        function measure() {
            const W = table.clientWidth;
            const H = table.clientHeight;
            if (!W || !H) return null;
            const cw = clamp(Math.floor((W - 8 * 8) / 7), 30, 90);
            const ch = Math.round(cw * 96 / 71);
            const gap = Math.max(4, Math.floor((W - 7 * cw) / 8));
            const x = col => gap + col * (cw + gap);
            return {
                W, H, cw, ch, gap, x,
                topY: gap,
                tabY: gap * 2 + ch,
                downOff: Math.max(3, Math.round(ch * 0.07)),
                upOff: Math.max(10, Math.round(ch * 0.21)),
                fanX: Math.round(cw * 0.22),
            };
        }

        function place(el, x, y, z) {
            el.x = x;
            el.y = y;
            el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
            el.style.zIndex = z;
        }

        function render() {
            metrics = measure();
            if (!metrics) return;
            const m = metrics;
            table.style.setProperty('--cw', `${m.cw}px`);
            table.style.setProperty('--ch', `${m.ch}px`);

            place(stockSlot, m.x(0), m.topY, 0);
            stockSlot.classList.toggle('can-recycle', !stock.length && waste.length > 0);
            foundationSlots.forEach((el, i) => place(el, m.x(i + 3), m.topY, 0));
            tableauSlots.forEach((el, i) => place(el, m.x(i), m.tabY, 0));

            let z = 1;
            const show = (card, x, y) => {
                card.el.classList.toggle('back', !card.up);
                place(card.el, x, y, z++);
            };

            stock.forEach((card, i) => show(card, m.x(0) + Math.min(2, Math.floor(i / 10)) * 2, m.topY - Math.min(2, Math.floor(i / 10)) * 2));

            const fanStart = drawThree ? Math.max(0, waste.length - 3) : waste.length;
            waste.forEach((card, i) => show(card, m.x(1) + Math.max(0, i - fanStart) * m.fanX, m.topY));

            foundations.forEach((pile, i) => pile.forEach(card => show(card, m.x(i + 3), m.topY)));

            tableau.forEach((pile, i) => {
                // Squeeze a long pile so it still fits above the bottom edge.
                const room = m.H - m.tabY - m.ch - m.gap;
                const downs = pile.filter(c => !c.up).length;
                const ups = Math.max(0, pile.length - downs - 1);
                let upOff = m.upOff;
                if (ups && downs * m.downOff + ups * upOff > room) {
                    upOff = Math.max(6, Math.floor((room - downs * m.downOff) / ups));
                }
                let y = m.tabY;
                pile.forEach(card => {
                    show(card, m.x(i), y);
                    y += card.up ? upOff : m.downOff;
                });
            });
        }

        // -------------------------------------------------------------------
        // Input: drag, or click for the best move
        // -------------------------------------------------------------------
        let drag = null;

        function cardRect(el) {
            const r = el.getBoundingClientRect();
            return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        }

        function overlap(a, b) {
            const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const hgt = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            return w > 0 && hgt > 0 ? w * hgt : 0;
        }

        // Where would the dragged group land? The pile its top card overlaps
        // most, among those that accept it.
        function dropTarget(group, from) {
            const r = cardRect(group[0].el);
            let best = null;
            let bestArea = 0;
            const consider = (pile, kind, el) => {
                if (pile === from.pile) return;
                const ok = kind === 'foundation'
                    ? group.length === 1 && canFoundation(group[0], pile)
                    : canTableau(group[0], pile);
                if (!ok) return;
                const target = cardRect(pile.length ? top(pile).el : el);
                if (kind === 'tableau') target.bottom = Math.max(target.bottom, target.top + metrics.ch);
                const area = overlap(r, target);
                if (area > bestArea) {
                    bestArea = area;
                    best = { pile, kind };
                }
            };
            foundations.forEach((pile, i) => consider(pile, 'foundation', foundationSlots[i]));
            tableau.forEach((pile, i) => consider(pile, 'tableau', tableauSlots[i]));
            return best;
        }

        table.addEventListener('contextmenu', e => e.preventDefault());

        table.addEventListener('pointerdown', e => {
            if (won || e.button > 0) return;
            const cardEl = e.target.closest('.sol-card');
            if (!cardEl) {
                if (e.target === stockSlot) drawFromStock();
                return;
            }
            const card = cards[Number(cardEl.dataset.id)];
            const from = locate(card);
            if (!from) return;
            e.preventDefault();

            if (from.kind === 'stock') {
                drawFromStock();
                return;
            }
            if (!card.up) {
                return;
            }
            if ((from.kind === 'waste' || from.kind === 'foundation') && top(from.pile) !== card) return;

            const group = from.kind === 'tableau' ? from.pile.slice(from.pile.indexOf(card)) : [card];
            if (!metrics) render();
            if (!metrics) return;
            try {
                table.setPointerCapture(e.pointerId);
            } catch (err) { /* pointer already gone */ }
            drag = {
                group, from, moved: false,
                startX: e.clientX, startY: e.clientY,
                origins: group.map(c => ({ x: c.el.x, y: c.el.y })),
            };
        });

        table.addEventListener('pointermove', e => {
            if (!drag) return;
            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
            if (!drag.moved) {
                drag.moved = true;
                drag.group.forEach(c => c.el.classList.add('dragging'));
            }
            drag.group.forEach((c, i) => place(c.el, drag.origins[i].x + dx, drag.origins[i].y + dy, 1000 + i));
        });

        const endDrag = e => {
            if (!drag) return;
            const { group, from, moved } = drag;
            drag = null;
            group.forEach(c => c.el.classList.remove('dragging'));
            if (e.type === 'pointercancel') {
                render();
                return;
            }
            const target = moved ? dropTarget(group, from) : bestTarget(group, from);
            if (target) move(group, from, target.pile, target.kind);
            else render();
        };
        table.addEventListener('pointerup', endDrag);
        table.addEventListener('pointercancel', endDrag);

        app.el.addEventListener('keydown', e => {
            if (e.key === 'F2') {
                e.preventDefault();
                deal();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
            }
        });

        // -------------------------------------------------------------------
        // The finale: cards bounce off the foundations, leaving trails.
        // -------------------------------------------------------------------
        let cascade = null;

        function drawCard(ctx, card, w, hgt) {
            const suit = SUITS[card.suit];
            const color = suit.red ? '#d00000' : '#000';
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, hgt);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeRect(0.5, 0.5, w - 1, hgt - 1);
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const corner = Math.max(9, Math.round(w * 0.17));
            ctx.font = `bold ${corner}px Arial, sans-serif`;
            ctx.fillText(RANKS[card.rank], corner * 0.7, corner * 0.75);
            ctx.fillText(suit.glyph, corner * 0.7, corner * 1.8);
            const big = card.rank === 1 || card.rank > 10;
            if (big) {
                ctx.font = `bold ${Math.round(w * (card.rank === 1 ? 0.45 : 0.4))}px Georgia, serif`;
                ctx.fillText(card.rank === 1 ? suit.glyph : RANKS[card.rank], w / 2, hgt / 2);
            } else {
                ctx.font = `${Math.round(w * 0.2)}px Arial, sans-serif`;
                const ix = w * 0.18;
                const iy = hgt * 0.1;
                PIPS[card.rank].forEach(([x, y]) => ctx.fillText(suit.glyph, ix + x * (w - 2 * ix), iy + y * (hgt - 2 * iy)));
            }
        }

        function startCascade() {
            if (!metrics) return;
            const canvas = h('canvas', { class: 'sol-cascade' });
            const ratio = window.devicePixelRatio || 1;
            canvas.width = Math.round(metrics.W * ratio);
            canvas.height = Math.round(metrics.H * ratio);
            canvas.style.width = `${metrics.W}px`;
            canvas.style.height = `${metrics.H}px`;
            table.appendChild(canvas);
            const ctx = canvas.getContext('2d');
            ctx.scale(ratio, ratio);

            // Pre-render each card once.
            const sprite = card => {
                const off = document.createElement('canvas');
                off.width = Math.round(metrics.cw * ratio);
                off.height = Math.round(metrics.ch * ratio);
                const octx = off.getContext('2d');
                octx.scale(ratio, ratio);
                drawCard(octx, card, metrics.cw, metrics.ch);
                return off;
            };

            // Kings first, from the rightmost foundation, down to the Aces.
            const queue = [];
            for (let rank = 13; rank >= 1; rank--) {
                for (let f = 3; f >= 0; f--) queue.push({ card: foundations[f][rank - 1], f });
            }

            let current = null;
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            cascade = { canvas, frame: 0 };

            const launch = () => {
                const next = queue.shift();
                if (!next) {
                    finishCascade();
                    return;
                }
                next.card.el.style.visibility = 'hidden';
                let vx = (Math.random() * 5 + 2) * (Math.random() < 0.5 ? -1 : 1);
                current = {
                    img: sprite(next.card),
                    x: metrics.x(next.f + 3), y: metrics.topY,
                    vx, vy: -(Math.random() * 6 + 1),
                };
            };

            const tick = () => {
                if (!cascade || cascade.done) return;
                if (!current) launch();
                if (!cascade || cascade.done) return;
                for (let step = 0; step < (reduced ? 40 : 1) && current; step++) {
                    current.vy += 0.5;
                    current.x += current.vx;
                    current.y += current.vy;
                    if (current.y + metrics.ch > metrics.H) {
                        current.y = metrics.H - metrics.ch;
                        current.vy = -current.vy * 0.75;
                    }
                    if (!reduced) ctx.drawImage(current.img, current.x, current.y, metrics.cw, metrics.ch);
                    if (current.x < -metrics.cw || current.x > metrics.W) current = null;
                }
                cascade.frame = requestAnimationFrame(tick);
            };
            cascade.frame = requestAnimationFrame(tick);
        }

        function stopCascade() {
            if (!cascade) return;
            cancelAnimationFrame(cascade.frame);
            cascade.canvas.remove();
            cascade = null;
            cards.forEach(c => { c.el.style.visibility = ''; });
        }

        function finishCascade() {
            if (!cascade || cascade.done) return;
            cancelAnimationFrame(cascade.frame);
            cascade.done = true;
            WM.messageBox({
                title: 'Solitaire', icon: 'question',
                text: [`You won with ${score} points in ${seconds} seconds.`, 'Deal again?'],
                buttons: ['Yes', 'No'],
            }).then(answer => {
                if (answer === 'Yes') deal();
            });
        }

        // Clicking during the finale skips it.
        table.addEventListener('pointerdown', () => {
            if (won && cascade && !cascade.done) finishCascade();
        });

        app.layout = render;
        app.deal = deal;
        app.isDealt = () => stock.length + waste.length + tableau.flat().length + foundations.flat().length === 52;
        app.pause = () => {
            clearInterval(timer);
            timer = null;
            if (started && !won) started = false;
        };
        deal();
    },
    onOpen(args, app) {
        app.layout();
    },
    onResize(app) {
        app.layout();
    },
    onClose(app) {
        app.pause();
    },
});

// Keep the table laid out when the browser window changes size.
window.addEventListener('resize', () => {
    const app = WM.get('solitaire');
    if (app && app.layout && app.state === 'open') app.layout();
});
