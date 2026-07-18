"""
Step 13.5 — Reminder URL Registration

Registered under /api/v1/reminders/ in setu/urls.py (already done).

Routes:
  GET  /api/v1/reminders/                → ReminderListView.get
  POST /api/v1/reminders/                → ReminderListView.post
  DELETE /api/v1/reminders/<reminder_id>/ → ReminderDetailView.delete
"""

from django.urls import path
from .views import ReminderListView, ReminderDetailView

urlpatterns = [
    path('', ReminderListView.as_view(), name='reminders_list'),
    path('<str:reminder_id>/', ReminderDetailView.as_view(), name='reminder_detail'),
]
