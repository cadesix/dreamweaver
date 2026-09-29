import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Window } from "happy-dom";
import { buildOverlay } from "../server/build.mjs";

let bundle = null;

/** The overlay as the page gets it: bundled, to a temp file, never over dist/. */
export async function overlayCode() {
	if (bundle) return bundle;
	const out = join(mkdtempSync(join(tmpdir(), "dreamweaver-")), "overlay.js");
	const result = await buildOverlay({ out });
	if (!result.ok) throw new Error(result.error);
	bundle = result.code;
	return bundle;
}

/** A page with the overlay loaded, and handles on its shadow-root UI. */
export async function loadPage(html) {
	const window = new Window({ url: "http://localhost:3000/some/page", width: 1280, height: 800 });
	const { document } = window;
	document.body.innerHTML = html;
	window.console.log = () => {};
	window.eval(await overlayCode());
	const host = [...document.documentElement.children].find((el) => el.shadowRoot);
	const root = host.shadowRoot;
	const tick = (ms = 20) => new Promise((done) => setTimeout(done, ms));
	return {
		window,
		document,
		host,
		root,
		dock: () => root.querySelector(".dock"),
		card: root.querySelector(".card"),
		ring: root.querySelector(".ring"),
		tick,
		/** A real page click: bubbles and can be cancelled, the way the overlay intercepts it. */
		click: (el, extra = {}) =>
			el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, ...extra })),
		key: (key, extra = {}) => window.dispatchEvent(new window.KeyboardEvent("keydown", { key, ...extra })),
		close: () => window.happyDOM.close(),
	};
}
