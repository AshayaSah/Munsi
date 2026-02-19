import time
from typing import Optional

class TokenManager:
    _access_token: Optional[str] = None

    @classmethod
    def set_token(cls, token: str) -> None:
        """
        Store token and its expiration time.

        :param token: Access token string
        :param expires_in: Expiration time in seconds
        """
        cls._access_token = token

    @classmethod
    def get_token(cls) -> Optional[str]:
        """
        Return token if valid.
        Returns None if expired or not set.
        """
        if cls._access_token:
            return cls._access_token

        return None
