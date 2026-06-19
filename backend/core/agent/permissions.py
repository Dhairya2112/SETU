"""
Step 12.4 — Permission Enforcement Layer

Before any tool executes, its required permission level is checked
against the user's stored permissions in MongoDB.

Levels:
  Level 1 — Safe, informational tools.  Always allowed.
  Level 2 — OS-interaction tools.       Requires explicit opt-in.
  Level 3 — Admin / destructive tools.  Always denied (future UAC prompt).
"""

from core.users.models import User

PERMISSION_DENIED_MSG = (
    "I don't have permission to do that. "
    "You can enable this in Settings > Permissions."
)


def check_permission(user_id: str, required_level: int) -> bool:
    """
    Return True if the user has granted the required permission level.

    Parameters
    ----------
    user_id : str
        The UUID of the requesting user.
    required_level : int
        1, 2, or 3 — the minimum level the tool requires.
    """
    if required_level <= 1:
        return True  # Level 1 tools are always allowed

    user = User.objects(user_id=user_id).first()
    if user is None:
        return False  # Unknown user — deny by default

    if required_level == 2:
        return bool(user.permissions and user.permissions.level_2_granted)

    if required_level >= 3:
        return False  # Level 3 always requires manual UAC prompt (not yet implemented)

    return False
