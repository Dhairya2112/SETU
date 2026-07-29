
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
    uid = user_id_var.get()
    if uid == "anonymous":
        import logging
        logging.getLogger('core.agent').warning("Tool executed without user_id context! Defaulting to anonymous.")
    return uid


def _get_conversation_id() -> str:
    cid = conversation_id_var.get()
    if cid == "unknown":
        import logging
        logging.getLogger('core.agent').warning("Tool executed without conversation_id context! Defaulting to unknown.")
    return cid


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

def request_interactive_permission(target_path: str, action: str) -> bool:
    """Pause the tool thread and ask the frontend user for permission."""
    from core.users.models import User
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer
    from core.agent.state import register_permission_request, get_permission_status, clear_permission_request
    import uuid
    
    user_id = _get_user_id()
    
    # 1. Check trust mode
    if user_id != "local":
        user = User.objects(user_id=user_id).first()
        if user and user.preferences and getattr(user.preferences, 'trust_mode', False):
            return True
            
    # 2. Trigger interactive websocket prompt
    request_id = uuid.uuid4().hex
    event = register_permission_request(request_id)
    channel_layer = get_channel_layer()
    
    async_to_sync(channel_layer.group_send)(
        f'user_{user_id}',
        {
            'type': 'agent_message',
            'chunk_type': 'permission_request',
            'message': {
                'request_id': request_id,
                'path': str(target_path),
                'action': action
            }
        }
    )
    
    # 3. Block and wait for frontend (60s timeout)
    event.wait(timeout=60)
    status = get_permission_status(request_id)
    clear_permission_request(request_id)
    
    return status == 'allowed'


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


import re
import ctypes

def find_drive_by_label(target_label: str) -> str | None:
    """Scan all active Windows drives and return the drive path matching the volume label."""
    target_label = target_label.strip().lower()
    if platform.system() != "Windows":
        return None

    # Scan A:\ to Z:\
    for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        drive_path = f"{letter}:\\"
        if os.path.exists(drive_path):
            try:
                volume_name = ctypes.create_unicode_buffer(1024)
                res = ctypes.windll.kernel32.GetVolumeInformationW(
                    drive_path,
                    volume_name,
                    ctypes.sizeof(volume_name),
                    None, None, None, None, 0
                )
                if res and volume_name.value.strip().lower() == target_label:
                    return drive_path
            except Exception:
                pass
    return None


def _open_drive_explorer(drive_path: str, app_name: str) -> str:
    """Helper to open the system file manager at drive_path."""
    try:
        if platform.system() == "Windows":
            subprocess.Popen(f'explorer.exe "{drive_path}"', shell=True)
        else:
            open_cmd = "open" if platform.system() == "Darwin" else "xdg-open"
            subprocess.Popen([open_cmd, drive_path])
        result = f"Opened drive at {drive_path} successfully (request: '{app_name}')."
        _log("open_application", app_name, result, "success")
        return result
    except Exception as e:
        result = f"Error opening drive {drive_path}: {e}"
        _log("open_application", app_name, result, "error")
        return result


@tool
def open_application(app_name: str, file_path: str = "") -> str:
    """
    Open a desktop application by name (e.g., 'chrome', 'notepad', 'code', 'spotify'). Requires Level 2 permission.
    If you want to open a specific file or URL in the application, provide it in the optional `file_path` argument.
    CRITICAL: Do NOT use this tool if the user wants to automate the web (e.g., 'play a video on youtube', 'search google'). Use `auto_browse` for that instead. Only use this if they just want the app opened and nothing else.
    """
    if not check_permission(_get_user_id(), required_level=2):
        _log("open_application", app_name, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    # Prevent shell injection: reject any input containing shell command separators or redirects
    if any(char in app_name for char in ['&', '|', ';', '>', '<', '`', '$', '\n', '\r']):
        msg = "🚫 Invalid application name format. Safety block."
        _log("open_application", app_name, msg, "blocked")
        return msg

    name_lower = app_name.strip().lower()
    
    # ── Drive Resolver Check (No Regex) ──
    words = name_lower.replace("\\", "").split()
    
    # 1. Direct drive letter (e.g. "c:", "c drive", "drive c")
    letter = None
    if len(words) == 1 and words[0].endswith(":"):
        possible_letter = words[0][:-1]
        if len(possible_letter) == 1 and possible_letter.isalpha():
            letter = possible_letter
    elif len(words) == 2 and "drive" in words:
        possible_letter = words[0] if words[1] == "drive" else words[1]
        if len(possible_letter) == 1 and possible_letter.isalpha():
            letter = possible_letter
            
    if letter:
        drive_path = f"{letter.upper()}:\\"
        if os.path.exists(drive_path):
            return _open_drive_explorer(drive_path, app_name)
            
    # 2. Volume label (e.g. "luffy drive")
    if name_lower.endswith(" drive") and len(name_lower) > 6:
        label = name_lower[:-6].strip()
        if len(label) > 1:
            drive_path = find_drive_by_label(label)
            if drive_path:
                return _open_drive_explorer(drive_path, app_name)

    # Map common names to actual executables or macOS App names
    app_aliases: dict[str, list[str]] = {
        # Browsers
        "chrome": ["Google Chrome", "chrome", "google-chrome", "google-chrome-stable"],
        "firefox": ["Firefox", "firefox"],
        "edge": ["Microsoft Edge", "msedge", "microsoft-edge"],
        "brave": ["Brave Browser", "brave", "brave-browser"],
        "safari": ["Safari", "safari"],
        # Dev tools
        "code": ["Visual Studio Code", "code"],
        "vscode": ["Visual Studio Code", "code"],
        "vs code": ["Visual Studio Code", "code"],
        "terminal": ["Terminal", "iterm", "wt", "cmd"] if platform.system() in ["Windows", "Darwin"] else ["gnome-terminal", "x-terminal-emulator"],
        # System
        "notepad": ["TextEdit", "notepad"] if platform.system() in ["Windows", "Darwin"] else ["gedit", "nano"],
        "calculator": ["Calculator", "calc"] if platform.system() in ["Windows", "Darwin"] else ["gnome-calculator"],
        "file explorer": ["Finder", "explorer"] if platform.system() in ["Windows", "Darwin"] else ["nautilus"],
        "explorer": ["Finder", "explorer"] if platform.system() in ["Windows", "Darwin"] else ["nautilus"],
        "files": ["Finder", "explorer"] if platform.system() in ["Windows", "Darwin"] else ["nautilus"],
        # Media
        "spotify": ["Spotify", "spotify"],
        "vlc": ["VLC", "vlc"],
        # Communication
        "discord": ["Discord", "discord"],
        "slack": ["Slack", "slack"],
        "teams": ["Microsoft Teams", "teams", "msteams"],
        "whatsapp": ["WhatsApp", "whatsapp"],
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
            import webbrowser
            webbrowser.open(url)
            result = f"Opened website {url} in your default browser."
            _log("open_application", app_name, result, "success")
            return result
        except Exception as e:
            result = f"Error opening URL {url}: {str(e)}"
            _log("open_application", app_name, result, "error")
            return result

    # Otherwise, try opening it as a local system application
    candidates = app_aliases.get(name_lower, [name_lower])

    def find_app_path(candidate: str) -> str | None:
        import shutil
        names = [candidate]
        if not candidate.endswith(".exe"):
            names.append(candidate + ".exe")
        for name in names:
            path = shutil.which(name)
            if path:
                return path
            if platform.system() == "Windows":
                import winreg
                for hive in [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]:
                    try:
                        key_path = f"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\{name}"
                        with winreg.OpenKey(hive, key_path) as key:
                            val, _ = winreg.QueryValueEx(key, "")
                            if val:
                                return val
                    except FileNotFoundError:
                        continue
        return None

    try:
        for candidate in candidates:
            try:
                if platform.system() == "Windows":
                    resolved = find_app_path(candidate)
                    if not resolved:
                        if candidate in ["explorer", "cmd", "wt", "calc", "notepad"]:
                            resolved = candidate
                        else:
                            continue
                    cmd = f'"{resolved}"' if resolved != candidate else resolved
                    if file_path:
                        cmd += f' "{file_path}"'
                    subprocess.Popen(
                        cmd,
                        shell=True,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                elif platform.system() == "Darwin":
                    # On Mac, 'open -a' is the native way to launch apps by name
                    cmd_args = ["open", "-a", candidate]
                    if file_path:
                        cmd_args.append(file_path)
                    res = subprocess.run(
                        cmd_args,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    if res.returncode != 0:
                        cmd_args_fallback = ["open", "-a", app_name]
                        if file_path:
                            cmd_args_fallback.append(file_path)
                        res_fallback = subprocess.run(
                            cmd_args_fallback,
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                        )
                        if res_fallback.returncode != 0:
                            continue
                else:
                    cmd_args = [candidate]
                    if file_path:
                        cmd_args.append(file_path)
                    subprocess.Popen(
                        cmd_args,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                result = f"Opened {app_name} successfully."
                _log("open_application", app_name, result, "success")
                return result
            except (FileNotFoundError, subprocess.CalledProcessError):
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

    # Windows: Use native ctypes COM interface for WASAPI (pycaw-like, zero-dependency)
    try:
        import ctypes
        from ctypes import HRESULT, POINTER, c_float, c_int, c_bool, c_void_p, byref
        from ctypes.wintypes import DWORD

        class GUID(ctypes.Structure):
            _fields_ = [
                ("Data1", DWORD),
                ("Data2", ctypes.c_ushort),
                ("Data3", ctypes.c_ushort),
                ("Data4", ctypes.c_ubyte * 8)
            ]
            def __init__(self, l, w1, w2, b):
                self.Data1 = l
                self.Data2 = w1
                self.Data3 = w2
                for i in range(8):
                    self.Data4[i] = b[i]

        CLSID_MMDeviceEnumerator = GUID(0xBCDE0395, 0xE52F, 0x467C, [0x8E, 0x3D, 0xC4, 0x57, 0x92, 0x91, 0x69, 0x2E])
        IID_IMMDeviceEnumerator = GUID(0xA95664D2, 0x9614, 0x4F35, [0xA7, 0x46, 0xDE, 0x8D, 0xB6, 0x36, 0x17, 0xE6])
        IID_IAudioEndpointVolume = GUID(0x5CDF2C82, 0x841E, 0x4546, [0x97, 0x22, 0x0C, 0xF7, 0x40, 0x78, 0x22, 0x9A])

        def call_vtable(obj, index, arg_types, args):
            vtable = ctypes.cast(obj, POINTER(c_void_p))[0]
            func_ptr = ctypes.cast(vtable, POINTER(c_void_p))[index]
            prototype = ctypes.WINFUNCTYPE(HRESULT, *([c_void_p] + arg_types))
            func = prototype(func_ptr)
            return func(obj, *args)

        # Initialize COM
        ctypes.windll.ole32.CoInitialize(None)

        enumerator = c_void_p()
        hr = ctypes.windll.ole32.CoCreateInstance(
            byref(CLSID_MMDeviceEnumerator),
            None,
            1,
            byref(IID_IMMDeviceEnumerator),
            byref(enumerator)
        )
        if hr < 0:
            raise Exception("Failed to create MMDeviceEnumerator.")

        device = c_void_p()
        hr = call_vtable(enumerator, 4, [c_int, c_int, POINTER(c_void_p)], [0, 0, byref(device)])
        if hr < 0:
            call_vtable(enumerator, 2, [], [])
            raise Exception("Failed to get default audio endpoint.")

        volume = c_void_p()
        hr = call_vtable(device, 3, [POINTER(GUID), DWORD, c_void_p, POINTER(c_void_p)], [byref(IID_IAudioEndpointVolume), 1, None, byref(volume)])
        if hr < 0:
            call_vtable(device, 2, [], [])
            call_vtable(enumerator, 2, [], [])
            raise Exception("Failed to activate IAudioEndpointVolume.")

        # Cleanup intermediate COM objects
        call_vtable(device, 2, [], [])
        call_vtable(enumerator, 2, [], [])

        if action == "mute":
            call_vtable(volume, 14, [c_bool, c_void_p], [True, None])
            result = "Volume muted."
        elif action == "unmute":
            call_vtable(volume, 14, [c_bool, c_void_p], [False, None])
            result = "Volume unmuted."
        elif action == "get":
            mute = c_bool()
            call_vtable(volume, 15, [POINTER(c_bool)], [byref(mute)])
            vol_val = c_float()
            call_vtable(volume, 9, [POINTER(c_float)], [byref(vol_val)])
            status_str = "Muted" if mute.value else "Unmuted"
            result = f"Volume: {int(vol_val.value * 100)}% ({status_str})."
        elif action.isdigit():
            level = max(0, min(100, int(action)))
            level_float = level / 100.0
            call_vtable(volume, 7, [c_float, c_void_p], [level_float, None])
            result = f"Volume set to {level}%."
        else:
            result = f"Unknown volume action '{action}'. Use 'mute', 'unmute', 'get', or a number like '50'."

        # Release volume COM interface
        call_vtable(volume, 2, [], [])
        _log("control_volume", action, result, "success")
        return result

    except Exception as e:
        msg = f"Volume control error: {e}"
        _log("control_volume", action, msg, "error")
        return msg


@tool
def web_search(query: str) -> str:
    """
    Search the web using DuckDuckGo. 
    CRITICAL WARNING: This tool is currently broken and unreliable. Do NOT use this tool. You MUST use the `gather_information` tool instead for all searching, gathering, or researching tasks.
    """
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
    """Read the contents of a local file. Requires Level 2 permission. If the user does not specify a folder, ALWAYS assume the file is in '~/SETU/Data/' (e.g., '~/SETU/Data/demo.txt'). ONLY use other paths like '~/Desktop/' if explicitly requested."""
    if not check_permission(_get_user_id(), required_level=2):
        _log("read_file", file_path, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    if not is_path_allowed(file_path, _get_user_id()):
        if not request_interactive_permission(file_path, "read"):
            msg = f"🚫 Access denied. User declined permission to read '{file_path}'."
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
    """Create or overwrite a file with the given content. Requires Level 2 permission. If the user does not specify a folder, ALWAYS save to '~/SETU/Data/' (e.g., '~/SETU/Data/demo.txt'). ONLY use other paths like '~/Desktop/' if explicitly requested."""
    if not check_permission(_get_user_id(), required_level=2):
        _log("write_file", file_path, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    if not is_path_allowed(file_path, _get_user_id()):
        if not request_interactive_permission(file_path, "write/create"):
            msg = f"🚫 Access denied. User declined permission to write to '{file_path}'."
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

    if not is_path_allowed(directory, _get_user_id()):
        if not request_interactive_permission(directory, "search inside"):
            msg = f"🚫 Access denied. User declined permission to search in '{directory}'."
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
def list_directory(directory: str = "~/SETU/Data/") -> str:
    """List all files and folders in a directory. Requires Level 2 permission. If the user does not specify a folder, ALWAYS use '~/SETU/Data/'. ONLY use other paths if explicitly requested."""
    if not check_permission(_get_user_id(), required_level=2):
        _log("list_directory", directory, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    if not is_path_allowed(directory, _get_user_id()):
        if not request_interactive_permission(directory, "list contents of"):
            msg = f"🚫 Access denied. User declined permission to view '{directory}'."
            _log("list_directory", directory, msg, "blocked")
            return msg

    try:
        path = Path(directory).expanduser().resolve()
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
# 13.3  REMINDER TOOL
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
    from core.reminders.models import Reminder

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
# 18.2  BROWSER AUTOMATION TOOLS
# ─────────────────────────────────────────────────────────────────────────

from .browser import BrowserManager

browser_mgr = BrowserManager()


@tool
def navigate_browser(url: str) -> str:
    """
    Open browser and navigate to the specified URL. Requires Level 2 permission.
    Example: navigate_browser("https://youtube.com")
    """
    if not check_permission(_get_user_id(), required_level=2):
        _log("navigate_browser", url, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    result = browser_mgr.navigate(_get_user_id(), url)
    _log("navigate_browser", url, result, "success" if not result.startswith("Error") else "error")
    return result


@tool
def click_element(selector: str) -> str:
    """
    Click a CSS selector or visible text on the current browser page. Requires Level 2 permission.
    Example: click_element("#search-button") or click_element("Sign In")
    """
    if not check_permission(_get_user_id(), required_level=2):
        _log("click_element", selector, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    result = browser_mgr.click(_get_user_id(), selector)
    _log("click_element", selector, result, "success" if not result.startswith("Error") else "error")
    return result


@tool
def type_into_field(selector: str, text: str) -> str:
    """
    Type text into an input or form field on the current browser page. Requires Level 2 permission.
    Example: type_into_field("input[name='search']", "setu assistant")
    """
    if not check_permission(_get_user_id(), required_level=2):
        _log("type_into_field", f"{selector} | {text}", PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    result = browser_mgr.type_text(_get_user_id(), selector, text)
    _log("type_into_field", f"{selector} | {text}", result, "success" if not result.startswith("Error") else "error")
    return result


@tool
def get_page_content(query: str = "") -> str:
    """
    Get the visible text content of the current active browser page. Requires Level 2 permission.
    Use this to read and understand what is currently displayed on the page.
    """
    if not check_permission(_get_user_id(), required_level=2):
        _log("get_page_content", query, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    result = browser_mgr.get_content(_get_user_id())
    
    if result and ("Our systems have detected unusual traffic" in result or "About this page" in result or "solving the above CAPTCHA" in result):
        msg = "🛑 CAPTCHA BLOCKED: Google suspects we are a bot! Stop your current browser task immediately. Tell the user they need to manually solve the CAPTCHA in the open browser window. Do not finish the task, ask them to say 'done' when solved."
        _log("get_page_content", query, msg, "blocked")
        return msg
        
    _log("get_page_content", query, result[:100], "success" if not result.startswith("Error") else "error")
    return result


@tool
def submit_form(selector: str = "form") -> str:
    """
    Submit a form or press Enter on a selector on the current browser page. Requires Level 2 permission.
    Example: submit_form("input[type='password']") or submit_form("form")
    """
    if not check_permission(_get_user_id(), required_level=2):
        _log("submit_form", selector, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    result = browser_mgr.submit(_get_user_id(), selector)
    _log("submit_form", selector, result, "success" if not result.startswith("Error") else "error")
    return result


@tool
def auto_browse(goal: str, start_url: str = "") -> str:
    """
    Perform a multi-step browser automation task by fetching HTML and using a post-prompt.
    Use this tool when the user asks to perform complex tasks on the web like "play a video" or "search for something".
    
    CRITICAL: This tool automatically opens its own browser window. DO NOT call `open_application` or `navigate_browser` before calling this tool.
    CRITICAL: When you use this tool, you MUST return the EXACT output string it gives you back to the user. Do not summarize or rephrase it.
    """
    if not check_permission(_get_user_id(), required_level=2):
        _log("auto_browse", goal, PERMISSION_DENIED_MSG, "denied")
        return PERMISSION_DENIED_MSG

    try:
        if start_url:
            browser_mgr.navigate(_get_user_id(), start_url)
            import time
            time.sleep(2)

        from langchain_google_genai import ChatGoogleGenerativeAI
        import os
        llm = ChatGoogleGenerativeAI(model="gemini-3.1-flash-lite", google_api_key=os.getenv("GEMINI_API_KEY"), temperature=0)
        
        executed_steps = []
        import time
        
        # Run up to 3 reasoning cycles so it can navigate, wait, and click results
        for iteration in range(3):
            html_content = browser_mgr.get_content(_get_user_id())
            
            # CAPTCHA DETECTION
            if html_content and ("Our systems have detected unusual traffic" in html_content or "About this page" in html_content or "solving the above CAPTCHA" in html_content):
                msg = "🛑 I have been blocked by a CAPTCHA! Please solve the CAPTCHA manually in the browser window. Once you are done, tell me to 'continue' so I can finish the task."
                _log("auto_browse", goal, msg, "blocked")
                return msg

            prompt = f"""
Look at this HTML. The user's goal is: {goal}.
Previous steps we already took: {executed_steps}

If the goal is already fully complete (e.g. video is playing), output ONLY the word 'DONE'.
Otherwise, write the NEXT steps to take on THIS current page to get closer to the goal.
(use 'click <css_selector_or_visible_text>' when to click, use 'type <selector> <text>' when type, use 'enter <selector>' when enter, use 'wait <seconds>' to wait)

HTML (truncated):
{html_content[:15000]}
            """
            
            response = llm.invoke(prompt)
            if isinstance(response.content, list):
                plan_text = str(response.content[0].get("text", response.content)).strip()
            else:
                plan_text = str(response.content).strip()
            
            if 'DONE' in plan_text.upper() or plan_text.upper() == 'DONE':
                break
                
            for line in plan_text.split('\n'):
                line = line.strip()
                if line.lower().startswith('click '):
                    selector = line[6:].strip().strip("'\"")
                    browser_mgr.click(_get_user_id(), selector)
                    executed_steps.append(f"Clicked {selector}")
                    time.sleep(2)
                elif line.lower().startswith('type '):
                    parts = line[5:].strip().split(' ', 1)
                    if len(parts) == 2:
                        selector = parts[0].strip().strip("'\"")
                        text = parts[1].strip().strip("'\"")
                        browser_mgr.type_text(_get_user_id(), selector, text)
                        executed_steps.append(f"Typed '{text}' into {selector}")
                elif line.lower().startswith('enter '):
                    selector = line[6:].strip().strip("'\"")
                    browser_mgr.submit(_get_user_id(), selector)
                    executed_steps.append(f"Pressed Enter on {selector}")
                    time.sleep(3)
                elif line.lower().startswith('wait '):
                    try:
                        secs = int(line[5:].strip())
                        time.sleep(secs)
                        executed_steps.append(f"Waited {secs} seconds")
                    except ValueError:
                        time.sleep(2)

        # Wait a moment to ensure final page is loaded
        time.sleep(2)
        final_html = browser_mgr.get_content(_get_user_id()) or "No visible content found on final page."
        final_text_snippet = final_html[:4000] # Return the first 4000 chars of the final page so the agent can read it
        
        result = "Browser task execution complete.\n\nSteps taken:\n" + "\n".join(executed_steps) + f"\n\nFINAL PAGE CONTENT (Extract answers from here):\n{final_text_snippet}"
        _log("auto_browse", goal, result, "success")
        return result

    except Exception as e:
        msg = f"Error in auto_browse: {str(e)}"
        _log("auto_browse", goal, msg, "error")
        return msg


@tool
def gather_information(topic: str) -> str:
    """
    Gather detailed information about a topic using internal AI knowledge.
    Use this tool whenever the user asks to "search", "gather information", or "find facts".
    """
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        import os
        llm = ChatGoogleGenerativeAI(model="gemini-3.1-flash-lite", google_api_key=os.getenv("GEMINI_API_KEY"), temperature=0)
        
        prompt = f"The user wants information about something as per this prompt: {topic}. Gather all the information needed by the user and list here ONLY the information. Provide that info to the user by starting with 'Here are some search results...'"
        
        response = llm.invoke(prompt)
        
        # Safely extract content in case it is a list
        if isinstance(response.content, list):
            content_str = str(response.content[0].get("text", response.content))
        else:
            content_str = str(response.content)
            
        _log("gather_information", topic, "Information gathered successfully", "success")
        return content_str
    except Exception as e:
        msg = f"Failed to gather information due to API error: {str(e)}"
        _log("gather_information", topic, msg, "error")
        return msg


# ─────────────────────────────────────────────────────────────────────────
# TOOL REGISTRY — import this from llm_agent.py
# ─────────────────────────────────────────────────────────────────────────

ALL_TOOLS = [
    # Level 1 — Always allowed
    get_current_time,
    get_system_info,
    gather_information, # Added for information gathering without browser
    set_reminder,           # Level 2 — Requires user opt-in
    open_application,
    run_shell_command,
    control_volume,
    read_file,
    write_file,
    search_files,
    list_directory,
        navigate_browser,
    click_element,
    type_into_field,
    get_page_content,
    submit_form,
    auto_browse,        # Phase 2 — Custom post-prompt web automation
]

