/**
 * The notes waiting to be sent, and sending them.
 *
 * THE QUEUE SURVIVES THE PAGE. A refresh, an accidental tab close or a dev
 * server's hot reload used to throw away everything not yet built — usually
 * while looking at the very thing being annotated. Keyed by PATH, not the full
 * URL: notes are about a screen, and an app that rewrites its own query string
 * would otherwise orphan a queue mid-session. Per origin already, since that is
 * what localStorage is. Every storage call is guarded: a page can refuse
 * storage, and the tools have to survive that rather than fail to load.
 */
export function createQueue({ origin, storage = globalThis.localStorage, path = location.pathname }) {
	const key = `__annotate_draft:${path}`;
	const notes = [];

	function save() {
		try {
			if (notes.length === 0) storage.removeItem(key);
			else storage.setItem(key, JSON.stringify(notes));
		} catch {}
	}

	/* Only what this build can still draw and send. A note from an older shape
	   is dropped rather than crashing on load, which would take the dock with it
	   and leave no way to send the rest. */
	function restore() {
		try {
			const saved = JSON.parse(storage.getItem(key) ?? "null");
			if (!Array.isArray(saved)) return;
			for (const note of saved) {
				if (note && typeof note.text === "string" && note.box) notes.push(note);
			}
		} catch {}
	}

	function add(note) {
		notes.push(note);
		save();
	}

	function remove(index) {
		notes.splice(index, 1);
		save();
	}

	/** Cleared only on a CONFIRMED send, so a sink that was down does not cost the notes. */
	async function send() {
		const payload = {
			url: location.href,
			viewport: `${window.innerWidth}×${window.innerHeight}`,
			notes,
		};
		const response = await fetch(`${origin}/notes`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
		});
		const result = await response.json();
		if (!result.ok) throw new Error(result.error ?? "the sink refused the batch");
		notes.length = 0;
		save();
		return result;
	}

	return { notes, add, remove, restore, send };
}
