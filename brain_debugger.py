import os
import time
import sys

# Color definitions
class Colors:
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    MAGENTA = '\033[95m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def tail_f(filename):
    """Wait for a file to exist, then tail -f it."""
    print(f"{Colors.CYAN}{Colors.BOLD}===================================================={Colors.RESET}")
    print(f"{Colors.CYAN}{Colors.BOLD}🧠 SETU BRAIN DEBUGGER ONLINE 🧠{Colors.RESET}")
    print(f"{Colors.CYAN}Waiting for brain activity in {filename}...{Colors.RESET}")
    print(f"{Colors.CYAN}{Colors.BOLD}===================================================={Colors.RESET}")

    # Wait until the file is created
    while not os.path.exists(filename):
        time.sleep(1)

    with open(filename, 'r', encoding='utf-8') as f:
        # Seek to the end of the file so we only see new events
        f.seek(0, os.SEEK_END)
        while True:
            line = f.readline()
            if not line:
                time.sleep(0.1)
                continue
            
            line = line.strip()
            if not line:
                continue

            # Colorize based on content
            if "🚀 [NEW PROMPT]" in line:
                print(f"\n{Colors.MAGENTA}{Colors.BOLD}{line}{Colors.RESET}")
            elif "🧠 [BRAIN]" in line:
                print(f"{Colors.CYAN}{line}{Colors.RESET}")
            elif "🛠️  [TOOL SELECTED]" in line:
                print(f"{Colors.YELLOW}{line}{Colors.RESET}")
            elif "✅ [TOOL FINISHED]" in line:
                print(f"{Colors.GREEN}{line}{Colors.RESET}")
            else:
                print(line)

if __name__ == '__main__':
    log_file = os.path.join(os.path.dirname(__file__), "backend", "brain_debug.log")
    try:
        tail_f(log_file)
    except KeyboardInterrupt:
        print(f"\n{Colors.RED}Debugger disconnected.{Colors.RESET}")
        sys.exit(0)
