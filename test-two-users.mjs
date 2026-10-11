
import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3000";

const TOKEN_1 = process.env.CHAT_TOKEN_1;
const TOKEN_2 = process.env.CHAT_TOKEN_2;
const ROOM_ID = process.env.CHAT_ROOM_ID;

if (!TOKEN_1 || !TOKEN_2 || !ROOM_ID) {
  console.error(
    "Missing CHAT_TOKEN_1, CHAT_TOKEN_2 or CHAT_ROOM_ID"
  );
  process.exit(1);
}

const user1 = io(SERVER_URL, {
  auth: { token: TOKEN_1 },
  autoConnect: false,
});

const user2 = io(SERVER_URL, {
  auth: { token: TOKEN_2 },
  autoConnect: false,
});

let completed = false;

const timeout = setTimeout(() => {
  console.error("Test timed out");
  cleanup(1);
}, 15000);

function cleanup(exitCode = 0) {
  if (completed) return;

  completed = true;
  clearTimeout(timeout);

  user1.disconnect();
  user2.disconnect();

  process.exitCode = exitCode;
}

user1.on("connect", () => {
  console.log("User 1 connected:", user1.id);
  user1.emit("join-room", { roomId: ROOM_ID });
});

user2.on("connect", () => {
  console.log("User 2 connected:", user2.id);
  user2.emit("join-room", { roomId: ROOM_ID });
});

let joinedUsers = 0;
const joinedSocketIds = new Set();

function handleJoined(socket) {
  return (data) => {
    if (
      data.roomId !== ROOM_ID ||
      data.userId === undefined
    ) {
      return;
    }

    if (socket === user1 && data.userId) {
      // We wait for the second user below.
    }

    // Count only acknowledgements of each user's own join.
    // The event is broadcast to everyone in the room,
    // so the sender's identity is checked separately.
  };
}

user1.on("user-joined-room", (data) => {
  console.log("User 1 sees room join:", data.username);
  if (!joinedSocketIds.has("user1")) {
    joinedSocketIds.add("user1");
    joinedUsers++;
  }
  startWhenReady();
});

user2.on("user-joined-room", (data) => {
  console.log("User 2 sees room join:", data.username);
  if (!joinedSocketIds.has("user2")) {
    joinedSocketIds.add("user2");
    joinedUsers++;
  }
  startWhenReady();
});

let started = false;

function startWhenReady() {
  if (joinedUsers !== 2 || started) return;

  started = true;

  console.log("Both users joined. Starting test...");

  user2.emit("typing", {
    roomId: ROOM_ID,
    isTyping: true,
  });

  setTimeout(() => {
    user1.emit("send-message", {
      roomId: ROOM_ID,
      content: "Hello from User 1!",
    });
  }, 300);
}

user1.on("user-typing", (data) => {
  console.log("User 1 sees typing:", data);
});

user2.on("new-message", (message) => {
  console.log("User 2 received:", message.content);

  if (message.content !== "Hello from User 1!") return;

  user2.emit("message-read", {
    messageId: message._id,
  });
});

user1.on("message-read", (data) => {
  console.log("User 1 received read receipt:", data);
  console.log("SUCCESS: Real-time chat test passed!");
  cleanup();
});

for (const socket of [user1, user2]) {
  socket.on("connect_error", (error) => {
    console.error("Connection error:", error.message);
    cleanup(1);
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
    cleanup(1);
  });
}

user1.connect();
user2.connect();

