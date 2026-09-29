/**
 * Where a batch of notes goes, and what it looks like when it gets there.
 *
 * One sink serves every repo at once: each batch routes to the repo whose dev
 * server is serving the annotated page (page port → listening process → its
 * checkout root). It used to take one repo at start-up, and a sink left
 * running from another project silently swallowed every note. The fallback
 * root is only for a page whose port cannot be resolved.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/**
 * Walk up to the nearest checkout root — `.git` as a FILE counts, because a
 * worktree's is one, and the worktree being served is the repo its notes belong to.
 */
export function repoRootFrom(dir) {
	let current = dir;
	while (current && current !== dirname(current)) {
		if (existsSync(join(current, ".git"))) return current;
		current = dirname(current);
	}
	return null;
}

/**
 * The repo whose dev server owns `port` right now. Resolved FRESH per batch —
 * ports move between worktrees all day, and a cache would re-create the
 * misrouting this exists to end. Null when nothing there is a repo.
 */
export function repoForPort(port) {
	try {
		const pids = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
			encoding: "utf8",
		})
			.trim()
			.split("\n")
			.filter(Boolean);
		for (const pid of pids) {
			const fields = execFileSync("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], { encoding: "utf8" });
			const cwd = fields
				.split("\n")
				.find((line) => line.startsWith("n"))
				?.slice(1);
			const root = cwd ? repoRootFrom(cwd) : null;
			if (root) return root;
		}
	} catch {
		/* lsof missing, denied, or nothing listening: the fallback root answers */
	}
	return null;
}

/** The repo this batch belongs to: the one serving the page it was captured on. */
export function sinkFor(url, { fallbackRoot, outRel, resolvePort = repoForPort }) {
	try {
		const parsed = new URL(url);
		if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
			const port = Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
			const root = resolvePort(port);
			if (root) return { root, out: resolve(root, outRel) };
		}
	} catch {
		/* no or malformed url: the fallback root answers */
	}
	return { root: fallbackRoot, out: resolve(fallbackRoot, outRel) };
}

/**
 * One file per batch, named for when it was sent: a batch is the unit of work,
 * and a filename answers "which ones are new" far better than an append-only log.
 */
export function batchPath(out, when) {
	const stamp = when.toISOString().slice(0, 19).replaceAll(":", "-");
	return join(out, `${stamp}.md`);
}

/** An absolute source path → repo-relative, since that is what an agent greps. */
function localize(root, file) {
	if (!file) return null;
	const absolute = file.startsWith("/") ? file : resolve(root, file);
	const rel = relative(root, absolute);
	return rel.startsWith("..") ? file : rel;
}

export function renderNote(root, note, index) {
	const lines = [];
	const where = note.source?.file
		? `${localize(root, note.source.file)}${note.source.line ? `:${note.source.line}` : ""}`
		: (note.component ?? note.selector ?? "unknown element");
	lines.push(`## ${index + 1}. ${where}`, "", String(note.text ?? "").trim(), "");
	if (note.component) lines.push(`- **Component:** ${note.component}`);
	if (note.selector) lines.push(`- **Selector:** \`${note.selector}\``);
	if (note.label) lines.push(`- **Element text:** “${note.label}”`);
	if (note.tag) lines.push(`- **Tag:** \`<${note.tag}>\``);
	if (note.box) {
		lines.push(
			`- **Box:** ${Math.round(note.box.w)}×${Math.round(note.box.h)} at (${Math.round(note.box.x)}, ${Math.round(note.box.y)})`,
		);
	}
	lines.push("");
	return lines.join("\n");
}

export function renderBatch(root, payload, notes, when) {
	const head = [
		`# Design notes — ${when.toLocaleString()}`,
		"",
		`- **Page:** ${payload.url ?? "unknown"}`,
		`- **Viewport:** ${payload.viewport ?? "unknown"}`,
		`- **Notes:** ${notes.length}`,
		"",
		"---",
		"",
	].join("\n");
	return head + notes.map((note, index) => renderNote(root, note, index)).join("\n");
}

/** Write a batch into its repo. Null when there is nothing to write. */
export function writeBatch(payload, options, when = new Date()) {
	const notes = Array.isArray(payload.notes) ? payload.notes : [];
	if (notes.length === 0) return null;
	const { root, out } = sinkFor(payload.url, options);
	mkdirSync(out, { recursive: true });
	const path = batchPath(out, when);
	appendFileSync(path, renderBatch(root, payload, notes, when), "utf8");
	return { root, path };
}
