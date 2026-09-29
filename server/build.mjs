#!/usr/bin/env node
/**
 * Bundle the overlay, and only ever replace the served copy with one that works.
 *
 * The overlay is read by every localhost page on the machine, so a typo saved
 * mid-edit used to break the tools everywhere at once. Now a build that fails
 * to bundle, or bundles to something that does not parse, leaves the last good
 * `dist/overlay.js` in place and says why; the pages keep the previous version.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { build } from "esbuild";

export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ENTRY = join(REPO, "src/overlay/index.js");
export const DIST = join(REPO, "dist");
export const BUNDLE = join(DIST, "overlay.js");
const META = join(DIST, "meta.json");

/** `a1b2c3d` (with `+` when the tree has uncommitted changes), or `unversioned` outside git. */
function revision() {
	try {
		const sha = execFileSync("git", ["-C", REPO, "rev-parse", "--short", "HEAD"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		const dirty = execFileSync("git", ["-C", REPO, "status", "--porcelain", "--", "src"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		return dirty ? `${sha}+` : sha;
	} catch {
		return "unversioned";
	}
}

/** What was last built successfully, if anything has been. */
export function lastGood() {
	if (!existsSync(BUNDLE)) return null;
	let meta = {};
	try {
		meta = JSON.parse(readFileSync(META, "utf8"));
	} catch {}
	return { code: readFileSync(BUNDLE, "utf8"), ...meta };
}

/**
 * Build to memory, prove it parses, then swap it in atomically.
 * Resolves `{ ok: true, version, builtAt }` or `{ ok: false, error }` — never throws.
 */
export async function buildOverlay({ entry = ENTRY, out = BUNDLE } = {}) {
	const builtAt = new Date().toISOString();
	const version = `${revision()} ${builtAt}`;
	try {
		const result = await build({
			entryPoints: [entry],
			bundle: true,
			format: "iife",
			target: "chrome110",
			write: false,
			logLevel: "silent",
			legalComments: "none",
			define: { __DREAMWEAVER_VERSION__: JSON.stringify(version) },
		});
		const code = result.outputFiles[0].text;
		// Parses as a classic script, the way the page will load it.
		new Script(code, { filename: "overlay.js" });
		mkdirSync(dirname(out), { recursive: true });
		const temp = `${out}.tmp`;
		writeFileSync(temp, code);
		renameSync(temp, out);
		if (out === BUNDLE) writeFileSync(META, JSON.stringify({ version, builtAt }, null, 2));
		return { ok: true, version, builtAt, code };
	} catch (error) {
		const message = error.errors?.length
			? error.errors
					.map((e) => `${e.location ? `${e.location.file}:${e.location.line}: ` : ""}${e.text}`)
					.join("\n")
			: String(error.message ?? error);
		return { ok: false, error: message };
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const result = await buildOverlay();
	if (result.ok) {
		console.log(`built ${BUNDLE} (${result.version})`);
	} else {
		console.error(`build failed — the last good bundle is still served:\n${result.error}`);
		process.exit(1);
	}
}
