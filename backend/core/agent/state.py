import logging

logger = logging.getLogger('core.agent')

agent_instance = None
tts_engine = None
fast_router = None
tts_cache = None
stt_pipeline = None

def init_models():
    global agent_instance, tts_engine, fast_router, tts_cache, stt_pipeline
    
    if agent_instance is not None:
        return  # Already initialized
        
    logger.info("Starting centralized ML model initialization (App Config)...")
    
    from core.agent.llm_agent import SetuAgent
    from core.agent.fast_responses import FastResponseRouter
    from core.agent.tts_cache import TTSCache
    from core.ai.tts import TTSEngine
    from core.ai.stt import STTPipeline

    agent_instance = SetuAgent()
    tts_engine = TTSEngine()
    fast_router = FastResponseRouter()
    tts_cache = TTSCache()
    stt_pipeline = STTPipeline()
    
    # Pre-warm common greetings asynchronously at server boot
    tts_cache.warm_cache(tts_engine, user_names=["there", "User", "dost", "daved"])
    logger.info("Centralized ML model initialization complete.")
