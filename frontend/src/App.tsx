import React, { useState, useEffect } from "react";
import {
  MessageCircle,
  LogOut,
  RefreshCw,
  Send,
  User,
  Check,
} from "lucide-react";

const API_BASE_URL = "http://localhost:8000";

export default function MessengerApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [userName, setUserName] = useState("");
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [participant, setParticipant] = useState("");
  const [participants, setParticipants] = useState([]);
  const [message, setMessage] = useState("");

  const [messageCount, setMessageCount] = useState(0);

  // Check if user was redirected back from OAuth
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("user_id");
    const loggedIn = urlParams.get("logged_in");
    const access_token = urlParams.get("access_token");

    if (userId && loggedIn) {
      // In production, retrieve token from secure session
      // For demo, you'd need to implement session management
      setIsLoggedIn(true);
      setUserName(userId);
      setAccessToken(access_token);
      // Clean up URL
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  // Initiate Facebook OAuth flow
  const handleLogin = () => {
    // Redirect to FastAPI OAuth endpoint
    window.location.href = `${API_BASE_URL}/auth/facebook/login`;
  };

  // Manual token setup (for testing)
  const handleManualToken = () => {
    const token = prompt("Enter your Facebook access token (for testing):");
    if (token) {
      setAccessToken(token);
      setIsLoggedIn(true);
      setError("");
    }
  };

  // Logout
  const handleLogout = () => {
    setIsLoggedIn(false);
    setAccessToken("");
    setUserName("");
    setPages([]);
    setConversations([]);
    setMessages([]);
    setSelectedPage(null);
    setSelectedConversation(null);
  };

  // Fetch user's Facebook Pages
  const fetchPages = async () => {
    if (!accessToken) {
      setError("Please provide an access token first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/user/pages?access_token=${accessToken}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch pages");
      }

      const data = await response.json();
      setPages(data.pages || []);

      if (data.pages && data.pages.length > 0) {
        setSelectedPage(data.pages[0]);
      } else {
        setError(
          "No Facebook Pages found. You need to create a Facebook Page to access Messenger.",
        );
      }
    } catch (err) {
      setError(`Error fetching pages: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch conversations for selected page
  const fetchConversations = async () => {
    if (!selectedPage) {
      setError("Please select a page first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/conversations?access_token=${selectedPage.access_token}&page_id=${selectedPage.id}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }

      const data = await response.json();
      setConversations(data.data || []);
    } catch (err) {
      setError(`Error fetching conversations: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for selected conversation
  const fetchMessages = async (conversationId, participants) => {
    setLoading(true);
    setError("");

    try {
      const participant = participants.find(
        (p) => p.name !== "Ethan Apparels",
      )?.id;

      setParticipants(participants);
      setParticipant(participant);

      const response = await fetch(
        `${API_BASE_URL}/api/messages?access_token=${accessToken}&page_id=${selectedPage.id}&conversation_id=${conversationId}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }

      const data = await response.json();
      setMessages(data.messages?.data || []);
      setSelectedConversation(conversationId);
    } catch (err) {
      setError(`Error fetching messages: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages(selectedConversation, participants);
  }, [messageCount]);

  const sendMessages = async () => {
    setLoading(true);
    setError("");

    try {
      console.log(message);
      const response = await fetch(
        `${API_BASE_URL}/api/send-message?access_token=${accessToken}&page_id=${selectedPage.id}&recipient_id=${participant}&message_text=${message}`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }

      const data = await response.json();

      console.log(data);
      setMessageCount(messageCount + 1);

      setMessage("");
    } catch (err) {
      setError(`Error sending message: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[100vw] min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-xl">
                <MessageCircle className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Messenger Dashboard
                </h1>
                <p className="text-sm text-gray-500">
                  Manage your Facebook conversations
                </p>
              </div>
            </div>
            {isLoggedIn && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut size={18} />
                <span className="font-medium">Logout</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!isLoggedIn ? (
          /* Login Screen */
          <div className="max-w-md mx-auto mt-20">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <div className="text-center mb-8">
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="text-white" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome Back
                </h2>
                <p className="text-gray-500">
                  Connect your Facebook account to get started
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleLogin}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-semibold shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                  <span>Login with Facebook</span>
                </button>
                <button
                  onClick={handleManualToken}
                  className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-200 transition-all font-semibold flex items-center justify-center gap-2"
                >
                  <span>Use Access Token</span>
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100">
                <div className="bg-blue-50 rounded-xl p-4">
                  <h3 className="font-semibold text-blue-900 mb-2 text-sm">
                    Setup Required:
                  </h3>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• Install: pip install fastapi uvicorn httpx</li>
                    <li>• Set FB_APP_ID and FB_APP_SECRET env vars</li>
                    <li>• Run: python backend.py</li>
                    <li>• Configure redirect URI in Facebook App</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Main Dashboard */
          <div className="grid grid-cols-12 gap-6">
            {/* Sidebar - Pages & Conversations */}
            <div className="col-span-4 space-y-6">
              {/* User Info Card */}
              <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-gradient-to-br from-blue-600 to-purple-600 w-12 h-12 rounded-full flex items-center justify-center">
                    <User className="text-white" size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {userName || "User"}
                    </p>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      {accessToken ? (
                        <>
                          <Check size={14} className="text-green-500" />
                          <span>Connected</span>
                        </>
                      ) : (
                        <span>Not connected</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={fetchPages}
                  disabled={loading || !accessToken}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2.5 px-4 rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all font-medium shadow-lg shadow-green-200 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  <RefreshCw
                    size={16}
                    className={loading ? "animate-spin" : ""}
                  />
                  {loading ? "Loading..." : "Load Pages"}
                </button>
              </div>

              {/* Pages List */}
              {pages.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    Your Pages
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {pages.map((page) => (
                      <div
                        key={page.id}
                        onClick={() => setSelectedPage(page)}
                        className={`p-4 rounded-xl cursor-pointer transition-all ${
                          selectedPage?.id === page.id
                            ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                            : "bg-gray-50 hover:bg-gray-100 text-gray-900"
                        }`}
                      >
                        <p className="font-semibold text-sm">{page.name}</p>
                        <p
                          className={`text-xs mt-1 ${selectedPage?.id === page.id ? "text-blue-100" : "text-gray-500"}`}
                        >
                          ID: {page.id}
                        </p>
                      </div>
                    ))}
                  </div>
                  {selectedPage && (
                    <button
                      onClick={fetchConversations}
                      disabled={loading}
                      className="w-full mt-4 bg-purple-600 text-white py-2.5 px-4 rounded-xl hover:bg-purple-700 disabled:bg-gray-400 transition-all font-medium flex items-center justify-center gap-2"
                    >
                      <MessageCircle size={16} />
                      {loading ? "Loading..." : "Load Conversations"}
                    </button>
                  )}
                </div>
              )}

              {/* Conversations List */}
              {conversations.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                    Conversations
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        onClick={() =>
                          fetchMessages(conv.id, conv.participants.data)
                        }
                        className={`p-4 rounded-xl cursor-pointer transition-all ${
                          selectedConversation === conv.id
                            ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                            : "bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        <p
                          className={`font-medium text-sm mb-2 line-clamp-2 ${
                            selectedConversation === conv.id
                              ? "text-white"
                              : "text-gray-900"
                          }`}
                        >
                          {conv.snippet || "No preview available"}
                        </p>
                        <div
                          className={`flex items-center gap-2 text-xs ${
                            selectedConversation === conv.id
                              ? "text-purple-100"
                              : "text-gray-500"
                          }`}
                        >
                          <span>{conv.message_count || 0} messages</span>
                          <span>•</span>
                          <span>
                            {new Date(conv.updated_time).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Main Content - Messages */}
            <div className="col-span-8">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-4 mb-6">
                  <p className="text-red-800 font-medium">Error</p>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
              )}

              {messages.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 h-[calc(100vh-12rem)] flex flex-col">
                  <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">
                      Messages
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {messages.length} messages in conversation
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.map((msg) => {
                      const isFromPage = msg.from?.id === selectedPage?.id;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isFromPage ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-md ${isFromPage ? "order-2" : "order-1"}`}
                          >
                            <div
                              className={`rounded-2xl px-4 py-3 ${
                                isFromPage
                                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                                  : "bg-gray-100 text-gray-900"
                              }`}
                            >
                              <p className="text-sm">
                                {msg.message || "(No text content)"}
                              </p>
                            </div>
                            <div
                              className={`mt-1 text-xs text-gray-500 ${isFromPage ? "text-right" : "text-left"}`}
                            >
                              <span className="font-medium">
                                {msg.from?.name || "Unknown"}
                              </span>
                              <span className="mx-1">•</span>
                              <span>
                                {new Date(msg.created_time).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-4 border-t border-gray-100">
                    <div className="flex gap-2">
                      <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        type="text"
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center gap-2"
                        onClick={sendMessages}
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 h-[calc(100vh-12rem)] flex items-center justify-center">
                  <div className="text-center">
                    <MessageCircle
                      className="mx-auto text-gray-300 mb-4"
                      size={64}
                    />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      No conversation selected
                    </h3>
                    <p className="text-gray-500">
                      Select a conversation from the sidebar to view messages
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
