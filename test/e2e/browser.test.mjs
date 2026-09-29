/**
 * The tools in real Chrome: the one place colors paint, pointer drags carry
 * real coordinates, and the shadow root behaves exactly as it will on a page.
 * Uses the installed Google Chrome (playwright-core, channel "chrome"), so
 * nothing is downloaded.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { chromium } from "playwright-core";
import { startServer } from "../../server/server.mjs";

const quiet = { log() {}, error() {} };
let sink;
let site;
let browser;
let fallbackRoot;

function listen(server) {
	return new Promise((ready) => server.listen(0, "127.0.0.1", () => ready(server.address().port)));
}

before(async () => {
	fallbackRoot = mkdtempSync(join(tmpdir(), "dreamweaver-e2e-"));
	sink = await startServer({ port: 0, fallbackRoot, watchSource: false, log: quiet, resolvePort: () => null });
	// Stands in for the extension: the page loads the overlay from the sink.
	site = createServer((req, res) => {
		res.writeHead(200, { "content-type": "text/html" });
		res.end(`<!doctype html><html><body style="margin:0;font-family:sans-serif">
			<div id="title" style="position:absolute;left:40px;top:40px;width:240px;padding:16px;font-size:16px;font-weight:400;border-radius:4px;background:rgb(240,240,240);transition:all 300ms">Title</div>
			<svg id="chart" style="position:absolute;left:40px;top:160px" width="120" height="120"><rect id="bar" x="10" y="10" width="100" height="100" fill="rgb(42,120,214)"/></svg>
			<script src="http://127.0.0.1:${sink.port}/overlay.js"></script>
		</body></html>`);
	});
	const sitePort = await listen(site);
	site.url = `http://127.0.0.1:${sitePort}/page`;
	browser = await chromium.launch({ channel: "chrome", headless: true });
});

after(async () => {
	await browser?.close();
	await new Promise((done) => site?.close(done));
	await sink?.close();
});

async function openPage() {
	const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
	await page.goto(site.url);
	await page.locator(".dock .cursor").waitFor();
	return page;
}

describe("in Chrome", () => {
	it("picks, edits text live, and turns the edit into a note that Build sends", async () => {
		const page = await openPage();
		await page.click(".dock .cursor");
		await page.click("#title");
		await page.locator(".card textarea").waitFor();
		// The outline was for finding it; it must not sit on the element being edited.
		assert.equal(await page.locator(".ring").isHidden(), true);

		await page.click('.card .shelf [data-tool="text"]');
		await page.click('.card [data-w="700"]');
		assert.equal(await page.$eval("#title", (el) => getComputedStyle(el).fontWeight), "700");
		// Transitions are off while picked, so the change is immediate.
		assert.equal(await page.$eval("#title", (el) => getComputedStyle(el).transitionDuration), "0s");

		await page.click('.card .shelf [data-tool="note"]');
		await page.fill(".card textarea", "Heavier title");
		await page.click('.card [data-act="add"]');
		await page.locator(".pin").waitFor();
		await page.click(".build");
		await page.locator(".build:has-text('Sent')").waitFor();

		const dir = join(fallbackRoot, ".claude/annotations");
		const [file] = readdirSync(dir);
		const batch = readFileSync(join(dir, file), "utf8");
		assert.match(batch, /Heavier title/);
		assert.match(batch, /font-weight: 400 → 700/);
		await page.close();
	});

	it("repaints as the color area is dragged, and paints SVG shapes by their fill", async () => {
		const page = await openPage();
		await page.click(".dock .cursor");
		await page.click('.dock [data-tool="color"]');
		await page.click("#bar");
		const area = page.locator(".card .area");
		await area.waitFor();
		assert.deepEqual(
			await page.$$eval(".card .seg [data-prop]", (tabs) => tabs.map((t) => t.dataset.prop)),
			["fill", "stroke"],
		);
		const box = await area.boundingBox();
		// Left edge, half way down: hue 0 at lightness 50%.
		await page.mouse.move(box.x + 1, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + 2, box.y + box.height / 2, { steps: 3 });
		await page.mouse.up();
		// The left edge is red; the bar keeps its own saturation, so a strong but not pure red.
		const [r, g, b] = (await page.$eval("#bar", (el) => getComputedStyle(el).fill)).match(/\d+/g).map(Number);
		assert.ok(r > 150 && g < 90 && b < 90, `fill is rgb(${r}, ${g}, ${b})`);
		await page.close();
	});

	it("moves the card by its header and keeps it there", async () => {
		const page = await openPage();
		await page.click(".dock .cursor");
		await page.click("#title");
		const head = page.locator(".card .card-head");
		await head.waitFor();
		const before = await page.locator(".card").boundingBox();
		const grip = await head.boundingBox();
		await page.mouse.move(grip.x + 20, grip.y + 10);
		await page.mouse.down();
		await page.mouse.move(grip.x + 220, grip.y + 210, { steps: 5 });
		await page.mouse.up();
		const after = await page.locator(".card").boundingBox();
		assert.ok(Math.abs(after.x - before.x - 200) < 4, `moved x by ${after.x - before.x}`);
		assert.ok(Math.abs(after.y - before.y - 200) < 4, `moved y by ${after.y - before.y}`);
		await page.close();
	});
});
