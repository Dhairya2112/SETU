from allauth.account.adapter import DefaultAccountAdapter

class NoNewUsersAccountAdapter(DefaultAccountAdapter):
    """
    Adapter that prevents standard local (password) signups.
    Only allows OAuth signups via SocialAccountAdapter.
    """
    def is_open_for_signup(self, request):
        return False
