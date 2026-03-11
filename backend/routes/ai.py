from fastapi import APIRouter
from pydantic import BaseModel

from services.ai_service import get_ai_reply

router = APIRouter(prefix="/api", tags=["ai"])


class AIRequest(BaseModel):
    msg: str
    instructions: str | None = None


@router.post("/get_ai_res")
async def get_ai_res(payload: AIRequest):
    if not payload.msg:
        return {"error": "Message is empty"}
    reply = await get_ai_reply(payload.msg, payload.instructions)
    return {"reply": reply}
