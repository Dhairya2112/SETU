from django.apps import AppConfig
import threading
import time
import os
import logging

logger = logging.getLogger('core.reminders')

def run_reminder_scheduler():
    # Only run in the main process (skip Django's auto-reloader sub-process)
    # Under Daphne, RUN_MAIN will not be set, but DJANGO_DEBUG might be True/False.
    # If running with runserver, RUN_MAIN is 'true' in the actual execution thread.
    is_run_main = os.environ.get('RUN_MAIN') == 'true'
    is_reloader = os.environ.get('RUN_MAIN') is not None and not is_run_main
    
    if not is_reloader:
        time.sleep(5)  # Wait for Django setup
        logger.info("Background reminder scheduler thread started.")
        from core.reminders.tasks import check_and_fire_reminders
        while True:
            try:
                check_and_fire_reminders()
            except Exception as e:
                logger.error("Error in reminder scheduler: %s", e)
            time.sleep(30)

class RemindersConfig(AppConfig):
    name = 'core.reminders'

    def ready(self):
        import sys
        # Do not start scheduler thread during Django administrative or testing commands
        if any(cmd in sys.argv for cmd in ['migrate', 'makemigrations', 'test', 'check', 'showmigrations', 'collectstatic']):
            return

        t = threading.Thread(target=run_reminder_scheduler, daemon=True)
        t.start()
