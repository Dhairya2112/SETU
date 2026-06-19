"""
Step 12.1 / 12.2 — OS-Level & File System Tool Registration

All LangChain @tool functions that give Setu actual agency over the
operating system.  Each tool:
  1. Checks permission level via permissions.py
  2. Validates safety via safety.py
  3. Logs execution via models.py CommandLog
  4. Returns sanitized output

Tools are designed to receive `user_id` and `conversation_id` through
a thread-local context variable set before the agent runs.
"""

import os
import sys
import glob
import json
import platform
import subprocess
import datetime
import contextvars
from pathlib import Path

from langchain_core.tools import tool

from .safety import is_command_blocked, get_blocked_reason, is_path_allowed, sanitize_output
from .permissions import check_permission, PERMISSION_DENIED_MSG
from .models import CommandLog

# ── ContextVars for user/conversation ID ──
user_id_var = contextvars.ContextVar("user_id", default="anonymous")
conversation_id_var = contextvars.ContextVar("conversation_id", default="unknown")


def set_tool_context(user_id: str, conversation_id: str) -> None:
    """Set the user/conversation context for the current tool execution."""
    user_id_var.set(user_id)
    conversation_id_var.set(conversation_id)


def _get_user_id() -> str:
    return user_id_var.get()


def _get_conversation_id() -> str:
    return conversation_id_var.get()


def _log(tool_name: str, tool_input: str, tool_output: str, status: str) -> None:
    """Create a CommandLog entry. Silently fails to avoid breaking tools."""
    try:
        CommandLog(
            user_id=_get_user_id(),
            conversation_id=_get_conversation_id(),
            tool_name=tool_name,
            tool_input=str(tool_input)[:500],
            tool_output=str(tool_output)[:500],
            status=status,
        ).save()
    except Exception:
        pass  # Never let logging break a tool


# ─────────────────────────────────────────────────────────────────────────
# 12.1  CORE SYSTEM TOOLS
# ─────────────────────────────────────────────────────────────────────────

@tool
def get_current_time(query: str = "") -> str:
    """Get the current date, time, and day of the week."""
    now = datetime.datetime.now()
    result = now.strftime("%A, %B %d, %Y — %I:%M %p")
    _log("get_current_time", query, result, "success")
    return result


@tool
def get_system_info(query: str = "") -> str:
    """Get system information including CPU usage, RAM, disk, battery, and OS details. Always safe to run."""
    try:
        import psutil
    except ImportError:
        msg = "psutil is not installed. Cannot retrieve system information."
        _log("get_system_info", query, msg, "error")
        return msg

    info = {
        "os": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "cpu_percent": f"{psutil.cpu_percent(interval=0.5)}%",
        "ram_total_gb": f"{psutil.virtual_memory().total / (1024**3):.1f} GB",
        "ram_used_percent": f"{psutil.virtual_memory().percent}%",
        "disk_total_gb": f"{psutil.disk_usage('/').total / (1024**3):.1f} GB" if platform.system() != "Windows" else f"{psutil.disk_usage('C:\\').total / (1024**3):.1f} GB",
        "disk_used_percent": f"{psutil.disk_usage('/').percent}%" if platform.system() != "Windows" else f"{psutil.disk_usage('C:\\').percent}%",
    }

    # Battery (laptops only)
    battery = psutil.sensors_battery()
    if battery:
        info["battery_percent"] = f"{battery.percent}%"
        info["battery_plugged"] = battery.power_plugged

    result = json.dumps(info, indent=2)
    _log("get_system_info", query, result, "success")
    return sanitize_output(result)


@tool
def open_application(app_name: str) -> str:
    """Open an application by name (e.g., 'chrome', 'notepad', 'code', 'spotify'). Requires Level 2 permission."""
    if not check_permission(_get_user_id(), required_level=2):
        _log("open_application", app_name, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    # Map common names to actual executables
    app_aliases: dict[str, list[str]] = {
        # Browsers
        "chrome": ["chrome", "google-chrome", "google-chrome-stable"],
        "firefox": ["firefox"],
        "edge": ["msedge", "microsoft-edge"],
        "brave": ["brave", "brave-browser"],
        # Dev tools
        "code": ["code"],
        "vscode": ["code"],
        "vs code": ["code"],
        "terminal": ["wt", "cmd"] if platform.system() == "Windows" else ["gnome-terminal", "x-terminal-emulator"],
        # System
        "notepad": ["notepad"] if platform.system() == "Windows" else ["gedit", "nano"],
        "calculator": ["calc"] if platform.system() == "Windows" else ["gnome-calculator"],
        "file explorer": ["explorer"] if platform.system() == "Windows" else ["nautilus"],
        "explorer": ["explorer"] if platform.system() == "Windows" else ["nautilus"],
        "files": ["explorer"] if platform.system() == "Windows" else ["nautilus"],
        # Media
        "spotify": ["spotify"],
        "vlc": ["vlc"],
        # Communication
        "discord": ["discord"],
        "slack": ["slack"],
        "teams": ["teams", "msteams"],
    }

    # Check if this is a website URL or a common web destination
    web_destinations = {
        "youtube": "https://youtube.com",
        "google": "https://google.com",
        "github": "https://github.com",
        "gmail": "https://gmail.com",
        "netflix": "https://netflix.com",
        "reddit": "https://reddit.com",
        "twitter": "https://twitter.com",
        "wikipedia": "https://wikipedia.org",
    }

    name_lower = app_name.strip().lower()

    # If it is a web URL, localhost, or a known web destination, open in the system default browser
    is_url = (
        name_lower.startswith(("http://", "https://", "www.", "localhost")) or 
        "localhost:" in name_lower or
        any(name_lower.endswith(suffix) for suffix in [".com", ".org", ".net", ".io", ".edu", ".gov", ".co"]) or 
        name_lower in web_destinations
    )

    if is_url:
        url = web_destinations.get(name_lower, app_name.strip())
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
            
        try:
            if platform.system() == "Windows":
                subprocess.Popen(
                    f"start {url}",
                    shell=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            elif platform.system() == "Darwin":
                subprocess.Popen(
                    ["open", url],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:  # Linux
                subprocess.Popen(
                    ["xdg-open", url],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            result = f"Opened website {url} in your default browser."
            _log("open_application", app_name, result, "success")
            return result
        except Exception as e:
            result = f"Error opening URL {url}: {str(e)}"
            _log("open_application", app_name, result, "error")
            return result

    # Otherwise, try opening it as a local system application
    candidates = app_aliases.get(name_lower, [name_lower])

    try:
        for candidate in candidates:
            try:
                if platform.system() == "Windows":
                    subprocess.Popen(
                        f"start {candidate}",
                        shell=True,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                else:
                    subprocess.Popen(
                        [candidate],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                result = f"Opened {app_name} successfully."
                _log("open_application", app_name, result, "success")
                return result
            except FileNotFoundError:
                continue

        result = f"Could not find application '{app_name}'. Make sure it's installed and in your PATH."
        _log("open_application", app_name, result, "error")
        return result
    except Exception as e:
        result = f"Error opening {app_name}: {str(e)}"
        _log("open_application", app_name, result, "error")
        return result


@tool
def run_shell_command(command: str) -> str:
    """Run a shell command and return stdout/stderr. Requires Level 2 permission. Dangerous commands are blocked."""
    if not check_permission(_get_user_id(), required_level=2):
        _log("run_shell_command", command, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    # Safety check — blocked commands
    reason = get_blocked_reason(command)
    if reason:
        msg = f"🚫 This command was blocked by Setu's safety layer. Matched pattern: `{reason}`"
        _log("run_shell_command", command, msg, "blocked")
        return msg

    try:
        shell_exe = True
        result = subprocess.run(
            command,
            shell=shell_exe,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=str(Path.home()),
        )
        output = ""
        if result.stdout:
            output += result.stdout
        if result.stderr:
            output += ("\n[STDERR]\n" + result.stderr) if output else result.stderr
        if not output:
            output = "(command completed with no output)"

        output = sanitize_output(output)
        _log("run_shell_command", command, output, "success")
        return output
    except subprocess.TimeoutExpired:
        msg = "Command timed out after 30 seconds."
        _log("run_shell_command", command, msg, "error")
        return msg
    except Exception as e:
        msg = f"Error running command: {str(e)}"
        _log("run_shell_command", command, msg, "error")
        return msg


@tool
def control_volume(action: str) -> str:
    """
    Control system volume. Actions: 'mute', 'unmute', 'get',
    or a number like '50' to set volume percentage.
    Requires Level 2 permission.
    """
    if not check_permission(_get_user_id(), required_level=2):
        _log("control_volume", action, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    action = action.strip().lower()

    if platform.system() != "Windows":
        # Linux fallback via amixer
        try:
            if action == "mute":
                subprocess.run(["amixer", "set", "Master", "mute"], capture_output=True)
                result = "Volume muted."
            elif action == "unmute":
                subprocess.run(["amixer", "set", "Master", "unmute"], capture_output=True)
                result = "Volume unmuted."
            elif action == "get":
                out = subprocess.run(["amixer", "get", "Master"], capture_output=True, text=True)
                result = out.stdout[:200]
            elif action.isdigit():
                subprocess.run(["amixer", "set", "Master", f"{action}%"], capture_output=True)
                result = f"Volume set to {action}%."
            else:
                result = f"Unknown volume action '{action}'. Use 'mute', 'unmute', 'get', or a number like '50'."
            _log("control_volume", action, result, "success")
            return result
        except Exception as e:
            msg = f"Volume control error: {e}"
            _log("control_volume", action, msg, "error")
            return msg

    # Windows: Use PowerShell audio commands
    try:
        if action == "mute":
            # Use nircmd or PowerShell to mute
            ps = '(New-Object -ComObject WScript.Shell).SendKeys([char]173)'
            subprocess.run(["powershell", "-Command", ps], capture_output=True)
            result = "Toggled mute."
        elif action == "unmute":
            ps = '(New-Object -ComObject WScript.Shell).SendKeys([char]173)'
            subprocess.run(["powershell", "-Command", ps], capture_output=True)
            result = "Toggled mute."
        elif action == "get":
            result = "Volume level query requires pycaw. Use 'run_shell_command' for detailed audio info."
        elif action.isdigit():
            level = max(0, min(100, int(action)))
            # Set volume via PowerShell and COM
            ps = f"""
            $wshShell = New-Object -ComObject WScript.Shell;
            1..50 | ForEach-Object {{ $wshShell.SendKeys([char]174) }};
            $steps = [math]::Round({level} / 2);
            1..$steps | ForEach-Object {{ $wshShell.SendKeys([char]175) }}
            """
            subprocess.run(["powershell", "-Command", ps], capture_output=True, timeout=15)
            result = f"Volume set to approximately {level}%."
        else:
            result = f"Unknown volume action '{action}'. Use 'mute', 'unmute', 'get', or a number like '50'."
        _log("control_volume", action, result, "success")
        return result
    except Exception as e:
        msg = f"Volume control error: {e}"
        _log("control_volume", action, msg, "error")
        return msg


@tool
def web_search(query: str) -> str:
    """Search the web using DuckDuckGo and return top results. Safe, Level 1 tool."""
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        msg = "duckduckgo-search is not installed. Run: pip install duckduckgo-search"
        _log("web_search", query, msg, "error")
        return msg

    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))

        if not results:
            msg = f"No results found for: {query}"
            _log("web_search", query, msg, "success")
            return msg

        formatted = []
        for i, r in enumerate(results, 1):
            formatted.append(f"{i}. **{r.get('title', 'No title')}**\n   {r.get('body', '')}\n   URL: {r.get('href', '')}")

        result = "\n\n".join(formatted)
        _log("web_search", query, result[:200], "success")
        return sanitize_output(result)
    except Exception as e:
        msg = f"Search error: {str(e)}"
        _log("web_search", query, msg, "error")
        return msg


# ─────────────────────────────────────────────────────────────────────────
# 12.2  FILE SYSTEM TOOLS
# ─────────────────────────────────────────────────────────────────────────

@tool
def read_file(file_path: str) -> str:
    """Read the contents of a local file. Requires Level 2 permission. Path must be in user home directory."""
    if not check_permission(_get_user_id(), required_level=2):
        _log("read_file", file_path, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    if not is_path_allowed(file_path):
        msg = f"🚫 Access denied. File path '{file_path}' is outside the allowed directory."
        _log("read_file", file_path, msg, "blocked")
        return msg

    try:
        path = Path(file_path).resolve()
        if not path.exists():
            msg = f"File not found: {file_path}"
            _log("read_file", file_path, msg, "error")
            return msg
        if not path.is_file():
            msg = f"Path is not a file: {file_path}"
            _log("read_file", file_path, msg, "error")
            return msg

        content = path.read_text(encoding="utf-8", errors="replace")
        result = sanitize_output(content)
        _log("read_file", file_path, f"Read {len(content)} chars", "success")
        return result
    except Exception as e:
        msg = f"Error reading file: {str(e)}"
        _log("read_file", file_path, msg, "error")
        return msg


@tool
def write_file(file_path: str, content: str) -> str:
    """Create or overwrite a file with the given content. Requires Level 2 permission. Path must be in user home directory."""
    if not check_permission(_get_user_id(), required_level=2):
        _log("write_file", file_path, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    if not is_path_allowed(file_path):
        msg = f"🚫 Access denied. File path '{file_path}' is outside the allowed directory."
        _log("write_file", file_path, msg, "blocked")
        return msg

    try:
        path = Path(file_path).resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        result = f"File written successfully: {file_path} ({len(content)} chars)"
        _log("write_file", file_path, result, "success")
        return result
    except Exception as e:
        msg = f"Error writing file: {str(e)}"
        _log("write_file", file_path, msg, "error")
        return msg


@tool
def search_files(directory: str, pattern: str = "*") -> str:
    """Search for files by name or extension pattern in a directory. Example patterns: '*.py', 'report*', '*.txt'. Requires Level 2 permission."""
    if not check_permission(_get_user_id(), required_level=2):
        _log("search_files", f"{directory} | {pattern}", PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    if not is_path_allowed(directory):
        msg = f"🚫 Access denied. Directory '{directory}' is outside the allowed directory."
        _log("search_files", directory, msg, "blocked")
        return msg

    try:
        search_path = Path(directory).resolve()
        if not search_path.exists():
            msg = f"Directory not found: {directory}"
            _log("search_files", directory, msg, "error")
            return msg

        matches = list(search_path.rglob(pattern))[:50]  # Cap at 50 results

        if not matches:
            msg = f"No files matching '{pattern}' found in {directory}"
            _log("search_files", f"{directory} | {pattern}", msg, "success")
            return msg

        result_lines = [str(m) for m in matches]
        result = f"Found {len(matches)} file(s):\n" + "\n".join(result_lines)
        _log("search_files", f"{directory} | {pattern}", f"{len(matches)} matches", "success")
        return sanitize_output(result)
    except Exception as e:
        msg = f"Error searching files: {str(e)}"
        _log("search_files", directory, msg, "error")
        return msg


@tool
def list_directory(directory: str) -> str:
    """List all files and folders in a given directory. Requires Level 2 permission."""
    if not check_permission(_get_user_id(), required_level=2):
        _log("list_directory", directory, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    if not is_path_allowed(directory):
        msg = f"🚫 Access denied. Directory '{directory}' is outside the allowed directory."
        _log("list_directory", directory, msg, "blocked")
        return msg

    try:
        path = Path(directory).resolve()
        if not path.exists():
            msg = f"Directory not found: {directory}"
            _log("list_directory", directory, msg, "error")
            return msg
        if not path.is_dir():
            msg = f"Path is not a directory: {directory}"
            _log("list_directory", directory, msg, "error")
            return msg

        entries = sorted(path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
        lines = []
        for entry in entries[:100]:  # Cap at 100 entries
            icon = "📁" if entry.is_dir() else "📄"
            size = ""
            if entry.is_file():
                byte_size = entry.stat().st_size
                if byte_size < 1024:
                    size = f" ({byte_size} B)"
                elif byte_size < 1024 * 1024:
                    size = f" ({byte_size / 1024:.1f} KB)"
                else:
                    size = f" ({byte_size / (1024**2):.1f} MB)"
            lines.append(f"{icon} {entry.name}{size}")

        result = f"Contents of {directory}:\n" + "\n".join(lines)
        _log("list_directory", directory, f"{len(entries)} entries", "success")
        return sanitize_output(result)
    except Exception as e:
        msg = f"Error listing directory: {str(e)}"
        _log("list_directory", directory, msg, "error")
        return msg


# ─────────────────────────────────────────────────────────────────────────
# 13.3  REMINDER TOOL (Step 13)
# ─────────────────────────────────────────────────────────────────────────

@tool
def set_reminder(title: str, remind_at: str, description: str = "") -> str:
    """
    Set a reminder for the user. The remind_at argument accepts natural language
    strings like 'tomorrow at 6 PM', 'in 30 minutes', 'Friday at 9am', or
    ISO datetime strings like '2026-06-14T18:00:00'.

    Examples:
      set_reminder('Call mom', 'today at 6 PM')
      set_reminder('Team meeting', 'tomorrow at 9 AM', 'Bring the Q2 report')
      set_reminder('Take medicine', 'in 30 minutes')
    """
    import dateparser
    from datetime import datetime, timezone
    from core.tasks.models import Reminder

    # ── Parse the time string ──
    parsed_time = dateparser.parse(
        remind_at,
        settings={
            'PREFER_DATES_FROM': 'future',   # 'monday' → next Monday, not last
            'RETURN_AS_TIMEZONE_AWARE': True,
            'TO_TIMEZONE': 'UTC',
        }
    )

    if parsed_time is None:
        msg = (
            f"I couldn't understand the time '{remind_at}'. "
            "Try something like 'tomorrow at 6 PM', 'in 30 minutes', or 'Friday at 9am'."
        )
        _log("set_reminder", f"{title} @ {remind_at}", msg, "error")
        return msg

    now = datetime.now(timezone.utc)
    if parsed_time <= now:
        msg = (
            f"That time ('{remind_at}') appears to be in the past. "
            "Please specify a future time."
        )
        _log("set_reminder", f"{title} @ {remind_at}", msg, "error")
        return msg

    # ── Save to MongoDB ──
    try:
        reminder = Reminder(
            user_id=_get_user_id(),
            title=title,
            body=description,
            trigger_at=parsed_time,
            platform_target="all",
        )
        reminder.save()

        # Format a human-readable confirmation time
        local_time_str = parsed_time.strftime("%A, %B %d at %I:%M %p UTC")
        result = (
            f"✅ Reminder set! I'll remind you to '{title}' on {local_time_str}."
        )
        _log("set_reminder", f"{title} @ {remind_at}", result, "success")
        return result

    except Exception as e:
        msg = f"Failed to save reminder: {str(e)}"
        _log("set_reminder", f"{title} @ {remind_at}", msg, "error")
        return msg


# ─────────────────────────────────────────────────────────────────────────
# TOOL REGISTRY — import this from llm_agent.py
# ─────────────────────────────────────────────────────────────────────────

ALL_TOOLS = [
    # Level 1 — Always allowed
    get_current_time,
    get_system_info,
    web_search,
    set_reminder,       # Step 13 — reminder creation (L1, no OS access needed)
    # Level 2 — Requires user opt-in
    open_application,
    run_shell_command,
    control_volume,
    read_file,
    write_file,
    search_files,
    list_directory,
]

