import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.tools import tool
from langchain_core.globals import set_llm_cache
from langchain_core.caches import InMemoryCache
from tenacity import retry, stop_after_attempt, wait_exponential
import datetime
import re

# Load environment variables (API keys)
load_dotenv()

# Layer 1: Initialize Caching
set_llm_cache(InMemoryCache())

@tool
def get_current_time(query: str = "") -> str:
    """Use this tool to get the current time."""
    return datetime.datetime.now().strftime("%I:%M %p")

class POOKIEAgent:
    def __init__(self):
        print("Initializing LangChain Agents (Groq primary, OpenRouter fallback)...")
        if not os.getenv("GROQ_API_KEY"):
            print("WARNING: GROQ_API_KEY is not set.")
        if not os.getenv("OPENROUTER_API_KEY"):
            print("WARNING: OPENROUTER_API_KEY is not set.")
            
        self.tools = [get_current_time]
        self.system_prompt = "You are Pookie, a helpful and concise voice assistant. Do not use raw XML tags or output unformatted tool calls in your response. Answer conversationally. If you don't know the answer or lack the capability, just say so."
        
        # Conversational Memory
        self.memory = MemorySaver()
        
        # Primary LLM: Groq
        self.primary_llm = ChatGroq(model="llama-3.1-8b-instant")
        self.primary_agent = create_react_agent(self.primary_llm, self.tools, prompt=self.system_prompt, checkpointer=self.memory)
        
        # Fallback LLM: OpenRouter (Free Llama 3 8B)
        self.fallback_llm = ChatOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENROUTER_API_KEY", "dummy"),
            model="meta-llama/llama-3-8b-instruct:free"
        )
        self.fallback_agent = create_react_agent(self.fallback_llm, self.tools, prompt=self.system_prompt, checkpointer=self.memory)
        print("Agents Initialized.")

    # Layer 2: Automatic Retries (Wait 1s, 2s, 4s...)
    @retry(
        stop=stop_after_attempt(3), 
        wait=wait_exponential(multiplier=1, min=1, max=5),
        reraise=True
    )
    def _invoke_primary(self, user_input: str, config: dict):
        return self.primary_agent.invoke({"messages": [("user", user_input)]}, config=config)

    def run(self, user_input: str) -> str:
        # Standard thread ID for local single-user sessions
        config = {"configurable": {"thread_id": "pookie_local_session"}}
        
        try:
            # Try Primary (Groq) with Retries
            result = self._invoke_primary(user_input, config)
            response_text = result["messages"][-1].content
            
            # Scrub hallucinated Llama 3 tool call tags or XML so TTS doesn't read them
            response_text = re.sub(r'\(function=[^>]+>.*?</function>\)', '', response_text)
            response_text = re.sub(r'<[^>]+>', '', response_text)
            
            return response_text.strip()
        except Exception as e:
            error_msg = str(e).lower()
            if "429" in error_msg or "rate limit" in error_msg or "too many requests" in error_msg:
                print(f"Primary rate limit hit after retries. Falling back to OpenRouter...")
                
                # Layer 3: Fallback Routing
                try:
                    fallback_result = self.fallback_agent.invoke({"messages": [("user", user_input)]}, config=config)
                    response_text = fallback_result["messages"][-1].content
                    
                    response_text = re.sub(r'\(function=[^>]+>.*?</function>\)', '', response_text)
                    response_text = re.sub(r'<[^>]+>', '', response_text)
                    
                    return response_text.strip()
                except Exception as fallback_e:
                    print(f"Fallback error: {fallback_e}")
                    # Layer 4: Graceful Degradation
                    return "Oops! I'm thinking about too many things right now. Give me a second and ask again!"
            else:
                print(f"Agent error: {e}")
                return "I'm sorry, I encountered an error while thinking."
