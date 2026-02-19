import React, { useState, useEffect } from "react";
import {
  RefreshCw,
  Pause,
  Play,
  Trash2,
  MessageSquare,
  Users,
  Clock,
} from "lucide-react";

interface Message {
  sender_id: string;
  recipient_id: string;
  message_id: string;
  message_text: string;
  attachments: any[];
  timestamp: number;
}

interface MessagesResponse {
  messages: Message[];
  count: number;
}

const MessengerDashboard: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [lastUpdated, setLastUpdated] = useState<string>("Never");
  const [apiUrl, setApiUrl] = useState("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const [aimsg, setAimsg] = useState("");
  const [aires, setAires] = useState("");

  // const APIURL =
  //   "https://gyrostatic-galvanoplastically-marjorie.ngrok-free.dev";
  const APIURL = "http://localhost:8000";

  const getApiUrl = () => {
    if (apiUrl.trim()) {
      return apiUrl.trim();
    }
    return `${APIURL}/api/recent-messages`;
  };

  const fetchMessages = async () => {
    try {
      const url = getApiUrl();
      const response = await fetch(url);

      console.log(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(data);
      setMessages(data.messages || []);
      setLastUpdated(new Date().toLocaleTimeString());
      setError("");
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch messages");
    } finally {
      setIsLoading(false);
    }
  };

  const getAiRes = async () => {
    try {
      const url = `${APIURL}/api/get_ai_res`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          msg: aimsg, // 👈 send whatever data you need
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(data);
      setAires(data.reply);
      setError("");
      setAimsg("");
    } catch (err) {
      console.error("Error fetching messages:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch messages");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    if (!isAutoRefresh) return;

    const intervalId = setInterval(() => {
      fetchMessages();
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [isAutoRefresh, refreshInterval, apiUrl]);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchMessages();
  };

  const handleClearMessages = () => {
    if (
      window.confirm(
        "Clear all messages from the display? (This will not delete them from the server)",
      )
    ) {
      setMessages([]);
    }
  };

  const toggleAutoRefresh = () => {
    setIsAutoRefresh(!isAutoRefresh);
  };

  const uniqueSenders = new Set(messages.map((m) => m.sender_id)).size;
  const sortedMessages = [...messages].sort(
    (a, b) => b.timestamp - a.timestamp,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-800">
              Facebook Messenger Dashboard
            </h1>
          </div>

          <div className="flex flex-col bg-white p-5 rounded-xl border border-gray-200 gap-4 shadow-sm">
            <div className="flex align-center gap-4">
              <input
                type="text"
                value={aimsg}
                onChange={(e) => setAimsg(e.target.value)}
                placeholder="Type your message..."
                className="w-full px-4 py-3 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-400 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-gray-400"
              />

              <button
                onClick={getAiRes}
                className="self-end px-6 py-2 rounded-lg bg-black text-white font-medium hover:bg-gray-800 transition"
              >
                Send
              </button>
            </div>

            <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-900 whitespace-pre-wrap">{aires}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-purple-50 rounded-lg p-4 flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Total Messages</p>
                <p className="text-2xl font-bold text-purple-600">
                  {messages.length}
                </p>
              </div>
            </div>

            <div className="bg-indigo-50 rounded-lg p-4 flex items-center gap-3">
              <Users className="w-6 h-6 text-indigo-600" />
              <div>
                <p className="text-sm text-gray-600">Unique Senders</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {uniqueSenders}
                </p>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-3">
              <Clock className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-lg font-semibold text-blue-600">
                  {lastUpdated}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh Now
            </button>

            <button
              onClick={toggleAutoRefresh}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {isAutoRefresh ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause Auto-Refresh
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Resume Auto-Refresh
                </>
              )}
            </button>

            <button
              onClick={handleClearMessages}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>

            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
            >
              <option value={2000}>Refresh: 2 seconds</option>
              <option value={5000}>Refresh: 5 seconds</option>
              <option value={10000}>Refresh: 10 seconds</option>
              <option value={30000}>Refresh: 30 seconds</option>
            </select>

            <input
              type="text"
              placeholder="API URL (optional)"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
            />

            {isAutoRefresh && (
              <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-700">
                  Auto-refreshing
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-yellow-50 border-2 border-yellow-400 text-yellow-800 rounded-lg p-4 mb-6">
            <strong>⚠️ Error:</strong> {error}
          </div>
        )}

        {/* Messages Container */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gray-50 border-b-2 border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-800">
              Recent Messages
            </h2>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {isLoading && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <RefreshCw className="w-12 h-12 text-purple-600 animate-spin mb-4" />
                <p className="text-gray-600">Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <MessageSquare className="w-20 h-20 mb-4 opacity-50" />
                <p className="text-lg font-medium">No messages received yet</p>
                <p className="text-sm mt-2">
                  Messages will appear here when users send them to your
                  Facebook Page
                </p>
              </div>
            ) : (
              <div>
                {sortedMessages.map((msg, index) => {
                  const date = new Date(msg.timestamp);
                  const senderInitial = msg.sender_id
                    .substring(0, 2)
                    .toUpperCase();
                  const hasAttachments =
                    msg.attachments && msg.attachments.length > 0;

                  return (
                    <div
                      key={`${msg.message_id}-${index}`}
                      className="border-b border-gray-100 p-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                            {senderInitial}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">
                              User ID: {msg.sender_id}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500">
                          {date.toLocaleString()}
                        </p>
                      </div>

                      {msg.message_text && (
                        <div className="bg-gray-50 border-l-4 border-purple-600 rounded-lg p-4 my-3">
                          <p className="text-gray-700 leading-relaxed">
                            {msg.message_text}
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          📧 Message ID: {msg.message_id || "N/A"}
                        </span>
                        {hasAttachments && (
                          <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                            📎 {msg.attachments.length} Attachment(s)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessengerDashboard;
