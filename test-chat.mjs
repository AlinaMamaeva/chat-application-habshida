
import { io } from "socket.io-client";

const token = process.env.CHAT_TOKEN;

if (!token) {
  console.error("CHAT_TOKEN is missing");
  process.exit(1);
}

const roomId = "6ac996d2f6287b64e32b9a56";

const socket = io("http://localhost:3000", {
  auth: { token },
});

socket.on("connect", () => {
  console.log("Connected:", socket.id);
  socket.emit("join-room", roomId);
});

socket.on("joined-room", (data) => {
  console.log("Joined room:", data.roomId);

  socket.emit("send-message", {
    roomId,
    content: "Hello from Socket.IO!",
  });
});

socket.on("new-message", (message) => {
  console.log("New message:", message.content);
  socket.disconnect();
});

socket.on("error-message", (error) => {
  console.error("Chat error:", error);
  socket.disconnect();
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error.message);
  socket.disconnect();
});

