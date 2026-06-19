"""
Step 13.2 — Reminder Serializer

Uses plain DRF Serializer (not ModelSerializer) because MongoEngine
Documents are not Django ORM models. Follows the same pattern as
core/conversations/serializers.py.
"""

from rest_framework import serializers
from datetime import datetime, timezone


class ReminderSerializer(serializers.Serializer):
    reminder_id   = serializers.CharField(read_only=True)
    user_id       = serializers.CharField(read_only=True)
    title         = serializers.CharField(max_length=200)
    body          = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")
    trigger_at    = serializers.DateTimeField()
    is_recurring  = serializers.BooleanField(default=False)
    recurrence_rule = serializers.CharField(
        max_length=200,
        required=False,
        allow_null=True,
        allow_blank=True,
        default=None
    )
    is_completed    = serializers.BooleanField(read_only=True)
    created_at      = serializers.DateTimeField(read_only=True)
    platform_target = serializers.CharField(max_length=50, required=False, default="all")

    def validate_trigger_at(self, value):
        """Ensure the reminder is set in the future."""
        now = datetime.now(timezone.utc)
        # Make value timezone-aware if it isn't already
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        if value <= now:
            raise serializers.ValidationError("trigger_at must be a future datetime.")
        return value
