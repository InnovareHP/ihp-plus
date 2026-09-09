#!/usr/bin/env bash
# PreToolUse guard for Bash|PowerShell.
# exit 0 = allow, exit 2 = block (stderr is fed back to the agent as the reason).
# Only things that should never run unattended are blocked: local data loss,
# publishing commits, destructive SQL, wiping .env.

payload=$(cat)

cmd=$(printf '%s' "$payload" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p')
[ -z "$cmd" ] && exit 0

# Match the command line only. A heredoc body or file content that merely mentions
# a blocked string must not trip the guard. Newlines arrive JSON-escaped as a
# literal backslash-n, so cut at the first one. Parameter expansion, not sed:
# msys sed does not match an escaped backslash-n reliably.
cmd=${cmd%%\\n*}
lower=$(printf '%s' "$cmd" | tr '[:upper:]' '[:lower:]')

block() {
  printf 'Blocked: %s\n' "$1" >&2
  exit 2
}

# --- local data loss -------------------------------------------------------
case "$lower" in
  *"docker compose"*" down"*"-v"*|*"docker-compose"*" down"*"-v"*)
    block "'compose down -v' deletes the postgres/redis volumes. Use 'pnpm infra:down' or 'pnpm stack:down' (no -v)." ;;
  *"docker volume rm"*|*"docker volume prune"*)
    block "removing docker volumes wipes the local database. Ask the user to run it if the reset is intended." ;;
  *"docker system prune"*)
    block "'docker system prune' can take the project volumes and build cache with it. Prune specific images by name instead." ;;
esac

# --- git publishing --------------------------------------------------------
case "$lower" in
  *"git push"*)
    block "pushing is the user's call. Commit locally and report the branch instead." ;;
  *"git reset --hard"*|*"git clean -"*[df]*)
    block "this discards uncommitted work in the tree. Stash or show the diff instead." ;;
esac

# --- destructive SQL -------------------------------------------------------
case "$lower" in
  *"drop database"*|*"drop table"*|*"drop schema"*|*"truncate "*)
    block "destructive SQL against the local database. There are no migrations in this repo to rebuild from — ask first." ;;
esac

# --- env file --------------------------------------------------------------
case "$cmd" in
  *">"*".env"|*">"*".env "*|*"rm "*".env"*)
    block ".env is real local config and is gitignored. Document the variable in .env.example instead." ;;
esac

# --- filesystem ------------------------------------------------------------
case "$lower" in
  *"rm -rf /"*|*"rm -fr /"*)
    block "refusing an rm -rf on an absolute root path." ;;
esac

exit 0
