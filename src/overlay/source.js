/**
 * Element → where it came from.
 *
 * A chain of resolvers, best first, each allowed to fail: a Next app can name
 * the exact line, a bare React app can name the component, and anything at all
 * can name a selector. The note is worth having in all three cases.
 */

/** React's fiber, whatever key this version hides it under. */
export function fiberOf(node) {
	for (const key in node) {
		if (key.startsWith("__reactFiber$") || key.startsWith("__reactInternalInstance$")) {
			return node[key];
		}
	}
	return null;
}

export function nameOf(fiber) {
	const type = fiber?.type ?? fiber?.elementType;
	if (typeof type === "function") return type.displayName || type.name || null;
	if (typeof type === "object" && type) return type.displayName || type.render?.name || null;
	return null;
}

/**
 * The component path, innermost last — "AnnotationDraft › Field › Textarea".
 *
 * Walks `_debugOwner` (who WROTE this element) rather than `return` (who
 * contains it). The owner chain is the one that matches the source: a
 * Textarea's parent might be a dozen wrappers from a component library,
 * while its owner is the component whose file you want to open.
 */
export function componentPath(node) {
	const fiber = fiberOf(node);
	if (!fiber) return null;
	const names = [];
	for (let at = fiber, hops = 0; at && hops < 12; at = at._debugOwner ?? at.return, hops++) {
		const name = nameOf(at);
		if (name && name !== names[0] && !/^(Fragment|Suspense)$/.test(name)) names.unshift(name);
		if (names.length >= 4) break;
	}
	return names.length > 0 ? names.join(" › ") : null;
}

/** The first frame in a JSX-creation stack that belongs to the app, not React. */
export function appFrame(stack) {
	for (const line of String(stack ?? "").split("\n").slice(1)) {
		const match = /\(?(https?:\/\/[^\s)]+):(\d+):(\d+)\)?/.exec(line);
		if (!match) continue;
		if (/\/(node_modules|_next\/static\/chunks\/(react|framework))/.test(match[1])) continue;
		return { file: match[1], line: Number(match[2]), column: Number(match[3]) };
	}
	return null;
}

/**
 * The original file and line, via the dev server's own source maps.
 *
 * Next 16 exposes `/__nextjs_original-stack-frames`, which is how its error
 * overlay turns a bundled frame into somewhere you can open. React 19 removed
 * `_debugSource`, so `_debugStack` — an Error captured where the element was
 * created — is what is left to feed it.
 *
 * Everything here is best-effort by design. On a stack this cannot parse, or
 * a dev server without the endpoint, the note falls back to the component
 * path and stays useful.
 */
export async function sourceOf(node) {
	const explicit = node.closest?.("[data-source]")?.dataset?.source;
	if (explicit) {
		const [file, line] = explicit.split(":");
		return { file, line: Number(line) || null };
	}

	const fiber = fiberOf(node);
	const frame = appFrame(fiber?._debugStack?.stack);
	if (!frame) return null;

	try {
		const response = await fetch(`${location.origin}/__nextjs_original-stack-frames`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				frames: [{ file: frame.file, lineNumber: frame.line, column: frame.column, methodName: "", arguments: [] }],
				isServer: false,
				isEdgeServer: false,
				isAppDirectory: true,
			}),
		});
		if (!response.ok) return null;
		const payload = await response.json();
		const found = (Array.isArray(payload) ? payload[0] : payload?.frames?.[0])?.originalStackFrame;
		return found?.file ? { file: found.file, line: found.lineNumber ?? null } : null;
	} catch {
		return null;
	}
}

/** A short, stable-ish path to the element for when nothing better exists. */
export function selectorOf(node) {
	const parts = [];
	for (let at = node; at && at !== document.body && parts.length < 4; at = at.parentElement) {
		if (at.id) {
			parts.unshift(`#${at.id}`);
			break;
		}
		const cls = [...at.classList].filter((c) => !c.startsWith("annotate-")).slice(0, 2);
		parts.unshift(at.tagName.toLowerCase() + cls.map((c) => `.${c}`).join(""));
	}
	return parts.join(" > ");
}
