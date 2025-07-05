import { useEffect, useState, useCallback } from "react";
import io from "socket.io-client";
import axios from "axios";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useRef } from "react";

const socket = io("http://localhost:5000");

function Chat() {
  const [user, setUser] = useState(() => {
    const stored = sessionStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  const [message, setMessage] = useState("");
  const [receiver, setReceiver] = useState("");
  const [users, setUsers] = useState([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [chatMap, setChatMap] = useState({});
  const [userMap, setUserMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasSelectedChat, setHasSelectedChat] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch user, users, groups
  useEffect(() => {
    const initialize = async () => {
      try {
        const stored = sessionStorage.getItem("user");
        const parsedUser = stored ? JSON.parse(stored) : null;
        if (!parsedUser) return;

        setUser(parsedUser);

        const usersRes = await axios.get(
          "http://localhost:5000/api/auth/users"
        );
        const filtered = usersRes.data.filter((u) => u._id !== parsedUser.id);
        setUsers(filtered);

        const map = {};
        filtered.forEach((u) => {
          map[u._id] = u.username;
        });
        map[parsedUser.id] = "You";
        setUserMap(map);

        const groupsRes = await axios.get(
          `http://localhost:5000/api/group/all/${parsedUser.id}`
        );
        setGroups(groupsRes.data);

        setIsLoading(false);
      } catch (error) {
        console.error("Initialization error:", error);
        toast.error("Failed to load chat data");
      }
    };

    initialize();
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!user) return;

    socket.emit("join", user.id);

    const handleMessage = (data) => {
      const activeChatId = selectedGroup || receiver;

      const chatId =
        data.groupId ||
        (data.senderId === user.id ? data.receiverId : data.senderId);

      appendMessage(chatId, data);

      if (data.senderId !== user.id) {
        const sender = userMap[data.senderId] || "User";
        toast.info(`New message from ${sender}: ${data.message}`);
      }
    };

    const handleGroupMessage = (data) => {
      appendMessage(data.groupId, data);
      if (data.senderId !== user.id) {
        const group = groups.find((g) => g._id === data.groupId);
        toast.info(
          `New message in group ${group ? group.name : "Group"}: ${
            data.message
          }`
        );
      }
    };

    socket.on("getMessage", handleMessage);
    socket.on("getGroupMessage", handleGroupMessage);

    return () => {
      socket.off("getMessage", handleMessage);
      socket.off("getGroupMessage", handleGroupMessage);
    };
  }, [user, userMap, groups]);

  // Join socket room for group
  useEffect(() => {
    if (selectedGroup) {
      socket.emit("joinGroup", selectedGroup);
    }
  }, [selectedGroup]);

  // Send message (private or group)
  const sendMessage = async () => {
    if (!message.trim()) return;

    const isGroup = Boolean(selectedGroup);
    const chatId = isGroup ? selectedGroup : receiver;

    if (!chatId) {
      toast.warn("Please select a recipient first");
      return;
    }

    const newMessage = {
      senderId: user.id,
      receiverId: isGroup ? null : receiver,
      groupId: isGroup ? selectedGroup : null,
      message,
    };

    try {
      isGroup
        ? socket.emit("sendGroupMessage", newMessage)
        : socket.emit("sendMessage", newMessage);

      await axios.post("http://localhost:5000/api/message", {
        sender: user.id,
        receiver: isGroup ? null : receiver,
        groupId: isGroup ? selectedGroup : null,
        content: message,
      });

      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleEmojiSelect = (emoji) => {
    setMessage((prev) => prev + emoji.native);
  };

  const getUsername = useCallback(
    (id) => {
      if (!id) return "System";
      if (id === user?.id) return "You";
      return userMap[id] || "User";
    },
    [userMap, user?.id]
  );

  const getActiveChatId = () => selectedGroup || receiver;

  const currentChatMessages = chatMap[getActiveChatId()] || [];

  const appendMessage = useCallback((chatId, message) => {
    setChatMap((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), message],
    }));
  }, []);

  // Fetch messages on chat change
  useEffect(() => {
    const fetchMessages = async () => {
      const chatId = getActiveChatId();
      if (!chatId) {
        setHasSelectedChat(false);
        return;
      }

      setHasSelectedChat(true);

      try {
        const url = selectedGroup
          ? `http://localhost:5000/api/message/group/${chatId}`
          : `http://localhost:5000/api/message/private/${user.id}/${receiver}`;

        const res = await axios.get(url);

        const transformed = res.data.map((msg) => ({
          senderId: msg.sender,
          receiverId: msg.receiver,
          message: msg.content,
          createdAt: msg.createdAt,
          _id: msg._id,
        }));

        setChatMap((prev) => ({
          ...prev,
          [chatId]: transformed,
        }));
      } catch (error) {
        console.error("Failed to fetch chat history:", error);
        toast.error("Failed to load messages");
      }
    };

    fetchMessages();
  }, [receiver, selectedGroup, user]);

  const handleCreateGroup = async () => {
    if (!groupName || selectedMembers.length === 0) {
      toast.warn("Group name and members are required");
      return;
    }

    try {
      const res = await axios.post("http://localhost:5000/api/group/create", {
        name: groupName,
        members: [user.id, ...selectedMembers],
      });

      setGroups((prev) => [...prev, res.data]);
      setShowCreateModal(false);
      setGroupName("");
      setSelectedMembers([]);
      toast.success("Group created!");
    } catch (err) {
      console.error("Failed to create group:", err);
      toast.error("Group creation failed");
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentChatMessages]);

  const handleLogout = () => {
    socket.disconnect();
    sessionStorage.removeItem("user");
    window.location.href = "/";
  };

  if (!user || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-purple-50">
        <div className="p-6 text-center text-xl text-teal-600">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto mb-4"></div>
          Loading your chat experience...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-teal-50 to-purple-50 flex">
      {/* Sidebar */}
      <div className="w-full md:w-1/3 lg:w-1/4 bg-white shadow-lg flex flex-col p-4 gap-4 border-r border-teal-100">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-teal-700">
            <span className="text-purple-600">Chat</span>Book
          </h1>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
              {user.username.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white py-2 px-4 rounded-full flex-1 flex items-center justify-center gap-2 shadow-md"
            onClick={() => setShowCreateModal(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                clipRule="evenodd"
              />
            </svg>
            New Group
          </button>
          <button
            className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white py-2 px-4 rounded-full flex items-center justify-center gap-2 shadow-md"
            onClick={handleLogout}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            className="w-full p-2 pl-10 border border-teal-100 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-teal-400 absolute left-3 top-2.5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        {/* Users List */}
        <div className="mt-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-teal-600 mb-2 pl-2">
            Active Users
          </h2>
          <div className="bg-white rounded-lg border border-teal-100 overflow-hidden shadow-sm">
            <div className="max-h-60 overflow-y-auto">
              {users.map((u) => (
                <button
                  key={u._id}
                  onClick={() => {
                    setReceiver(u._id);
                    setSelectedGroup("");
                  }}
                  className={`flex items-center w-full px-4 py-3 text-sm transition-colors ${
                    receiver === u._id
                      ? "bg-teal-50 border-l-4 border-teal-500"
                      : "hover:bg-teal-50 border-l-4 border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-teal-200 to-purple-200 text-teal-700 font-bold mr-3">
                    {(u.username?.charAt(0) || "?").toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p
                      className={`font-medium ${
                        receiver === u._id ? "text-teal-800" : "text-gray-800"
                      }`}
                    >
                      {u.username}
                    </p>
                    <p
                      className={`text-xs ${
                        receiver === u._id ? "text-teal-600" : "text-gray-500"
                      }`}
                    ></p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Groups List */}
        <div className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-purple-600 mb-2 pl-2">
            Group Chats
          </h2>
          <div className="bg-white rounded-lg border border-purple-100 overflow-hidden shadow-sm">
            <div className="max-h-60 overflow-y-auto">
              {groups.map((g) => (
                <button
                  key={g._id}
                  onClick={() => {
                    setSelectedGroup(g._id);
                    setReceiver("");
                  }}
                  className={`flex items-center w-full px-4 py-3 text-sm transition-colors ${
                    selectedGroup === g._id
                      ? "bg-purple-50 border-l-4 border-purple-500"
                      : "hover:bg-purple-50 border-l-4 border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-purple-200 to-teal-200 text-purple-700 mr-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 12.094A5.973 5.973 0 004 15v1H1v-1a3 3 0 013.75-2.906z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p
                      className={`font-medium ${
                        selectedGroup === g._id
                          ? "text-purple-800"
                          : "text-gray-800"
                      }`}
                    >
                      {g.name}
                    </p>
                    <p
                      className={`text-xs ${
                        selectedGroup === g._id
                          ? "text-purple-600"
                          : "text-gray-500"
                      }`}
                    >
                      {g.members.length} members
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col p-4 space-y-4 relative">
        {/* Chat Header */}
        {hasSelectedChat && (
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-400 to-purple-500 flex items-center justify-center text-white font-bold mr-3">
              {selectedGroup
                ? groups
                    .find((g) => g._id === selectedGroup)
                    ?.name.charAt(0)
                    .toUpperCase()
                : users
                    .find((u) => u._id === receiver)
                    ?.username.charAt(0)
                    .toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-teal-800">
                {selectedGroup
                  ? groups.find((g) => g._id === selectedGroup)?.name
                  : users.find((u) => u._id === receiver)?.username}
              </h2>
              <p className="text-xs text-teal-600">
                {selectedGroup
                  ? `${
                      groups.find((g) => g._id === selectedGroup)?.members
                        .length
                    } members`
                  : "Online"}
              </p>
            </div>
          </div>
        )}

        {/* Chat Box */}
        <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-inner p-4">
          {!hasSelectedChat ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-gradient-to-r from-teal-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 text-teal-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-teal-700 mb-2">
                Welcome to ChatBook
              </h3>
              <p className="text-teal-600 max-w-md">
                {users.length > 0
                  ? "Select a user or group from the sidebar to start chatting"
                  : "No other users available at the moment"}
              </p>
            </div>
          ) : currentChatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-teal-100 to-purple-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-10 w-10 text-purple-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-teal-700 mb-1">
                No messages yet
              </h3>
              <p className="text-teal-600">
                Send your first message to start the conversation!
              </p>
            </div>
          ) : (
            currentChatMessages
              .filter((msg) =>
                (msg.message || "")
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase())
              )
              .map((msg, i) => {
                const senderId = msg.senderId;
                const isYou = senderId === user.id;
                return (
                  <div
                    key={msg._id || i}
                    className={`mb-4 flex ${
                      isYou ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`px-4 py-3 rounded-2xl max-w-xs lg:max-w-md ${
                        isYou
                          ? "bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-br-none"
                          : "bg-gray-100 text-gray-800 rounded-bl-none"
                      }`}
                    >
                      {!isYou && (
                        <div className="text-xs font-semibold text-teal-700 mb-1">
                          {getUsername(senderId)}
                        </div>
                      )}
                      <div className="text-sm">{msg.message}</div>
                      <div
                        className={`text-xs mt-1 text-right ${
                          isYou ? "text-teal-100" : "text-gray-500"
                        }`}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
          <div ref={messagesEndRef}></div>
        </div>

        {/* Emoji Picker */}
        {showEmoji && (
          <div className="absolute bottom-32 left-10 z-50 bg-white border border-teal-200 rounded-xl shadow-xl overflow-hidden">
            <div className="flex justify-between items-center bg-teal-50 p-2 border-b border-teal-100">
              <span className="text-sm font-medium text-teal-700">Emoji</span>
              <button
                className="text-teal-500 hover:text-teal-700 font-bold text-lg px-2"
                onClick={() => setShowEmoji(false)}
              >
                ×
              </button>
            </div>
            <Picker
              data={data}
              onEmojiSelect={handleEmojiSelect}
              theme="light"
              previewPosition="none"
            />
          </div>
        )}

        {/* Message Input */}
        <div className="flex items-center gap-2 w-full bg-white p-3 rounded-xl shadow-sm">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="text-2xl text-teal-500 hover:text-teal-600 transition-colors"
          >
            😊
          </button>
          <input
            className="flex-grow p-3 border border-teal-100 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={!message.trim()}
            className={`p-3 rounded-full text-white ${
              message.trim()
                ? "bg-gradient-to-r from-teal-500 to-purple-500 hover:from-teal-600 hover:to-purple-600 shadow-md"
                : "bg-gray-300 cursor-not-allowed"
            } transition-all`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        <ToastContainer
          position="bottom-right"
          autoClose={3000}
          toastClassName="bg-white text-teal-800 shadow-lg rounded-xl border border-teal-100"
          progressClassName="bg-gradient-to-r from-teal-400 to-purple-400"
        />
      </div>

      {/* Group Creation Modal */}
      {showCreateModal && (
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-96 max-w-full mx-4">
            <h2 className="text-xl font-bold text-teal-700 mb-4">
              Create New Group
            </h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-teal-700 mb-1">
                Group Name
              </label>
              <input
                type="text"
                placeholder="e.g. Family Chat"
                className="w-full p-3 border border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-teal-700 mb-1">
                Add Members
              </label>
              <div className="max-h-40 overflow-y-auto border border-teal-200 rounded-lg p-2">
                {users.map((u) => (
                  <label
                    key={u._id}
                    className="flex items-center text-sm gap-3 mb-2 p-2 hover:bg-teal-50 rounded-lg cursor-pointer"
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-200 to-purple-200 flex items-center justify-center text-teal-700 font-bold mr-2">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                      <span>{u.username}</span>
                    </div>
                    <input
                      type="checkbox"
                      value={u._id}
                      checked={selectedMembers.includes(u._id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedMembers((prev) =>
                          checked
                            ? [...prev, u._id]
                            : prev.filter((id) => id !== u._id)
                        );
                      }}
                      className="ml-auto h-5 w-5 text-teal-600 rounded focus:ring-teal-500 border-teal-300"
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 text-sm font-medium text-teal-700 hover:text-teal-900 transition-colors"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white text-sm font-medium rounded-lg shadow-md transition-all"
                onClick={handleCreateGroup}
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;
