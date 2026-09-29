#!/bin/sh
# Install dreamweaver as a login agent, and point the old annotate paths at this repo.
#
#   sh scripts/install.sh            install or update (safe to re-run, e.g. after a Node upgrade)
#   sh scripts/install.sh --uninstall
#
# What it does:
#   ~/.local/share/annotate  → symlink to this repo, so the Chrome extension Chrome already has
#                              loaded (unpacked, from ~/.local/share/annotate/extension) keeps working
#   ~/.local/bin/dreamweaver, ~/.local/bin/annotate → bin/dreamweaver
#   ~/Library/LaunchAgents/com.cadesix.dreamweaver.plist → starts the server at login, restarts it if it dies
#   Logs: ~/Library/Logs/dreamweaver.log
set -eu

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.cadesix.dreamweaver"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/dreamweaver.log"
SHARE="$HOME/.local/share/annotate"
DOMAIN="gui/$(id -u)"

unload() {
	launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
}

if [ "${1:-}" = "--uninstall" ]; then
	unload
	rm -f "$PLIST"
	echo "removed the login agent; $SHARE and ~/.local/bin links were left in place"
	exit 0
fi

NODE="$(command -v node)"
[ -n "$NODE" ] || { echo "node not found on PATH" >&2; exit 1; }

# Dependencies and a first build, so the agent has something to serve.
(cd "$REPO" && npm install --no-audit --no-fund --silent && node server/build.mjs)

# The old install directory becomes a link to the repo; anything real there is kept aside.
if [ -L "$SHARE" ]; then
	rm "$SHARE"
elif [ -e "$SHARE" ]; then
	mv "$SHARE" "$SHARE.pre-dreamweaver-$(date +%Y%m%d-%H%M%S)"
fi
mkdir -p "$(dirname "$SHARE")"
ln -s "$REPO" "$SHARE"

mkdir -p "$HOME/.local/bin"
ln -sf "$REPO/bin/dreamweaver" "$HOME/.local/bin/dreamweaver"
ln -sf "$REPO/bin/dreamweaver" "$HOME/.local/bin/annotate"

# Whatever already holds the port (an annotate server started by hand) makes way.
unload
lsof -ti tcp:4747 -sTCP:LISTEN | xargs kill 2>/dev/null || true

mkdir -p "$(dirname "$PLIST")" "$(dirname "$LOG")"
AGENT_PATH="$(dirname "$NODE"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
sed -e "s|__NODE__|$NODE|g" -e "s|__REPO__|$REPO|g" -e "s|__LOG__|$LOG|g" -e "s|__PATH__|$AGENT_PATH|g" \
	"$REPO/launchd/$LABEL.plist" > "$PLIST"
launchctl bootstrap "$DOMAIN" "$PLIST"

# Up means answering /health, not merely launched.
for _ in 1 2 3 4 5 6 7 8 9 10; do
	if curl -fs --max-time 1 http://localhost:4747/health >/dev/null 2>&1; then
		echo "dreamweaver is running: $(curl -s http://localhost:4747/health)"
		exit 0
	fi
	sleep 1
done
echo "the agent did not answer /health — see $LOG" >&2
exit 1
