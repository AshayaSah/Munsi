# backend.py - FastAPI Backend for Facebook OAuth and Messenger API with Webhook

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse, PlainTextResponse
from pydantic import BaseModel
import httpx
import os
from typing import Optional, List, Dict
from dotenv import load_dotenv

app = FastAPI()

# Load environment variables BEFORE using them
load_dotenv()

# CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FB_APP_ID = os.getenv("FB_APP_ID")
FB_APP_SECRET = os.getenv("FB_APP_SECRET")
FB_REDIRECT_URI = os.getenv("FB_REDIRECT_URI", "http://localhost:8000/auth/facebook/callback")
VERIFY_TOKEN = os.getenv("WEBHOOK_VERIFY_TOKEN", "your_secure_verify_token_here")

# Store tokens in memory (use database in production)
user_tokens = {}

# Store recent messages in memory (use database/queue in production)
recent_messages = []


class TokenRequest(BaseModel):
    code: str


class MessengerRequest(BaseModel):
    access_token: str
    page_id: Optional[str] = None


@app.get("/")
def read_root():
    """Root endpoint"""
    return {"message": "Facebook Messenger OAuth API"}


# ==================== WEBHOOK ENDPOINTS ====================

@app.get("/webhook")
async def verify_webhook(
    hub_mode: Optional[str] = None,
    hub_verify_token: Optional[str] = None,
    hub_challenge: Optional[str] = None
):
    """
    Webhook verification endpoint for Facebook
    Facebook will call this to verify your webhook
    """
    print(f"Webhook verification attempt - Mode: {hub_mode}, Token: {hub_verify_token}")
    
    if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:
        print("✅ Webhook verified successfully!")
        return PlainTextResponse(content=hub_challenge)
    else:
        print("❌ Webhook verification failed!")
        raise HTTPException(status_code=403, detail="Verification failed")


@app.post("/webhook")
async def receive_webhook(request: Request):
    """
    Receive incoming messages from Facebook Messenger
    This is called whenever someone sends a message to your page
    """
    try:
        body = await request.json()
        print("\n" + "="*50)
        print("📨 Webhook received:", body)
        print("="*50 + "\n")
        
        # Check if this is a page subscription
        if body.get("object") == "page":
            # Iterate over each entry
            for entry in body.get("entry", []):
                # Get the messaging events
                messaging_events = entry.get("messaging", [])
                
                for event in messaging_events:
                    sender_id = event.get("sender", {}).get("id")
                    recipient_id = event.get("recipient", {}).get("id")
                    timestamp = event.get("timestamp")
                    
                    # Check if this is a message event
                    if event.get("message"):
                        message = event["message"]
                        message_id = message.get("mid")
                        message_text = message.get("text")
                        attachments = message.get("attachments")
                        
                        print(f"\n🆕 New Message Received:")
                        print(f"   Sender ID: {sender_id}")
                        print(f"   Page ID: {recipient_id}")
                        print(f"   Message ID: {message_id}")
                        print(f"   Text: {message_text}")
                        print(f"   Timestamp: {timestamp}")
                        
                        if attachments:
                            print(f"   Attachments: {attachments}")
                        
                        # Store the message (in production, save to database)
                        message_data = {
                            "sender_id": sender_id,
                            "recipient_id": recipient_id,
                            "message_id": message_id,
                            "message_text": message_text,
                            "attachments": attachments,
                            "timestamp": timestamp
                        }
                        recent_messages.append(message_data)
                        
                        # Keep only last 100 messages in memory
                        if len(recent_messages) > 100:
                            recent_messages.pop(0)
                        
                        # Process the message
                        await process_incoming_message(message_data)
                    
                    # Check for postback events (button clicks)
                    elif event.get("postback"):
                        postback = event["postback"]
                        payload = postback.get("payload")
                        print(f"\n📲 Postback Received:")
                        print(f"   Sender ID: {sender_id}")
                        print(f"   Payload: {payload}")
                    
                    # Check for message delivery
                    elif event.get("delivery"):
                        delivery = event["delivery"]
                        print(f"\n✅ Message Delivered:")
                        print(f"   Message IDs: {delivery.get('mids')}")
                    
                    # Check for message read
                    elif event.get("read"):
                        read = event["read"]
                        print(f"\n👁️ Message Read:")
                        print(f"   Watermark: {read.get('watermark')}")
        
        # Always return 200 OK to acknowledge receipt
        return {"status": "ok"}
    
    except Exception as e:
        print(f"❌ Error processing webhook: {str(e)}")
        import traceback
        traceback.print_exc()
        # Still return 200 to avoid Facebook retrying
        return {"status": "error", "message": str(e)}


async def process_incoming_message(message_data: dict):
    """
    Process the received message
    You can implement your custom logic here
    """
    sender_id = message_data["sender_id"]
    message_text = message_data["message_text"]
    
    print(f"🔄 Processing message from {sender_id}: {message_text}")
    
    # TODO: Add your custom logic here:
    # - Save to database
    # - Trigger notifications
    # - Auto-reply with specific keywords
    # - Forward to customer service
    # - etc.
    
    # Example: Simple auto-reply for specific keywords
    # if message_text and "hello" in message_text.lower():
    #     await send_auto_reply(message_data["recipient_id"], sender_id, "Hello! How can I help you?")


async def send_auto_reply(page_id: str, recipient_id: str, message_text: str, page_access_token: str):
    """
    Send an auto-reply to a user
    """
    send_url = f"https://graph.facebook.com/v18.0/me/messages?access_token={page_access_token}"
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": message_text}
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(send_url, json=payload)
        if response.status_code == 200:
            print(f"✅ Auto-reply sent to {recipient_id}")
        else:
            print(f"❌ Failed to send auto-reply: {response.text}")
        return response.json()


@app.get("/api/recent-messages")
async def get_recent_messages(page_id: Optional[str] = None):
    """
    Get recent messages received via webhook
    Frontend can poll this endpoint to check for new messages
    """
    if page_id:
        # Filter by page_id if provided
        filtered = [msg for msg in recent_messages if msg["recipient_id"] == page_id]
        return {"messages": filtered, "count": len(filtered)}
    
    return {"messages": recent_messages, "count": len(recent_messages)}


@app.post("/api/subscribe-page-webhook")
async def subscribe_page_to_webhook(page_id: str, page_access_token: str):
    """
    Subscribe a Facebook Page to your webhook
    Call this after setting up the webhook in Facebook App settings
    """
    subscribe_url = f"https://graph.facebook.com/v18.0/{page_id}/subscribed_apps"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            subscribe_url,
            params={
                "subscribed_fields": "messages,messaging_postbacks,message_deliveries,message_reads",
                "access_token": page_access_token
            }
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to subscribe page: {response.text}"
            )
        
        print(f"✅ Page {page_id} subscribed to webhook")
        return response.json()


# ==================== EXISTING OAUTH ENDPOINTS ====================

@app.get("/auth/facebook/login")
def facebook_login():
    """
    Step 1: Redirect user to Facebook OAuth dialog
    This initiates the OAuth flow
    """
    scope = "instagram_basic,instagram_manage_messages,pages_read_engagement,pages_show_list,business_management,pages_messaging"
    
    fb_auth_url = (
        f"https://www.facebook.com/v18.0/dialog/oauth?"
        f"client_id={FB_APP_ID}"
        f"&redirect_uri={FB_REDIRECT_URI}"
        f"&scope={scope}"
        f"&response_type=code"
    )
    
    return RedirectResponse(url=fb_auth_url)


@app.get("/auth/facebook/callback")
async def facebook_callback(code: str):
    """
    Step 2: Handle OAuth callback from Facebook
    Exchange authorization code for access token
    """
    if not code:
        raise HTTPException(status_code=400, detail="No authorization code provided")
    
    token_url = "https://graph.facebook.com/v18.0/oauth/access_token"
    params = {
        "client_id": FB_APP_ID,
        "client_secret": FB_APP_SECRET,
        "redirect_uri": FB_REDIRECT_URI,
        "code": code
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(token_url, params=params)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=400, 
                detail=f"Failed to get access token: {response.text}"
            )
        
        token_data = response.json()
        access_token = token_data.get("access_token")
        
        user_info_url = f"https://graph.facebook.com/v18.0/me?access_token={access_token}&fields=id,name,email"
        user_response = await client.get(user_info_url)
        user_data = user_response.json()
        
        user_id = user_data.get("id")
        user_tokens[user_id] = {
            "access_token": access_token,
            "user_data": user_data
        }

        print("User ID:", access_token)
        
        frontend_url = f"http://localhost:5173?user_id={user_id}&access_token={access_token}&logged_in=true"
        return RedirectResponse(url=frontend_url)


@app.post("/api/exchange-token")
async def exchange_token(token_request: TokenRequest):
    """
    Alternative: Exchange authorization code for access token (if using frontend flow)
    """
    token_url = "https://graph.facebook.com/v18.0/oauth/access_token"
    params = {
        "client_id": FB_APP_ID,
        "client_secret": FB_APP_SECRET,
        "redirect_uri": FB_REDIRECT_URI,
        "code": token_request.code
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(token_url, params=params)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to exchange token: {response.text}"
            )
        
        return response.json()


@app.get("/api/user/pages")
async def get_user_pages(access_token: str):
    """
    Step 3: Get user's Facebook Pages
    Required to access Messenger conversations
    """
    pages_url = f"https://graph.facebook.com/v18.0/me/accounts?access_token={access_token}"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(pages_url)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch pages: {response.text}"
            )
        
        data = response.json()
        print("Page Data: ", data)
        
        if not data.get("data"):
            return {
                "pages": [],
                "message": "No Facebook Pages found. Create a Facebook Page to access Messenger."
            }
        
        return {"pages": data.get("data", [])}


@app.get("/api/conversations")
async def get_conversations(access_token: str, page_id: str):
    """
    Step 4: Get conversations for a specific Facebook Page
    Uses page access token to fetch Messenger conversations
    """
    pages_url = f"https://graph.facebook.com/v18.0/me/accounts?access_token={access_token}"
    
    async with httpx.AsyncClient() as client:
        pages_response = await client.get(pages_url)
        pages_data = pages_response.json()
        
        page_access_token = access_token
        
        if not page_access_token:
            raise HTTPException(status_code=404, detail="Page not found or no access")
        
        conversations_url = (
            f"https://graph.facebook.com/v18.0/{page_id}/conversations?"
            f"fields=participants,updated_time,message_count,snippet"
            f"&access_token={page_access_token}"
        )
        
        conv_response = await client.get(conversations_url)
        print("Convo Res: ", conv_response.json())
        
        if conv_response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch conversations: {conv_response.text}"
            )
        
        return conv_response.json()


@app.get("/api/messages")
async def get_messages(access_token: str, page_id: str, conversation_id: str):
    """
    Step 5: Get messages for a specific conversation
    """
    pages_url = f"https://graph.facebook.com/v18.0/me/accounts?access_token={access_token}"
    
    async with httpx.AsyncClient() as client:
        pages_response = await client.get(pages_url)
        pages_data = pages_response.json()

        page_access_token = access_token
        for page in pages_data.get("data", []):
            if page["id"] == page_id:
                page_access_token = page["access_token"]
                break
        
        if not page_access_token:
            raise HTTPException(status_code=404, detail="Page not found")
        
        messages_url = (
            f"https://graph.facebook.com/v18.0/{conversation_id}?"
            f"fields=messages{{message,from,created_time,id}}"
            f"&access_token={page_access_token}"
        )
        
        messages_response = await client.get(messages_url)
        
        if messages_response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to fetch messages: {messages_response.text}"
            )
        
        return messages_response.json()


@app.post("/api/send-message")
async def send_message(
    access_token: str,
    page_id: str,
    recipient_id: str,
    message_text: str
):
    """
    Bonus: Send a message via Messenger
    """
    pages_url = f"https://graph.facebook.com/v18.0/me/accounts?access_token={access_token}"
    
    async with httpx.AsyncClient() as client:
        pages_response = await client.get(pages_url)
        pages_data = pages_response.json()
        
        page_access_token = None
        for page in pages_data.get("data", []):
            if page["id"] == page_id:
                page_access_token = page["access_token"]
                break
        
        if not page_access_token:
            raise HTTPException(status_code=404, detail="Page not found")
        
        send_url = f"https://graph.facebook.com/v18.0/me/messages?access_token={page_access_token}"
        payload = {
            "recipient": {"id": recipient_id},
            "message": {"text": message_text}
        }

        print("Payload", payload)
        
        send_response = await client.post(send_url, json=payload)
        
        if send_response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to send message: {send_response.text}"
            )
        
        return send_response.json()


@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)