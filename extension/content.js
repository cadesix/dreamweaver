/**
 * dreamweaver — injector.
 *
 * The overlay used to arrive through a script tag in the app being annotated,
 * which meant every repo carried a line pointing at a personal tool on a
 * personal port. This puts that line here instead: nothing repo-side, and the
 * tool works on any localhost app without asking its codebase for permission.
 *
 * Chrome match patterns ignore the port, so `http://localhost/*` covers every
 * dev server on the machine at once.
 */
const SINK = "http://localhost:4747";

/**
 * Inject only when the sink is actually running.
 *
 * Without this check every localhost page on the machine would carry a dead
 * script tag and a failed request forever — the extension is always on, but the
 * tool is only running when you have deliberately started it in a repo. Failure
 * is silent for the same reason: not running is the normal state, not an error.
 */
fetch(`${SINK}/health`, { cache: "no-store" })
	.then((response) => {
		if (!response.ok) return;
		const script = document.createElement("script");
		script.src = `${SINK}/overlay.js`;
		script.async = true;
		/* documentElement, not head: `document_idle` is late enough that head
		   exists on any real page, but a document still being written may not
		   have one, and the tag works from either. */
		(document.head ?? document.documentElement).appendChild(script);
	})
	.catch(() => {});
