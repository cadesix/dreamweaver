#!/usr/bin/env node
/**
 * dreamweaver — the local server for the design tools.
 *
 * Serves the overlay to any localhost page (the Chrome extension injects it
 * while this answers `/health`) and files each batch of notes into the repo
 * whose dev server served the page.
 *
 * It rebuilds the overlay whenever its source changes and always serves the
 * last build that worked, so an edit that breaks the tools never reaches a page.
 * Meant to run as a login agent (see launchd/ and scripts/install.sh).
 */
import { watch } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOverlay, lastGood, REPO } from "./build.mjs";
import { writeBatch } from "./notes.mjs";

const CORS = {
	/* Any origin: this serves whatever dev server is running on whatever port it
	   picked. It binds to loopback, so "any origin" still means this machine. */
	"access-control-allow-origin": "*",
	"access-control-allow-headers": "content-type",
	"access-control-allow-methods": "GET, POST, OPTIONS",
};

function json(res, status, body) {
	res.writeHead(status, { ...CORS, "content-type": "application/json" });
	res.end(JSON.stringify(body));
}

export async function startServer({
	port = 4747,
	fallbackRoot = join(homedir(), ".dreamweaver"),
	outRel = ".claude/annotations",
	watchSource = true,
	log = console,
	/* Tests pass a stand-in so a batch never lands in a real repo. */
	resolvePort,
} = {}) {
	const state = { bundle: lastGood(), buildError: null };

	async function rebuild(reason) {
		const result = await buildOverlay();
		if (result.ok) {
			state.bundle = { code: result.code, version: result.version, builtAt: result.builtAt };
			state.buildError = null;
			log.log(`✓ overlay built (${reason}) — ${result.version}`);
		} else {
			state.buildError = result.error;
			log.error(`✗ overlay build failed (${reason}); still serving ${state.bundle?.version ?? "nothing"}:\n${result.error}`);
		}
	}

	await rebuild("start");

	let watcher = null;
	if (watchSource) {
		let timer = null;
		watcher = watch(join(REPO, "src"), { recursive: true }, () => {
			clearTimeout(timer);
			timer = setTimeout(() => void rebuild("source changed"), 150);
		});
	}

	const server = createServer((req, res) => {
		if (req.method === "OPTIONS") {
			res.writeHead(204, CORS).end();
			return;
		}
		if (req.url === "/overlay.js") {
			if (!state.bundle) {
				res.writeHead(503, { ...CORS, "content-type": "text/javascript; charset=utf-8" });
				res.end(`console.error(${JSON.stringify(`dreamweaver: no overlay has built yet — ${state.buildError}`)});`);
				return;
			}
			res.writeHead(200, {
				...CORS,
				"content-type": "text/javascript; charset=utf-8",
				"cache-control": "no-store",
			});
			res.end(state.bundle.code);
			return;
		}
		if (req.url === "/health") {
			json(res, 200, {
				ok: true,
				name: "dreamweaver",
				version: state.bundle?.version ?? null,
				builtAt: state.bundle?.builtAt ?? null,
				buildError: state.buildError,
				routing: "per-batch: page port → serving process → its repo",
				fallbackRoot,
				out: outRel,
			});
			return;
		}
		if (req.method === "POST" && req.url === "/notes") {
			let body = "";
			req.on("data", (chunk) => {
				body += chunk;
				// A note is text about an element; a megabyte of it is a bug.
				if (body.length > 1_000_000) req.destroy();
			});
			req.on("end", () => {
				try {
					const written = writeBatch(JSON.parse(body), {
						fallbackRoot,
						outRel,
						...(resolvePort ? { resolvePort } : {}),
					});
					if (!written) {
						json(res, 400, { ok: false, error: "no notes" });
						return;
					}
					log.log(`✓ ${written.root} → ${relative(written.root, written.path)}`);
					json(res, 200, { ok: true, root: written.root, path: relative(written.root, written.path) });
				} catch (error) {
					log.error("✗", error.message);
					json(res, 400, { ok: false, error: String(error.message) });
				}
			});
			return;
		}
		res.writeHead(404, CORS).end();
	});

	await new Promise((ready, fail) => {
		server.once("error", fail);
		server.listen(port, "127.0.0.1", ready);
	});
	log.log(`dreamweaver → http://localhost:${server.address().port}`);
	log.log(`  notes → the annotated page's own repo, ${outRel}/ (fallback: ${fallbackRoot})`);

	return {
		port: server.address().port,
		state,
		rebuild,
		close: () =>
			new Promise((done) => {
				watcher?.close();
				server.close(() => done());
			}),
	};
}

function arg(flag, fallback) {
	const at = process.argv.indexOf(flag);
	return at === -1 ? fallback : process.argv[at + 1];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	if (process.argv.includes("--help") || process.argv.includes("-h")) {
		console.log(`dreamweaver — design tools for any local dev page

  dreamweaver [--port 4747] [--out .claude/annotations] [--cwd ~/.dreamweaver]

Serves the overlay the Chrome extension injects into localhost pages, and files
each batch of notes into the repo serving the page. --cwd is only the fallback
for a page whose port can't be resolved.`);
		process.exit(0);
	}
	await startServer({
		port: Number(arg("--port", 4747)),
		fallbackRoot: resolve(arg("--cwd", join(homedir(), ".dreamweaver"))),
		outRel: arg("--out", ".claude/annotations"),
	});
}
