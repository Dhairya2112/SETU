import asyncio
import threading
import time
import logging
from playwright.async_api import async_playwright

logger = logging.getLogger("core.agent.browser")

class BrowserManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if not cls._instance:
                cls._instance = super(BrowserManager, cls).__new__(cls)
                cls._instance._init_manager()
            return cls._instance

    def _init_manager(self):
        self.loop = None
        self.loop_thread = None
        self.playwright = None
        self.sessions = {}  # user_id -> { "browser": ..., "context": ..., "page": ..., "last_accessed": ... }
        self.running = True

        # Start the dedicated event loop thread
        import platform
        if platform.system() == "Windows":
            self.loop = asyncio.ProactorEventLoop()
        else:
            self.loop = asyncio.new_event_loop()
        self.loop_thread = threading.Thread(target=self._run_loop, daemon=True, name="SetuPlaywrightLoop")
        self.loop_thread.start()

        # Run setup on the loop
        future = asyncio.run_coroutine_threadsafe(self._setup_playwright(), self.loop)
        future.result()  # Wait for initialization to complete

        # Start the inactivity checker thread
        self.cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True, name="SetuPlaywrightCleanup")
        self.cleanup_thread.start()

    def _run_loop(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    async def _setup_playwright(self):
        self.playwright = await async_playwright().start()
        import os
        headless = os.getenv("PLAYWRIGHT_HEADLESS", "True").lower() == "true"
        self.browser = await self.playwright.chromium.launch(headless=headless, slow_mo=300)

    def _cleanup_loop(self):
        while self.running:
            time.sleep(30)
            now = time.time()
            users_to_close = []
            for user_id, session in list(self.sessions.items()):
                if now - session["last_accessed"] > 300:  # 5 minutes of inactivity
                    users_to_close.append(user_id)
            
            for user_id in users_to_close:
                logger.info("Closing inactive browser session for user %s", user_id)
                self.close_session(user_id)

    async def _get_page_async(self, user_id: str):
        now = time.time()
        if user_id in self.sessions:
            session = self.sessions[user_id]
            session["last_accessed"] = now
            try:
                page = session["page"]
                if not page.is_closed():
                    return page
            except Exception as e:
                logger.warning("Failed to reuse session page: %s", e)
                pass
            
            # Recreate session if broken
            await self._close_session_async(user_id)

        logger.info("Launching new browser context for user %s", user_id)
        context = await self.browser.new_context(
            viewport={"width": 1280, "height": 720},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        self.sessions[user_id] = {
            "context": context,
            "page": page,
            "last_accessed": now
        }
        return page

    async def _close_session_async(self, user_id: str):
        session = self.sessions.pop(user_id, None)
        if session:
            try:
                await session["page"].close()
            except Exception:
                pass
            try:
                await session["context"].close()
            except Exception:
                pass

    def get_page(self, user_id: str):
        """Submit page retrieval to the event loop thread and wait for result."""
        coro = self._get_page_async(user_id)
        future = asyncio.run_coroutine_threadsafe(coro, self.loop)
        return future.result()

    def close_session(self, user_id: str):
        coro = self._close_session_async(user_id)
        future = asyncio.run_coroutine_threadsafe(coro, self.loop)
        future.result()

    async def _shutdown_async(self):
        for user_id in list(self.sessions.keys()):
            await self._close_session_async(user_id)
        if hasattr(self, 'browser') and self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
            self.playwright = None

    def shutdown(self):
        self.running = False
        coro = self._shutdown_async()
        future = asyncio.run_coroutine_threadsafe(coro, self.loop)
        future.result()
        self.loop.call_soon_threadsafe(self.loop.stop)

    # ── High Level Actions executed on the Playwright Loop Thread ──

    def navigate(self, user_id: str, url: str) -> str:
        async def _action():
            page = await self._get_page_async(user_id)
            await page.goto(url, wait_until="load", timeout=30000)
            return f"Successfully navigated to {page.url}"
        
        try:
            future = asyncio.run_coroutine_threadsafe(_action(), self.loop)
            return future.result()
        except Exception as e:
            return f"Error navigating to {url}: {str(e)}"

    def click(self, user_id: str, selector: str) -> str:
        async def _action():
            page = await self._get_page_async(user_id)
            try:
                # 1. Try selector directly
                loc = page.locator(selector)
                await loc.first.click(timeout=5000)
                return f"Successfully clicked element '{selector}'"
            except Exception as e1:
                # 2. Try text match fallback if not a strict CSS selector
                if not selector.startswith((".", "#", "[", "xpath=")):
                    try:
                        loc = page.get_by_text(selector, exact=False)
                        await loc.first.click(timeout=5000)
                        return f"Successfully clicked element by text '{selector}'"
                    except Exception as e2:
                        raise Exception(f"Selector click failed: {e1}. Text fallback click failed: {e2}")
                else:
                    raise e1

        try:
            future = asyncio.run_coroutine_threadsafe(_action(), self.loop)
            return future.result()
        except Exception as e:
            return f"Error clicking '{selector}': {str(e)}"

    def type_text(self, user_id: str, selector: str, text: str) -> str:
        async def _action():
            page = await self._get_page_async(user_id)
            try:
                # 1. Try selector directly
                loc = page.locator(selector)
                await loc.first.fill(text, timeout=5000)
                return f"Successfully typed text into '{selector}'"
            except Exception as e1:
                # 2. Try text match fallback if not a strict CSS selector
                if not selector.startswith((".", "#", "[", "xpath=")):
                    try:
                        loc = page.get_by_text(selector, exact=False)
                        await loc.first.fill(text, timeout=5000)
                        return f"Successfully typed text into element matched by text '{selector}'"
                    except Exception as e2:
                        raise Exception(f"Selector fill failed: {e1}. Text fallback fill failed: {e2}")
                else:
                    raise e1

        try:
            future = asyncio.run_coroutine_threadsafe(_action(), self.loop)
            return future.result()
        except Exception as e:
            return f"Error typing into '{selector}': {str(e)}"

    def get_content(self, user_id: str) -> str:
        async def _action():
            page = await self._get_page_async(user_id)
            # Return text of body
            content = await page.locator("body").inner_text()
            return content

        try:
            future = asyncio.run_coroutine_threadsafe(_action(), self.loop)
            return future.result()
        except Exception as e:
            return f"Error getting content: {str(e)}"

    def submit(self, user_id: str, selector: str) -> str:
        async def _action():
            page = await self._get_page_async(user_id)
            try:
                # 1. Try selector directly
                loc = page.locator(selector)
                await loc.first.press("Enter", timeout=5000)
                return f"Successfully pressed Enter on '{selector}'"
            except Exception as e1:
                # 2. Try text match fallback if not a strict CSS selector
                if not selector.startswith((".", "#", "[", "xpath=")):
                    try:
                        loc = page.get_by_text(selector, exact=False)
                        await loc.first.press("Enter", timeout=5000)
                        return f"Successfully pressed Enter on element matched by text '{selector}'"
                    except Exception as e2:
                        raise Exception(f"Selector enter failed: {e1}. Text fallback enter failed: {e2}")
                else:
                    raise e1

        try:
            future = asyncio.run_coroutine_threadsafe(_action(), self.loop)
            return future.result()
        except Exception as e:
            return f"Error submitting '{selector}': {str(e)}"
