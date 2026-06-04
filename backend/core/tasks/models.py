import mongoengine as me
import uuid
from datetime import datetime, timezone

class CommandLog(me.Document):
    log_id = me.StringField(default=lambda: str(uuid.uuid4()))
    user_id = me.StringField(required=True)
    timestamp = me.DateTimeField(default=lambda: datetime.now(timezone.utc))
    intent = me.StringField(null=True)
    tool_name = me.StringField(null=True)
    tool_parameters = me.DictField(default=dict)
    result_success = me.BooleanField(default=True)
    error_message = me.StringField(null=True)
    execution_time_ms = me.IntField(null=True)
    platform = me.StringField(default="windows")
    permission_level_used = me.IntField(default=1)
    
    meta = {
        'collection': 'command_logs',
        'indexes': [
            ('user_id', '-timestamp'),
            {'fields': ['timestamp'], 'expireAfterSeconds': 7776000}  # 90 day TTL
        ]
    }

class Reminder(me.Document):
    reminder_id = me.StringField(default=lambda: str(uuid.uuid4()))
    user_id = me.StringField(required=True)
    title = me.StringField(required=True)
    body = me.StringField(default="")
    trigger_at = me.DateTimeField(required=True)
    is_recurring = me.BooleanField(default=False)
    recurrence_rule = me.StringField(null=True)  # iCal RRULE format
    is_completed = me.BooleanField(default=False)
    created_at = me.DateTimeField(default=lambda: datetime.now(timezone.utc))
    platform_target = me.StringField(default="all")
    
    meta = {
        'collection': 'reminders',
        'indexes': [
            ('user_id', 'trigger_at'),
            ('trigger_at', 'is_completed')
        ]
    }
