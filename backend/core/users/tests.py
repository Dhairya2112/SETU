from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework import status
from .models import User, RefreshToken

@override_settings(
    DEBUG=True,
    REST_FRAMEWORK={
        'DEFAULT_AUTHENTICATION_CLASSES': (
            'core.users.auth.PyJWTAuthentication',
        ),
        'DEFAULT_THROTTLE_CLASSES': [],
        'DEFAULT_THROTTLE_RATES': {}
    }
)
class OAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Clean MongoDB collections before running tests
        User.objects.delete()
        RefreshToken.objects.delete()

        # Disable throttling on OAuth and auth views dynamically for testing
        from core.users.views import GoogleOAuthView, GitHubOAuthView, RegisterView, LoginView, RefreshView
        for view in [GoogleOAuthView, GitHubOAuthView, RegisterView, LoginView, RefreshView]:
            view.throttle_classes = []

    def tearDown(self):
        # Clean MongoDB collections after running tests
        User.objects.delete()
        RefreshToken.objects.delete()

    def test_google_oauth_mock_flow(self):
        # 1. First login / registration
        response = self.client.post('/api/v1/auth/google/', {'id_token': 'mock_google_token_123'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access_token', response.data)
        self.assertIn('refresh_token', response.data)
        self.assertEqual(response.data['user']['email'], 'test_google@example.com')
        self.assertEqual(response.data['user']['preferences']['ai_provider'], 'nvidia')

        # Verify user was created in DB
        db_user = User.objects(email='test_google@example.com').first()
        self.assertIsNotNone(db_user)
        self.assertEqual(db_user.auth_provider, 'google')
        self.assertEqual(db_user.oauth_provider_id, 'google_123')

        # 2. Subsequent login with same user
        response2 = self.client.post('/api/v1/auth/google/', {'id_token': 'mock_google_token_123'}, format='json')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        # Ensure it doesn't create duplicate users
        self.assertEqual(User.objects(email='test_google@example.com').count(), 1)

    def test_google_oauth_validation_failure(self):
        # Missing token
        response = self.client.post('/api/v1/auth/google/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error']['code'], 'VALIDATION_ERROR')

        # Invalid real token verification failure
        response = self.client.post('/api/v1/auth/google/', {'id_token': 'invalid_token_signature'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error']['code'], 'INVALID_TOKEN')

    def test_github_oauth_mock_flow(self):
        # 1. First login / registration
        response = self.client.post('/api/v1/auth/github/', {'code': 'mock_github_code_123'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access_token', response.data)
        self.assertIn('refresh_token', response.data)
        self.assertEqual(response.data['user']['email'], 'test_github@example.com')

        # Verify user in DB
        db_user = User.objects(email='test_github@example.com').first()
        self.assertIsNotNone(db_user)
        self.assertEqual(db_user.auth_provider, 'github')
        self.assertEqual(db_user.oauth_provider_id, 'github_123')

        # 2. Subsequent login with same user
        response2 = self.client.post('/api/v1/auth/github/', {'code': 'mock_github_code_123'}, format='json')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(User.objects(email='test_github@example.com').count(), 1)

    def test_github_oauth_validation_failure(self):
        # Missing code
        response = self.client.post('/api/v1/auth/github/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error']['code'], 'VALIDATION_ERROR')

# Import cancellation tests to ensure they are discovered by Django test runner
from core.agent.tests import CancellationTestCase
