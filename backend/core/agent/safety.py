"""
Step 12.3 — Command Safety Layer

Three layers of defence:
  1. Command Blacklist  — Regex-matched patterns that must NEVER execute.
  2. Path Sandboxing    — File tools restricted to user home directory.
  3. Output Sanitization — Truncate large outputs to prevent context overflow.
"""

import re
import platform
from pathlib import Path

# ── 1. Command Blacklist ────────────────────────────────────────────────
# Patterns are case-insensitive. Each entry is compiled once at import.

_BLACKLIST_PATTERNS: list[str] = [
    # ── Linux / macOS destructive ──
    r"rm\s+-rf\s+/",
    r"rm\s+-rf\s+~",
    r"rm\s+--no-preserve-root",
    r"mkfs\b",
    r"dd\s+if=",
    r":\(\)\{\s*:\|:\&\s*\};:",           # fork bomb
    r"\bshutdown\b",
    r"\breboot\b",
    r"init\s+[0-6]",
    r"chmod\s+-R\s+777\s+/",
    r">\s*/dev/sd[a-z]",
    r"mv\s+.+\s+/dev/null",

    # ── Windows destructive ──
    r"format\s+[a-zA-Z]:",
    r"del\s+/[fFsSqQ]",
    r"rd\s+/[sS]\s+/[qQ]",
    r"rmdir\s+/[sS]\s+/[qQ]",
    r"reg\s+delete",
    r"reg\s+add.*\/f",
    r"\bbcdedit\s+/(?:set|delete)\b",
    r"diskpart",
    r"cipher\s+/w:",
    r"net\s+user\s+.*\s+/delete",
    r"net\s+stop",
    r"powershell.*-enc",                   # encoded commands (obfuscation)
    r"powershell.*downloadstring",         # remote code execution
    r"powershell.*iex\s*\(",               # invoke-expression

    # ── Cross-platform network-dangerous ──
    r"curl.*\|\s*(ba)?sh",                 # pipe-to-shell
    r"wget.*\|\s*(ba)?sh",
    r"nc\s+-[le]",                         # netcat listeners
    r"ncat\s+-[le]",
]

_COMPILED_BLACKLIST = [
    re.compile(p, re.IGNORECASE) for p in _BLACKLIST_PATTERNS
]


def is_command_blocked(command: str) -> bool:
    """Return True if `command` matches any blacklisted pattern."""
    for pattern in _COMPILED_BLACKLIST:
        if pattern.search(command):
            return True
    return False


def get_blocked_reason(command: str) -> str | None:
    """Return the matched pattern string if blocked, else None."""
    for pattern in _COMPILED_BLACKLIST:
        if pattern.search(command):
            return pattern.pattern
    return None


# ── 2. Path Sandboxing ──────────────────────────────────────────────────

# Directories that file tools must NEVER access.
_SYSTEM_DIRS_WINDOWS = [
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\ProgramData",
    "C:\\$Recycle.Bin",
]

_SYSTEM_DIRS_UNIX = [
    "/etc",
    "/usr",
    "/bin",
    "/sbin",
    "/boot",
    "/dev",
    "/proc",
    "/sys",
    "/var",
    "/root",
]


def _get_sandbox_root() -> Path:
    """The sandbox root is the current user's home directory."""
    return Path.home()


def is_path_allowed(target_path: str, user_id: str = None) -> bool:
    """
    Return True if `target_path` is inside the user's home directory OR any
    user-configured whitelisted directory, and not inside a protected system directory.
    """
    try:
        resolved = Path(target_path).resolve()
    except (OSError, ValueError):
        return False

    # Extra check: reject known system directories (handles symlinks/junctions)
    resolved_str = str(resolved)
    blocked_dirs = (
        _SYSTEM_DIRS_WINDOWS if platform.system() == "Windows" else _SYSTEM_DIRS_UNIX
    )
    for sdir in blocked_dirs:
        if resolved_str.lower().startswith(sdir.lower()):
            return False

    # Helper to check if child is a subpath of parent (case-insensitive on Windows)
    def _is_subpath(child: Path, parent: Path) -> bool:
        try:
            child.relative_to(parent)
            return True
        except ValueError:
            if platform.system() == "Windows":
                try:
                    c_parts = [p.lower() for p in child.parts]
                    p_parts = [p.lower() for p in parent.parts]
                    if len(c_parts) >= len(p_parts) and c_parts[:len(p_parts)] == p_parts:
                        return True
                except Exception:
                    pass
            return False

    # Check against home directory first
    sandbox = _get_sandbox_root()
    if _is_subpath(resolved, sandbox):
        return True

    # Check against user's whitelisted paths from MongoDB
    if user_id and user_id != "local":
        from core.users.models import User
        try:
            user = User.objects(user_id=user_id).first()
            if user and user.preferences and user.preferences.whitelisted_paths:
                for wpath in user.preferences.whitelisted_paths:
                    try:
                        wpath_resolved = Path(wpath).resolve()
                        if _is_subpath(resolved, wpath_resolved):
                            return True
                    except (OSError, ValueError):
                        pass
        except Exception:
            pass  # Fallback to home sandbox if DB query fails

    return False


# ── 3. Output Sanitization ──────────────────────────────────────────────

MAX_OUTPUT_CHARS = 2000


def sanitize_output(output: str) -> str:
    """Truncate tool output to prevent context window overflow."""
    if len(output) > MAX_OUTPUT_CHARS:
        return output[:MAX_OUTPUT_CHARS] + "\n\n... [output truncated to 2000 chars]"
    return output
