from django.urls import path
from .views import RegisterView, LoginView, RefreshView, UserProfileView, UserPermissionsView

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', LoginView.as_view(), name='auth_login'),
    path('auth/refresh/', RefreshView.as_view(), name='auth_refresh'),
    path('user/profile/', UserProfileView.as_view(), name='user_profile'),
    path('user/permissions/', UserPermissionsView.as_view(), name='user_permissions'),
]
