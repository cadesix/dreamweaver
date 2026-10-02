import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { loadPage } from "./helpers.mjs";

const PAGE = `
	<div id="a" style="font-size:14px;font-weight:400;border-radius:8px">Alpha</div>
	<div id="b" style="font-size:20px">Beta</div>
	<button id="submit" type="button">Submit</button>`;

let page;
afterEach(async () => {
	await page?.close();
	page = null;
});

describe("the dock", () => {
	it("starts folded to the cursor, and never starts selecting", async () => {
		page = await loadPage(PAGE);
		const buttons = page.dock().querySelectorAll("button");
		assert.equal(buttons.length, 1);
		assert.equal(buttons[0].className, "cursor");
		assert.equal(page.dock().querySelector(".hint"), null);
	});

	it("turns selecting on from the cursor, with the tools beside it", async () => {
		page = await loadPage(PAGE);
		page.dock().querySelector(".cursor").click();
		assert.equal(page.dock().querySelector(".hint").textContent, "Click an element");
		assert.deepEqual(
			[...page.dock().querySelectorAll("[data-tool]")].map((b) => b.dataset.tool),
			["note", "color", "text", "radius"],
		);
	});

	it("leaves the page alone while folded: clicks reach it", async () => {
		page = await loadPage(PAGE);
		let clicked = 0;
		page.document.getElementById("submit").addEventListener("click", () => clicked++);
		page.click(page.document.getElementById("submit"));
		assert.equal(clicked, 1);
		assert.equal(page.card.hidden, true);
	});
});

describe("picking an element", () => {
	it("opens the card on the note, with the shelf above it and no outline left behind", async () => {
		page = await loadPage(PAGE);
		page.dock().querySelector(".cursor").click();
		page.click(page.document.getElementById("a"));
		await page.tick();
		assert.equal(page.card.hidden, false);
		assert.equal(page.card.querySelectorAll(".shelf [data-tool]").length, 4);
		assert.ok(page.card.querySelector("textarea"));
		assert.equal(page.ring.hidden, true);
	});

	it("swallows the click, so picking never also triggers the page", async () => {
		page = await loadPage(PAGE);
		let clicked = 0;
		page.document.getElementById("submit").addEventListener("click", () => clicked++);
		page.dock().querySelector(".cursor").click();
		page.click(page.document.getElementById("submit"));
		assert.equal(clicked, 0);
	});

	it("opens straight on a tool chosen from the dock first", async () => {
		page = await loadPage(PAGE);
		page.dock().querySelector(".cursor").click();
		page.dock().querySelector('[data-tool="radius"]').click();
		page.click(page.document.getElementById("a"));
		await page.tick();
		assert.equal(page.card.querySelector("textarea"), null);
		assert.equal(page.card.querySelectorAll("[data-r]").length, 7);
	});

	it("picks another element while a card is open", async () => {
		page = await loadPage(PAGE);
		page.dock().querySelector(".cursor").click();
		page.click(page.document.getElementById("a"));
		page.click(page.document.getElementById("b"));
		await page.tick();
		assert.equal(page.card.hidden, false);
		assert.equal(page.card.querySelector("textarea").value, "");
	});
});

describe("the tools", () => {
	it("swaps a tool's controls in for the note, and edits the page live", async () => {
		page = await loadPage(PAGE);
		const a = page.document.getElementById("a");
		page.dock().querySelector(".cursor").click();
		page.click(a);
		await page.tick();
		page.card.querySelector('.shelf [data-tool="text"]').click();
		assert.equal(page.card.querySelector("textarea"), null);
		page.card.querySelector('[data-w="700"]').click();
		assert.equal(a.style.getPropertyValue("font-weight"), "700");
		page.card.querySelector('.shelf [data-tool="radius"]').click();
		page.card.querySelector('[data-r="16"]').click();
		assert.equal(a.style.getPropertyValue("border-radius"), "16px");
	});

	it("resets only the tool's own properties, back to what the page had", async () => {
		page = await loadPage(PAGE);
		const a = page.document.getElementById("a");
		page.dock().querySelector(".cursor").click();
		page.dock().querySelector('[data-tool="text"]').click();
		page.click(a);
		await page.tick();
		page.card.querySelector('[data-w="700"]').click();
		page.card.querySelector('[data-act="reset"]').click();
		assert.equal(a.style.getPropertyValue("font-weight"), "400");
		assert.notEqual(a.style.getPropertyPriority("font-weight"), "important");
	});

	it("stills the element's transitions while it is picked, and restores them after", async () => {
		page = await loadPage(PAGE);
		const a = page.document.getElementById("a");
		a.style.transition = "all 200ms";
		page.dock().querySelector(".cursor").click();
		page.click(a);
		await page.tick();
		assert.equal(a.style.getPropertyValue("transition"), "none");
		page.key("Escape");
		assert.equal(a.style.getPropertyValue("transition"), "all 200ms");
	});
});

describe("notes", () => {
	it("carries the typed text and every tracked change, then closes the card", async () => {
		page = await loadPage(PAGE);
		const a = page.document.getElementById("a");
		page.dock().querySelector(".cursor").click();
		page.click(a);
		await page.tick();
		page.card.querySelector('.shelf [data-tool="text"]').click();
		page.card.querySelector('[data-w="700"]').click();
		page.card.querySelector('.shelf [data-tool="note"]').click();
		const field = page.card.querySelector("textarea");
		field.value = "Make this pop";
		field.dispatchEvent(new page.window.Event("input"));
		assert.match(page.card.querySelector(".changes").textContent, /font-weight: 400 → 700/);
		page.card.querySelector('[data-act="add"]').click();
		await page.tick(40);
		assert.equal(page.card.hidden, true);
		const pin = page.root.querySelector(".pin");
		assert.ok(pin);
		assert.equal(pin.title.split("\n\n(click")[0], "Make this pop\n\nChanges:\nfont-weight: 400 → 700");
	});

	it("survives a reload: the queue comes back from storage", async () => {
		page = await loadPage(PAGE);
		page.dock().querySelector(".cursor").click();
		page.click(page.document.getElementById("a"));
		await page.tick();
		const field = page.card.querySelector("textarea");
		field.value = "Keep me";
		field.dispatchEvent(new page.window.Event("input"));
		page.card.querySelector('[data-act="add"]').click();
		await page.tick(40);
		const saved = page.window.localStorage.getItem("__annotate_draft:/some/page");
		assert.equal(JSON.parse(saved)[0].text, "Keep me");
	});
});

describe("picking several with Shift", () => {
	it("adds with Shift-click, takes back out with a second one, and marks each pick", async () => {
		page = await loadPage(PAGE);
		const [a, b] = ["a", "b"].map((id) => page.document.getElementById(id));
		page.dock().querySelector(".cursor").click();
		page.click(a);
		page.click(b, { shiftKey: true });
		await page.tick();
		assert.equal(page.card.querySelector(".card-head b").textContent, "2 elements");
		assert.equal(page.root.querySelectorAll(".mark").length, 2);
		page.click(b, { shiftKey: true });
		await page.tick();
		assert.notEqual(page.card.querySelector(".card-head b").textContent, "2 elements");
		assert.equal(page.root.querySelectorAll(".mark").length, 0);
	});

	it("edits every picked element together, and a plain click starts over", async () => {
		page = await loadPage(PAGE);
		const [a, b] = ["a", "b"].map((id) => page.document.getElementById(id));
		page.dock().querySelector(".cursor").click();
		page.dock().querySelector('[data-tool="radius"]').click();
		page.click(a);
		page.click(b, { shiftKey: true });
		await page.tick();
		page.card.querySelector('[data-r="12"]').click();
		assert.equal(a.style.getPropertyValue("border-radius"), "12px");
		assert.equal(b.style.getPropertyValue("border-radius"), "12px");
		page.click(b);
		await page.tick();
		assert.equal(page.root.querySelectorAll(".mark").length, 0);
	});

	it("adds one note per picked element, each with its own changes", async () => {
		page = await loadPage(PAGE);
		const [a, b] = ["a", "b"].map((id) => page.document.getElementById(id));
		page.dock().querySelector(".cursor").click();
		page.dock().querySelector('[data-tool="text"]').click();
		page.click(a);
		page.click(b, { shiftKey: true });
		await page.tick();
		page.card.querySelector('[data-w="700"]').click();
		page.card.querySelector('[data-act="note"]').click();
		await page.tick(40);
		const pins = [...page.root.querySelectorAll(".pin")];
		assert.equal(pins.length, 2);
		assert.match(pins[0].title, /font-weight: 400 → 700/);
		assert.match(pins[1].title, /One of 2 elements edited together/);
		assert.equal(a.style.getPropertyValue("transition"), "");
	});
});

describe("keys", () => {
	it("Esc closes the card first, then stops selecting", async () => {
		page = await loadPage(PAGE);
		page.dock().querySelector(".cursor").click();
		page.click(page.document.getElementById("a"));
		await page.tick();
		page.key("Escape");
		assert.equal(page.card.hidden, true);
		assert.ok(page.dock().querySelector(".hint"));
		page.key("Escape");
		assert.equal(page.dock().querySelectorAll("button").length, 1);
	});

	it("⌥ letters choose tools, including the characters a Mac types for them", async () => {
		page = await loadPage(PAGE);
		page.key("ç", { altKey: true });
		assert.equal(page.dock().querySelector('[data-tool="color"]').dataset.on, "true");
	});
});

describe("picking for another tool", () => {
	const listen = (page) => {
		const got = { picked: [], ended: 0, order: [] };
		page.window.addEventListener("dreamweaver:picked", (e) => {
			got.picked.push(JSON.parse(e.detail));
			got.order.push("picked");
		});
		page.window.addEventListener("dreamweaver:pick-ended", () => {
			got.ended++;
			got.order.push("ended");
		});
		return got;
	};
	const start = (page) => page.window.dispatchEvent(new page.window.CustomEvent("dreamweaver:pick", { detail: "start" }));

	it("selects with the cursor alone: no tools, and a pick reports instead of opening the card", async () => {
		page = await loadPage(PAGE);
		const got = listen(page);
		start(page);
		assert.equal(page.dock().querySelectorAll("[data-tool]").length, 0);
		assert.equal(page.dock().querySelector(".cursor").dataset.on, "true");
		page.click(page.document.getElementById("submit"));
		await page.tick();
		assert.equal(page.card.hidden, true);
		assert.equal(got.picked.length, 1);
		assert.equal(got.picked[0].tag, "button");
		assert.equal(got.picked[0].label, "Submit");
		assert.equal(got.picked[0].selector, "#submit");
		assert.equal(got.ended, 1);
		assert.deepEqual(got.order, ["picked", "ended"]);
		assert.equal(page.dock().querySelector(".cursor").dataset.on, "false");
	});

	it("keeps picking with Shift, and swallows the clicks", async () => {
		page = await loadPage(PAGE);
		const got = listen(page);
		let clicked = 0;
		page.document.getElementById("submit").addEventListener("click", () => clicked++);
		start(page);
		page.click(page.document.getElementById("a"), { shiftKey: true });
		page.click(page.document.getElementById("submit"), { shiftKey: true });
		await page.tick();
		assert.deepEqual(got.picked.map((p) => p.selector), ["#a", "#submit"]);
		assert.equal(clicked, 0);
		assert.equal(got.ended, 0);
		page.key("Escape");
		assert.equal(got.ended, 1);
	});

	it("never picks the borrowing tool's own UI", async () => {
		page = await loadPage(`${PAGE}<pilot-tab data-dreamweaver-ignore><span id="tab">tab</span></pilot-tab>`);
		const got = listen(page);
		start(page);
		page.click(page.document.getElementById("tab"));
		await page.tick();
		assert.equal(got.picked.length, 0);
		assert.equal(got.ended, 0);
	});

	it("stops on request", async () => {
		page = await loadPage(PAGE);
		const got = listen(page);
		start(page);
		page.window.dispatchEvent(new page.window.CustomEvent("dreamweaver:pick", { detail: "stop" }));
		assert.equal(got.ended, 1);
		page.click(page.document.getElementById("a"));
		await page.tick();
		assert.equal(got.picked.length, 0);
	});
});
