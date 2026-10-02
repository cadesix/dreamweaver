/**
 * dreamweaver — the in-page half.
 *
 * Loaded into any localhost page by the Chrome extension, so it assumes nothing
 * about the page it lands in:
 *
 * 1. It must not touch the page's styles, and the page's styles must not reach
 *    it. Everything it draws lives in a shadow root — a Tailwind reset or a
 *    global `button { }` would otherwise eat the UI.
 * 2. It must not get in the way of using the page. Selecting is a MODE, turned
 *    on with the cursor (or ⌥H) and off the same way; outside it the page
 *    behaves exactly as it did.
 *
 * One dock in the corner: a pixel cursor. Clicking it turns on selecting —
 * hover outlines, click picks, Shift-click picks several. A card opens beside the picked element with a
 * shelf of tools above a note input; a tool swaps its controls in for the note
 * and the page repaints live. Every edit is tracked, so a note says exactly
 * what changed as well as what you typed. Nothing edits the code: a note is how
 * a change reaches a repo, through Build and /notes.
 */
import { createEdits } from "./edits.js";
import { cursorSvg, icon, OPTION_KEYS, TOOLS } from "./icons.js";
import { createQueue } from "./queue.js";
import { componentPath, selectorOf, sourceOf } from "./source.js";
import { STYLES } from "./styles.js";
import { colorSection } from "./tools/color.js";
import { radiusSection } from "./tools/radius.js";
import { textSection } from "./tools/text.js";

/* Stamped by the build: which bundle this page is running, for `/health` to compare. */
const VERSION = typeof __DREAMWEAVER_VERSION__ === "string" ? __DREAMWEAVER_VERSION__ : "dev";

const SECTIONS = { color: colorSection, text: textSection, radius: radiusSection };

(() => {
	if (window.__annotate) return;
	window.__annotate = true;

	const ORIGIN = document.currentScript?.src
		? new URL(document.currentScript.src).origin
		: "http://localhost:4747";

	const queue = createQueue({ origin: ORIGIN });
	const notes = queue.notes;
	const edits = createEdits();

	// ── the shadow root ─────────────────────────────────────────────────────

	const host = document.createElement("div");
	host.dataset.dreamweaver = VERSION;
	host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";
	const root = host.attachShadow({ mode: "open" });
	root.innerHTML = `<style>${STYLES}</style>
		<div class="ring" hidden></div>
		<div class="pins"></div>
		<div class="marks"></div>
		<div class="card" hidden></div>
		<button class="build" hidden>Build</button>
		<div class="dock"></div>`;
	document.documentElement.appendChild(host);

	const ring = root.querySelector(".ring");
	const pins = root.querySelector(".pins");
	const marks = root.querySelector(".marks");
	const card = root.querySelector(".card");
	const dock = root.querySelector(".dock");
	const build = root.querySelector(".build");

	// ── state ───────────────────────────────────────────────────────────────

	/* Selecting on or off. Not persisted: a page that loads already selecting
	   would eat its first click with nothing on screen to say why. */
	let open = false;
	/* Selecting on behalf of another tool (see "picking for another tool"). */
	let lending = false;
	let hovered = null;
	/** The tool the next pick opens on, chosen from the dock beforehand. */
	let preferred = "note";
	/* What the card is open on: one element, or several picked with Shift. Tools
	   start from the first one's values and edit all of them together. */
	let selection = [];
	const primary = () => selection[0] ?? null;
	let view = null;
	let draft = "";
	/* Where the card was dragged to, kept until it closes so it stays out of the
	   way of the thing being edited. */
	let moved = null;

	function setOpen(next) {
		open = next;
		hovered = null;
		ring.hidden = true;
		document.body.style.cursor = open ? "crosshair" : "";
		if (!open) {
			deselect();
			preferred = "note";
		}
		drawDock();
	}

	/** A tool from the dock: switch the open card to it, or open on it next pick. */
	function chooseTool(tool) {
		if (!open) setOpen(true);
		if (selection.length > 0) {
			showTool(tool);
			return;
		}
		preferred = tool;
		drawDock();
	}

	function showTool(tool) {
		view = tool;
		drawCard();
		drawDock();
		if (tool === "note") card.querySelector("textarea")?.focus();
	}

	// ── the dock ────────────────────────────────────────────────────────────

	function drawDock() {
		dock.innerHTML = "";
		const active = selection.length > 0 ? view : preferred;
		// Lent out, the cursor alone says selecting is on; the tools aren't in play.
		if (open && !lending) {
			for (const tool of TOOLS) {
				const button = document.createElement("button");
				button.innerHTML = icon(tool.id);
				button.title = `${tool.label} (⌥${tool.key.toUpperCase()})`;
				button.dataset.tool = tool.id;
				button.dataset.on = String(active === tool.id);
				button.onclick = () => chooseTool(tool.id);
				dock.appendChild(button);
			}
			const sep = document.createElement("span");
			sep.className = "sep";
			dock.appendChild(sep);
			const status = document.createElement("span");
			if (selection.length === 0) {
				status.className = "hint";
				status.textContent = "Click an element";
			} else {
				status.className = "count";
				status.textContent = `${notes.length} note${notes.length === 1 ? "" : "s"}`;
			}
			dock.appendChild(status);
		}
		const toggle = document.createElement("button");
		toggle.className = "cursor";
		toggle.innerHTML = cursorSvg();
		toggle.title = open ? "Stop selecting (⌥H)" : "Select an element (⌥H)";
		toggle.dataset.on = String(open);
		toggle.onclick = () => (lending ? lend(false) : setOpen(!open));
		if (!open && notes.length > 0) {
			// Folded is not empty: a batch forgotten about goes to the wrong session later.
			const bubble = document.createElement("span");
			bubble.className = "bubble";
			bubble.textContent = String(notes.length);
			toggle.appendChild(bubble);
		}
		dock.appendChild(toggle);
		/* Nothing to build with no notes, and nothing mid-edit: offering to ship
		   while a card is open invites a half batch. */
		build.hidden = notes.length === 0 || selection.length > 0;
		build.textContent = "Build";
		build.disabled = false;
	}

	function drawPins() {
		pins.innerHTML = "";
		notes.forEach((note, index) => {
			const pin = document.createElement("div");
			pin.className = "pin";
			pin.style.left = `${note.box.x + note.box.w - 10}px`;
			pin.style.top = `${note.box.y - 10}px`;
			pin.textContent = String(index + 1);
			pin.title = `${note.text}\n\n(click to remove)`;
			pin.onclick = () => {
				queue.remove(index);
				drawPins();
				drawDock();
			};
			pins.appendChild(pin);
		});
	}

	// ── selecting ───────────────────────────────────────────────────────────

	/**
	 * A click picks one element; a Shift-click adds one, or takes it back out if
	 * it was already picked. Adding keeps the tool and the note in progress.
	 */
	function select(el, additive = false) {
		if (additive && selection.length > 0) {
			selection = selection.includes(el) ? selection.filter((item) => item !== el) : [...selection, el];
			if (selection.length === 0) return deselect();
		} else {
			selection = [el];
			view = preferred;
			draft = "";
		}
		edits.still(selection);
		// The outline was for finding it; while editing it would sit on the change.
		hovered = null;
		ring.hidden = true;
		drawMarks();
		drawCard();
		drawDock();
		if (!additive && view === "note") card.querySelector("textarea")?.focus();
	}

	/** The edits stay on the page; only the card goes. */
	function deselect() {
		selection = [];
		view = null;
		moved = null;
		edits.release();
		card.hidden = true;
		card.innerHTML = "";
		drawMarks();
		drawDock();
	}

	/* With several picked, a small dot marks each one at its corner — never an
	   outline over the thing being changed. One pick needs no marker. */
	function drawMarks() {
		marks.innerHTML = "";
		if (selection.length < 2) return;
		for (const el of selection) {
			const box = el.getBoundingClientRect();
			const mark = document.createElement("div");
			mark.className = "mark";
			mark.style.left = `${box.x}px`;
			mark.style.top = `${box.y}px`;
			marks.appendChild(mark);
		}
	}

	function outline(el) {
		const box = el.getBoundingClientRect();
		Object.assign(ring.style, {
			left: `${box.x}px`,
			top: `${box.y}px`,
			width: `${box.width}px`,
			height: `${box.height}px`,
		});
		ring.hidden = false;
	}

	/** Beside the element, on whichever side has room, kept on screen — unless dragged. */
	function placeCard() {
		const anchor = selection.at(-1);
		if (!anchor) return;
		const width = 280;
		const height = card.offsetHeight || 300;
		if (moved) {
			card.style.left = `${Math.min(window.innerWidth - width - 8, Math.max(8, moved.left))}px`;
			card.style.top = `${Math.min(window.innerHeight - 40, Math.max(8, moved.top))}px`;
			return;
		}
		// Beside the most recent pick, which is where the eye just was.
		const box = anchor.getBoundingClientRect();
		let left = box.right + 12;
		if (left + width > window.innerWidth - 8) left = box.left - width - 12;
		if (left < 8) left = Math.min(window.innerWidth - width - 8, Math.max(8, box.left));
		const top = Math.max(8, Math.min(box.top, window.innerHeight - height - 76));
		card.style.left = `${left}px`;
		card.style.top = `${top}px`;
	}

	/** The card's header is its handle. */
	function draggable(handle) {
		handle.onpointerdown = (event) => {
			if (event.target.closest?.("button")) return;
			event.preventDefault();
			handle.setPointerCapture?.(event.pointerId);
			const start = { x: event.clientX, y: event.clientY, left: card.offsetLeft, top: card.offsetTop };
			handle.onpointermove = (e) => {
				moved = { left: start.left + e.clientX - start.x, top: start.top + e.clientY - start.y };
				placeCard();
			};
			handle.onpointerup = () => {
				handle.onpointermove = null;
			};
		};
	}

	// ── the card ────────────────────────────────────────────────────────────

	function drawCard() {
		const el = primary();
		if (!el) return;
		const name =
			selection.length > 1
				? `${selection.length} elements`
				: (componentPath(el)?.split(" › ").pop() ?? el.tagName.toLowerCase());
		const title = selection.map((item) => selectorOf(item)).join("\n");
		card.innerHTML = `
			<div class="card-head" title="Drag to move">
				<b title="${title.replace(/"/g, "&quot;")}">${name}</b>
				<button class="x" data-act="close" title="Close (esc)">✕</button></div>
			<div class="shelf">${TOOLS.map((tool) => `<button data-tool="${tool.id}" data-on="${tool.id === view}" title="${tool.label} (⌥${tool.key.toUpperCase()})">${icon(tool.id)}<span>${tool.label}</span></button>`).join("")}</div>`;
		for (const button of card.querySelectorAll(".shelf [data-tool]")) {
			button.onclick = () => showTool(button.dataset.tool);
		}
		const context = {
			el,
			els: selection,
			root,
			/* Every edit lands on every picked element (or just `targets`). */
			set: (prop, value, shown, targets = selection) => {
				for (const target of targets) edits.set(target, prop, value, shown);
			},
			reset: (props) => {
				for (const target of selection) edits.reset(target, props);
			},
			changed: drawChanges,
			redraw: drawCard,
			addNote,
		};
		card.appendChild(view === "note" ? noteSection() : SECTIONS[view](context));
		card.hidden = false;
		card.querySelector('[data-act="close"]').onclick = deselect;
		draggable(card.querySelector(".card-head"));
		placeCard();
	}

	function noteSection() {
		const section = document.createElement("div");
		section.className = "section note";
		section.innerHTML = `
			<textarea placeholder="What should change?"></textarea>
			<div class="changes" hidden></div>
			<div class="row"><button class="btn dark wide" data-act="add">Add note</button></div>`;
		const field = section.querySelector("textarea");
		field.value = draft;
		field.oninput = () => {
			draft = field.value;
		};
		field.onkeydown = (event) => {
			event.stopPropagation();
			if (event.key === "Enter" && !event.shiftKey) {
				event.preventDefault();
				void addNote();
			}
			if (event.key === "Escape") deselect();
		};
		section.querySelector('[data-act="add"]').onclick = () => void addNote();
		drawChanges(section);
		return section;
	}

	/** What the tools have changed so far, shown under the note it will ride along with. */
	function drawChanges(scope = card) {
		const list = scope.querySelector?.(".changes");
		const el = primary();
		if (!list || !el) return;
		const text = edits.describe(el) + (selection.length > 1 && edits.describe(el) ? `\n(on all ${selection.length})` : "");
		list.textContent = text;
		list.hidden = !text;
	}

	/**
	 * A note per picked element: what was typed, plus that element's own tracked
	 * changes — so each still points at exactly one thing in the batch file.
	 */
	async function addNote() {
		if (selection.length === 0) return;
		const picked = [...selection];
		const typed = draft.trim();
		if (!typed && picked.every((el) => !edits.describe(el))) return deselect();
		const together = picked.length > 1 ? `(One of ${picked.length} elements edited together.)` : "";
		for (const el of picked) {
			const changes = edits.describe(el);
			const box = el.getBoundingClientRect();
			queue.add({
				text: [typed, changes ? `Changes:\n${changes}` : "", together].filter(Boolean).join("\n\n"),
				box: { x: box.x, y: box.y, w: box.width, h: box.height },
				tag: el.tagName.toLowerCase(),
				label: (el.innerText ?? "").trim().slice(0, 80) || null,
				component: componentPath(el),
				selector: selectorOf(el),
				source: await sourceOf(el),
			});
			edits.settle(el);
		}
		drawPins();
		deselect();
	}

	// ── sending ─────────────────────────────────────────────────────────────

	build.onclick = async () => {
		if (notes.length === 0) return;
		build.disabled = true;
		build.textContent = "Sending…";
		try {
			await queue.send();
			drawPins();
			build.textContent = "Sent ✓";
			setTimeout(drawDock, 2000);
		} catch (error) {
			build.textContent = "Failed";
			build.title = error.message;
			build.disabled = false;
			setTimeout(drawDock, 3200);
		}
	};

	// ── picking for another tool ────────────────────────────────────────────

	/*
	 * Another extension (pilot) can borrow just the picking: `dreamweaver:pick`
	 * with detail "start" turns selecting on without the tools or the card, and
	 * each pick goes back as `dreamweaver:picked` instead of opening a card. A
	 * click picks one and ends it, Shift-click keeps going; Esc, the cursor or
	 * "stop" end it, announced as `dreamweaver:pick-ended`. Window events are the
	 * one channel an extension's isolated world shares with the page, and only
	 * strings survive the crossing, so details are JSON.
	 */
	function lend(next) {
		if (lending === next) return;
		if (next && open) setOpen(false); // drop any card of our own first
		lending = next;
		setOpen(next);
		if (!next) dispatchEvent(new CustomEvent("dreamweaver:pick-ended"));
	}

	async function report(el) {
		const detail = {
			tag: el.tagName.toLowerCase(),
			label: (el.innerText ?? "").trim().slice(0, 80) || null,
			component: componentPath(el),
			selector: selectorOf(el),
			source: await sourceOf(el),
		};
		dispatchEvent(new CustomEvent("dreamweaver:picked", { detail: JSON.stringify(detail) }));
	}

	addEventListener("dreamweaver:pick", (event) => lend(event.detail !== "stop"));

	/* The borrowing tool's own UI sits in the page too; it marks itself so it is never picked. */
	const theirs = (el) => Boolean(el?.closest?.("[data-dreamweaver-ignore]"));

	// ── input ───────────────────────────────────────────────────────────────

	/* Hover outlines what a click would pick — never the tools themselves, and
	   the outline goes whenever the pointer is over them so it never lingers on
	   the element being edited. */
	addEventListener(
		"mousemove",
		(event) => {
			if (!open) return;
			const target = document.elementFromPoint(event.clientX, event.clientY);
			if (!target || target === host || host.contains(target) || theirs(target)) {
				hovered = null;
				ring.hidden = true;
				return;
			}
			if (target === hovered) return;
			hovered = target;
			outline(target);
		},
		true,
	);

	/*
	 * Capture phase and `stopPropagation`, so a click that means "pick this"
	 * never also means "submit this form". While selecting is on, any click on
	 * the page picks — including a different element with a card already open.
	 */
	addEventListener(
		"click",
		(event) => {
			// Anything inside the tools' own shadow root is theirs, whatever the retargeting.
			if (!open || event.composedPath().includes(host) || theirs(event.target)) return;
			event.preventDefault();
			event.stopPropagation();
			if (lending) {
				// Report first: the borrower stops listening once picking ends.
				const done = !event.shiftKey;
				report(event.target)
					.catch((error) => console.warn("dreamweaver: pick report failed", error))
					.finally(() => done && lend(false));
				return;
			}
			select(event.target, event.shiftKey);
		},
		true,
	);

	addEventListener("keydown", (event) => {
		const key = OPTION_KEYS[event.key] ?? event.key?.toLowerCase();
		if (event.altKey && key === "h") {
			event.preventDefault();
			if (lending) lend(false);
			else setOpen(!open);
			return;
		}
		if (lending) {
			if (event.key === "Escape") lend(false);
			return;
		}
		const tool = event.altKey ? TOOLS.find((t) => t.key === key) : null;
		if (tool) {
			event.preventDefault();
			chooseTool(tool.id);
		} else if (event.key === "Escape") {
			// First the card, then selecting itself.
			if (selection.length > 0) deselect();
			else if (open) setOpen(false);
		}
	});

	/* Pins and the card sit in viewport coordinates, so they follow the page. */
	const follow = () => {
		drawPins();
		drawMarks();
		if (selection.length > 0) placeCard();
	};
	addEventListener("scroll", follow, true);
	addEventListener("resize", follow);

	/* Anything queued last time comes back before the first paint of the dock. */
	queue.restore();
	drawPins();
	drawDock();
	if (notes.length > 0) {
		console.log(`dreamweaver: ${notes.length} note${notes.length === 1 ? "" : "s"} restored from the last visit`);
	}
	console.log(`dreamweaver ${VERSION}: ⌥H select · ⌥A note · ⌥C color · ⌥T text · ⌥R corners`);
})();
