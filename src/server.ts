
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";

import { connectDB } from "./config/database.js";
import { User } from "./models/User.js";

import authRoutes from "./routes/auth.js";
import roomRoutes from "./routes/rooms.js";

import { socketAuthMiddleware } from "./middleware/socketAuth.js";
import { registerChatHandlers } from "./socket/chatHandlers.js";

// 1. Create Express app
const app = express();

// 2. Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// 3. Serve public HTML and JavaScript files
app.use(express.static(path.join(process.cwd(), "public")));

// 4. API routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);

// 5. Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// 6. Create HTTP server
const httpServer = createServer(app);

// 7. Create Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// 8. Socket authentication
io.use(socketAuthMiddleware);

// 9. Socket.IO connection
io.on("connection", (socket) => {
  const userId = socket.data.userId as string;
  const username = socket.data.username as string;

  console.log("User connected:", socket.id);

  // Register chat handlers immediately
  registerChatHandlers(io, socket);

  // Join personal room
  socket.join(`user:${userId}`);

  // Mark user as online
  void (async () => {
    try {
      await User.findByIdAndUpdate(userId, {
        isOnline: true,
      });

      io.emit("user-online", {
        userId,
        username,
      });
    } catch (error) {
      console.error("Online status error:", error);
    }
  })();

  // Handle disconnect
  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);

    try {
      const remainingSockets = await io
        .in(`user:${userId}`)
        .fetchSockets();

      // User is still connected in another tab
      if (remainingSockets.length > 0) {
        return;
      }

      const lastSeen = new Date();

      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen,
      });

      io.emit("user-offline", {
        userId,
        username,
        lastSeen,
      });
    } catch (error) {
      console.error("Offline status error:", error);
    }
  });
});

// 10. Start server
const PORT = Number(process.env.PORT) || 3000;

const startServer = async () => {
  try {
    await connectDB();

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
