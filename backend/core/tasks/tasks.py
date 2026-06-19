"""
Setu Celery Beat — Reminder Scanner Task (Step 13.4)

Runs every 30 seconds (configured in settings.CELERY_BEAT_SCHEDULE).
Scans for due reminders and pushes them to the user's active WebSocket session.

Push target: user_{user_id} channel group
  → handled by AgentStreamConsumer.reminder_notification()
"""

import logging
from celery import shared_task
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from datetime import datetime, timezone

from .models import Reminder

logger = logging.getLogger('core.tasks')


@shared_task(name='core.tasks.tasks.check_and_fire_reminders')
def check_and_fire_reminders() -> int:
    """
    Periodic task: scan for due reminders and push them to connected clients.

    A reminder is "due" when:
      - trigger_at <= now (UTC)
      - is_completed is False

    Marks each reminder as completed BEFORE pushing to prevent double-firing
    if the WebSocket push takes time or the task is retried.

    Returns:
        Number of reminders fired in this run.
    """
    now = datetime.now(timezone.utc)
    channel_layer = get_channel_layer()

    due_reminders = Reminder.objects(trigger_at__lte=now, is_completed=False)

    fired_count = 0
    for reminder in due_reminders:
        # Mark completed first — safe failure mode if push fails
        reminder.is_completed = True
        reminder.save()

        try:
            async_to_sync(channel_layer.group_send)(
                f'user_{reminder.user_id}',
                {
                    'type': 'reminder_notification',
                    'reminder_id': reminder.reminder_id,
                    'title': reminder.title,
                    'body': reminder.body or '',
                }
            )
            fired_count += 1
            logger.info("Fired reminder '%s' for user %s", reminder.title, reminder.user_id)
        except Exception as e:
            # User is offline — reminder is already marked completed, no retry needed
            logger.warning(
                "Could not push reminder %s to user %s (likely offline): %s",
                reminder.reminder_id, reminder.user_id, e
            )

    if fired_count:
        logger.info("Reminder scanner: fired %d reminder(s) at %s", fired_count, now.isoformat())

    return fired_count
