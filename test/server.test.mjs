import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { hex, hslCss, rgbToHsl } from "../src/overlay/colors.js";
import { buildOverlay } from "../server/build.mjs";
import { renderNote, sinkFor } from "../server/notes.mjs";
import { startServer } from "../server/server.mjs";

const temp = () => mkdtempSync(join(tmpdir(), "dreamweaver-"));
const quiet = { log() {}, error() {} };

describe("colors", () => {
	it("converts HSL to hex without a canvas", () => {
		assert.equal(hex({ h: 0, s: 100, l: 50, a: 1 }), "#ff0000");
		assert.equal(hex({ h: 210, s: 100, l: 50, a: 1 }), "#0080ff");
		assert.equal(hex({ h: 0, s: 0, l: 100, a: 0.5 }), "#ffffff80");
	});

	it("keeps a gray's hue rather than jumping to red", () => {
		assert.equal(rgbToHsl({ r: 128, g: 128, b: 128 }, 210).h, 210);
		assert.equal(hslCss({ h: 210, s: 80, l: 50, a: 1 }), "hsl(210 80% 50%)");
	});
});

describe("routing a batch", () => {
	it("goes to the repo serving the page's port", () => {
		const sink = sinkFor("http://localhost:3156/admin", {
			fallbackRoot: "/fallback",
			outRel: ".claude/annotations",
			resolvePort: (port) => (port === 3156 ? "/repos/station" : null),
		});
		assert.deepEqual(sink, { root: "/repos/station", out: "/repos/station/.claude/annotations" });
	});

	it("falls back when the port resolves to nothing, or the page is not local", () => {
		const options = { fallbackRoot: "/fallback", outRel: "notes", resolvePort: () => null };
		assert.equal(sinkFor("http://localhost:1/", options).root, "/fallback");
		assert.equal(sinkFor("https://example.com/", options).root, "/fallback");
		assert.equal(sinkFor("not a url", options).root, "/fallback");
	});

	it("renders a note with its source relative to the repo", () => {
		const text = renderNote(
			"/repos/station",
			{
				text: "Bolder",
				source: { file: "/repos/station/src/app.tsx", line: 12 },
				component: "App › Title",
				tag: "h1",
				box: { x: 1, y: 2, w: 300.4, h: 40 },
			},
			0,
		);
		assert.match(text, /^## 1\. src\/app\.tsx:12/);
		assert.match(text, /- \*\*Box:\*\* 300×40 at \(1, 2\)/);
	});
});

describe("building", () => {
	it("keeps the last good bundle when a build breaks", async () => {
		const dir = temp();
		const out = join(dir, "overlay.js");
		writeFileSync(out, "/* last good */");
		const entry = join(dir, "broken.js");
		writeFileSync(entry, "export const x = ;");
		const result = await buildOverlay({ entry, out });
		assert.equal(result.ok, false);
		assert.match(result.error, /broken\.js/);
		assert.equal(readFileSync(out, "utf8"), "/* last good */");
	});

	it("stamps the bundle with its version", async () => {
		const out = join(temp(), "overlay.js");
		const result = await buildOverlay({ out });
		assert.equal(result.ok, true);
		assert.ok(readFileSync(out, "utf8").includes(result.version));
	});
});

describe("the server", () => {
	it("serves the overlay and its health, and files a batch", async () => {
		const fallbackRoot = temp();
		const server = await startServer({ port: 0, fallbackRoot, watchSource: false, log: quiet, resolvePort: () => null });
		try {
			const base = `http://127.0.0.1:${server.port}`;
			const health = await (await fetch(`${base}/health`)).json();
			assert.equal(health.ok, true);
			assert.equal(health.name, "dreamweaver");
			assert.ok(health.version);
			assert.equal(health.buildError, null);

			const overlay = await fetch(`${base}/overlay.js`);
			assert.equal(overlay.status, 200);
			assert.match(await overlay.text(), /dreamweaver/);

			const posted = await fetch(`${base}/notes`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ url: "http://localhost:9/", notes: [{ text: "Hi", box: { x: 0, y: 0, w: 1, h: 1 } }] }),
			});
			assert.equal((await posted.json()).ok, true);
			const files = readdirSync(join(fallbackRoot, ".claude/annotations"));
			assert.equal(files.length, 1);

			const empty = await fetch(`${base}/notes`, { method: "POST", body: JSON.stringify({ notes: [] }) });
			assert.equal(empty.status, 400);
		} finally {
			await server.close();
		}
	});
});
