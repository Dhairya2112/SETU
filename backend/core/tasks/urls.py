from django.urls import path
from rest_framework.views import APIView
from rest_framework.response import Response

class RemindersView(APIView):
    def get(self, request):
        return Response([])

urlpatterns = [
    path('', RemindersView.as_view(), name='reminders_list'),
]
