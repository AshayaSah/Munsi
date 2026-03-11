from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from starlette.responses import RedirectResponse

from models import Page, User, Message, Log
from config import get_settings

settings = get_settings()


class BasicAuthBackend(AuthenticationBackend):
    """
    Simple hardcoded admin password.
    In production replace with a proper check (DB lookup, bcrypt, etc.)
    """

    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = form.get("username")
        password = form.get("password")
        # Read credentials from env or hardcode for now
        if username == "admin" and password == settings.SECRET_KEY:
            request.session.update({"admin": True})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return request.session.get("admin", False)


# ── Admin views ─────────────────────────────────────────────────────────

class PageAdmin(ModelView, model=Page):
    name = "Page"
    name_plural = "Pages"
    icon = "fa-brands fa-facebook"
    column_list = [Page.id, Page.name, Page.is_active, Page.created_at]
    column_searchable_list = [Page.name]
    column_sortable_list = [Page.name, Page.created_at]
    column_details_exclude_list = [Page.access_token]   # hide token in list
    form_excluded_columns = ["users", "messages", "logs"]


class UserAdmin(ModelView, model=User):
    name = "User"
    name_plural = "Users"
    icon = "fa-solid fa-users"
    column_list = [User.user_id, User.page_id, User.last_seen, User.is_blocked]
    column_searchable_list = [User.user_id]
    column_sortable_list = [User.last_seen]
    form_excluded_columns = ["messages"]


class MessageAdmin(ModelView, model=Message):
    name = "Message"
    name_plural = "Messages"
    icon = "fa-solid fa-comment"
    column_list = [Message.id, Message.from_role, Message.content, Message.sent_at, Message.status]
    column_searchable_list = [Message.content]
    column_sortable_list = [Message.sent_at]


class LogAdmin(ModelView, model=Log):
    name = "Log"
    name_plural = "Logs"
    icon = "fa-solid fa-scroll"
    column_list = [Log.id, Log.page_id, Log.is_processed, Log.error, Log.received_at]
    column_sortable_list = [Log.received_at]


def setup_admin(app, engine):
    """Call this from main.py to attach the admin panel."""
    authentication_backend = BasicAuthBackend(secret_key=settings.SECRET_KEY)
    admin = Admin(app=app, engine=engine, authentication_backend=authentication_backend)

    admin.add_view(PageAdmin)
    admin.add_view(UserAdmin)
    admin.add_view(MessageAdmin)
    admin.add_view(LogAdmin)

    return admin
