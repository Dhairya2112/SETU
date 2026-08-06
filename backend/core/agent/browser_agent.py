import os
import uuid
import logging
import functools
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.tools import tool

from .browser import BrowserManager
from .state import is_cancelled
from .tools import conversation_id_var

logger = logging.getLogger("core.agent.browser_agent")

browser_mgr = BrowserManager()

class CancelledException(Exception):
    """Raised when the user cancels the operation to instantly abort LangGraph."""
    pass

# --- Internal Browser Tools for the Sub-Agent ---

@tool
def read_screen() -> dict:
    """
    Scans the current webpage and returns a list of interactive elements (buttons, links, inputs).
    Each element has a unique [ID]. You MUST use this tool to see what is on the screen before interacting.
    """
    return browser_mgr.read_screen("local")

@tool
def click_element(element_id: int, generation_id: str) -> dict:
    """
    Clicks an element on the screen using its [ID] and the current generation_id provided by read_screen.
    """
    return browser_mgr.click_element("local", element_id, generation_id)

@tool
def type_element(element_id: int, text: str, generation_id: str, press_enter: bool = False) -> dict:
    """
    Types text into an input element using its [ID] and the current generation_id provided by read_screen.
    Set press_enter=True if you need to submit a search bar or form.
    """
    return browser_mgr.type_element("local", element_id, text, generation_id, press_enter)

@tool
def navigate(url: str) -> str:
    """
    Navigates the browser to a specific URL.
    """
    return browser_mgr.navigate("local", url)

BROWSER_TOOLS = [read_screen, click_element, type_element, navigate]

# Wrap tools for cancellation (so Orb cancel interrupts mid-browse)
for orig_tool in BROWSER_TOOLS:
    if not getattr(orig_tool, "_cancellation_wrapped", False):
        original_run = orig_tool._run
        def make_wrapper(run_func):
            @functools.wraps(run_func)
            def wrapped_run(*args, **kwargs):
                conv_id = conversation_id_var.get()
                if is_cancelled(conv_id):
                    raise CancelledException()
                res = run_func(*args, **kwargs)
                if is_cancelled(conv_id):
                    raise CancelledException()
                return res
            return wrapped_run
        
        orig_tool._run = make_wrapper(original_run)
        orig_tool._cancellation_wrapped = True

# --- Browser Agent Setup ---

BROWSER_PROMPT = """
You are a highly capable Browser Sub-Agent. Your task is to execute web automation goals for the user.

RULES:
1. ALWAYS use `navigate` to go to the correct URL if you are not already there.
2. ALWAYS use `read_screen` to get the list of interactive elements and their [ID]s.
3. NEVER guess an element ID. Only use IDs returned by your most recent `read_screen` call.
4. If an element ID is stale, call `read_screen` again.
5. If you need to submit a search bar or form, use `type_element` with `press_enter=True`.
6. Once you have achieved the goal, stop and return a summary of what you did.
"""

browser_memory = MemorySaver()

browser_llm = ChatGoogleGenerativeAI(
    model="gemini-3.1-flash-lite",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    timeout=15
)

browser_graph = create_react_agent(
    browser_llm, BROWSER_TOOLS,
    prompt=BROWSER_PROMPT,
    checkpointer=browser_memory
)

def run_browser_task(goal: str, parent_thread_id: str = "default") -> str:
    """
    Executes a web automation task in an isolated LangGraph thread.
    Capped at 15 cycles using recursion_limit.
    """
    thread_id = f"local:browser:{parent_thread_id}:{uuid.uuid4()}"
    # recursion_limit=15 enforces the hard cap to prevent infinite loops
    config = {"configurable": {"thread_id": thread_id}, "recursion_limit": 15}
    
    logger.info(f"Starting Browser Agent for goal: {goal}")
    
    if is_cancelled(parent_thread_id):
        return "Command cancelled by user."
        
    try:
        result = browser_graph.invoke({"messages": [("user", goal)]}, config=config)
        last_message = result["messages"][-1]
        return str(last_message.content)
        
    except CancelledException:
        logger.info("Browser Agent instantly aborted due to user cancellation.")
        return "Command cancelled by user."
    except Exception as e:
        logger.error(f"Browser Agent Exception: {e}")
        # GraphRecursionError happens when recursion_limit is hit
        if "RecursionError" in str(type(e)):
            return "Browser task failed: Reached maximum 15 iterations without completing the goal."
        return f"Failed during browser task: {str(e)}"
