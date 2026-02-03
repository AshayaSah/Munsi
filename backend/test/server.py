# backend.py - FastAPI Backend for Facebook OAuth and Messenger API

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel
import httpx
import os
from typing import Optional, List, Dict
from dotenv import load_dotenv  # Add this importz

app = FastAPI()

# Load environment variables BEFORE using them
load_dotenv()


# CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://localhost:5173"],  # Adjust for your frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FB_APP_ID = os.getenv("FB_APP_ID")
FB_APP_SECRET = os.getenv("FB_APP_SECRET")
FB_REDIRECT_URI = os.getenv("FB_REDIRECT_URI", "http://localhost:8000/auth/facebook/callback")

# Store tokens in memory (use database in production)
user_tokens = {}


class TokenRequest(BaseModel):
    code: str


class MessengerRequest(BaseModel):
    access_token: str
    page_id: Optional[str] = None


@app.get("/")
def read_root():
    """Root endpoint"""
    return {"message": "Facebook Messenger OAuth API"}


@app.get("/auth/facebook/login")
def facebook_login():
    """
    Step 1: Redirect user to Facebook OAuth dialog
    This initiates the OAuth flow
    """
    # Define the permissions we need for Messenger access
    # scope = "instagram_basic,public_profile,email,pages_messaging,pages_manage_metadata,pages_read_engagement,pages_show_list"
    scope = "instagram_basic,instagram_manage_messages,pages_read_engagement,pages_show_list,business_management,pages_messaging,pages_manage_metadata"
    # Construct Facebook OAuth URL
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
    
    # Exchange code for access token
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
        
        # Get user info
        user_info_url = f"https://graph.facebook.com/v18.0/me?access_token={access_token}&fields=id,name,email"
        user_response = await client.get(user_info_url)
        user_data = user_response.json()
        
        # Store token (use session/database in production)
        user_id = user_data.get("id")
        user_tokens[user_id] = {
            "access_token": access_token,
            "user_data": user_data
        }

        print("User ID:", access_token)
        
        # Redirect to frontend with user_id
        # In production, use proper session management
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
    # First get the page access token
    pages_url = f"https://graph.facebook.com/v18.0/me/accounts?access_token={access_token}"
    
    async with httpx.AsyncClient() as client:
        pages_response = await client.get(pages_url)
        pages_data = pages_response.json()
        
        # Find the requested page and get its access token
        page_access_token = access_token
        # for page in pages_data.get("data", []):
        #     if page["id"] == page_id:
        #         page_access_token = page["access_token"]
        #         break
        
        if not page_access_token:
            raise HTTPException(status_code=404, detail="Page not found or no access")
        
        # Fetch conversations using page access token
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
    # Get page access token
    pages_url = f"https://graph.facebook.com/v18.0/me/accounts?access_token={access_token}"
    
    async with httpx.AsyncClient() as client:
        pages_response = await client.get(pages_url)
        pages_data = pages_response.json()
        
        # Find page access token
        page_access_token = None
        for page in pages_data.get("data", []):
            if page["id"] == page_id:
                page_access_token = page["access_token"]
                break
        
        if not page_access_token:
            raise HTTPException(status_code=404, detail="Page not found")
        
        # Fetch messages
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
    Send a message via Messenger with full error handling
    """
    try:
        async with httpx.AsyncClient() as client:
            # Step 1: Get page access token
            print(f"Step 1: Fetching pages for page_id: {page_id}")
            
            pages_url = f"https://graph.facebook.com/v18.0/me/accounts"
            pages_params = {"access_token": access_token}
            
            try:
                pages_response = await client.get(pages_url, params=pages_params)
                pages_data = pages_response.json()
                
                print(f"Pages Response Status: {pages_response.status_code}")
                print(f"Pages Data: {pages_data}")
                
            except Exception as e:
                print(f"Error fetching pages: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to fetch pages: {str(e)}"
                )
            
            if "error" in pages_data:
                raise HTTPException(
                    status_code=400,
                    detail=f"Facebook API Error: {pages_data['error']}"
                )
            
            # Find the page access token
            page_access_token = None
            available_pages = []
            
            for page in pages_data.get("data", []):
                available_pages.append(page["id"])
                if page["id"] == page_id:
                    page_access_token = page["access_token"]
                    break
            
            print(f"Available pages: {available_pages}")
            print(f"Looking for page_id: {page_id}")
            print(f"Found token: {page_access_token is not None}")
            
            if not page_access_token:
                raise HTTPException(
                    status_code=404,
                    detail=f"Page {page_id} not found. Available pages: {available_pages}"
                )
            
            # Step 2: Send the message
            print(f"Step 2: Sending message to recipient: {recipient_id}")
            
            send_url = f"https://graph.facebook.com/v18.0/me/messages"
            
            payload = {
                "recipient": {"id": recipient_id},
                "message": {"text": message_text},
                "messaging_type": "RESPONSE"
            }
            
            send_params = {"access_token": page_access_token}
            
            print(f"Send URL: {send_url}")
            print(f"Payload: {payload}")
            
            try:
                send_response = await client.post(
                    send_url,
                    json=payload,
                    params=send_params,
                    timeout=30.0  # Add timeout
                )
                
                result = send_response.json()
                
                print(f"Send Response Status: {send_response.status_code}")
                print(f"Send Response Body: {result}")
                
            except httpx.TimeoutException:
                raise HTTPException(
                    status_code=504,
                    detail="Request to Facebook API timed out"
                )
            except Exception as e:
                print(f"Error sending message: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to send message: {str(e)}"
                )
            
            if "error" in result:
                error_detail = result.get('error', {})
                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": error_detail.get('message', 'Unknown error'),
                        "type": error_detail.get('type', 'Unknown'),
                        "code": error_detail.get('code', 'N/A'),
                        "error_subcode": error_detail.get('error_subcode', 'N/A'),
                        "fbtrace_id": error_detail.get('fbtrace_id', 'N/A')
                    }
                )
            
            return result
            
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Catch any other unexpected errors
        print(f"Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
    

    

# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    # Run with: python backend.py
    uvicorn.run(app, host="0.0.0.0", port=8000)