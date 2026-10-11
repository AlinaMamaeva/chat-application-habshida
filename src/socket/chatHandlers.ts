import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import { Room } from "../models/Room.js";
import { Message } from "../models/Message.js";

export const registerChatHandlers = (io: Server, socket: Socket) => {
  const userId = socket.data.userId as string;

  // join room
  socket.on("join-room", async (data: { roomId: string }) => {
    try {
      const roomId = data?.roomId;

      if (typeof roomId !== "string" || !mongoose.isValidObjectId(roomId)) {
        socket.emit("error", "Invalid room ID");
        return;
      }

      const room = await Room.findById(roomId);

      if (!room) {
        socket.emit("error", "Room not found");
        return;
      }

      const isMember = room.members.some(
        (member) => member.toString() === userId,
      );

      if (room.isPrivate && !isMember) {
        socket.emit("error", "Access denied");
        return;
      }

      await socket.join(roomId);

      io.to(roomId).emit("user-joined-room", {
        roomId,
        userId,
        username: socket.data.username,
      });
    } catch (error) {
      console.error("Join room error:", error);
      socket.emit("error", "Failed to join room");
    }
  });

  //send msg
  socket.on(
    "send-message",
    async (data: { roomId: string; content: string }) => {
      try {
        if (
          !data ||
          typeof data.roomId !== "string" ||
          !mongoose.isValidObjectId(data.roomId) ||
          typeof data.content !== "string" ||
          !data.content.trim()
        ) {
          socket.emit("error", "Invalid message data");
          return;
        }

        const room = await Room.findById(data.roomId);

        if (!room) {
          socket.emit("error", "Room not found");
          return;
        }

        const isMember = room.members.some(
          (member) => member.toString() === userId,
        );

        if (room.isPrivate && !isMember) {
          socket.emit("error", "Access denied");
          return;
        }

        // Save message in MongoDB
        const message = await Message.create({
          room: room._id,
          sender: userId,
          content: data.content.trim(),
          readBy: [
            {
              user: new mongoose.Types.ObjectId(userId),
              readAt: new Date(),
            },
          ],
        });

        //update room activity
        room.lastActivity = new Date();
        await room.save();

        //add sender username
        await message.populate("sender", "username");

        //send message to everyone in room
        io.to(data.roomId).emit("new-message", message);
      } catch (error) {
        console.error("Send message error:", error);
        socket.emit("error", "Failed to send message");
      }
    },
  );

  // typing indicator
  socket.on("typing", async (data: { roomId: string; isTyping: boolean }) => {
    try {
      const roomId = data?.roomId;
      const isTyping = data?.isTyping;

      if (
        typeof roomId !== "string" ||
        !mongoose.isValidObjectId(roomId) ||
        typeof isTyping !== "boolean"
      ) {
        socket.emit("error", "Invalid typing data");
        return;
      }

      const room = await Room.findById(roomId);

      if (!room) {
        socket.emit("error", "Room not found");
        return;
      }

      const isMember = room.members.some(
        (member) => member.toString() === userId,
      );

      if (room.isPrivate && !isMember) {
        socket.emit("error", "Access denied");
        return;
      }

      if (!socket.rooms.has(roomId)) {
        socket.emit("error", "Join room first");
        return;
      }

      socket.to(roomId).emit("user-typing", {
        userId,
        username: socket.data.username,
        isTyping,
      });
    } catch (error) {
      console.error("Typing error:", error);
      socket.emit("error", "Failed to update typing status");
    }
  });

  // leave room
  socket.on("leave-room", async (data: { roomId: string }) => {
    try {
      const roomId = data?.roomId;

      // Validate room ID
      if (typeof roomId !== "string" || !mongoose.isValidObjectId(roomId)) {
        socket.emit("error", "Invalid room ID");
        return;
      }

      // check if user is in the room
      if (!socket.rooms.has(roomId)) {
        socket.emit("error", "You are not in this room");
        return;
      }

      // leave room
      await socket.leave(roomId);

      //notify remaining room
      socket.to(roomId).emit("user-left-room", {
        roomId,
        userId,
        username: socket.data.username,
      });

      // confirm to the user
      socket.emit("user-left-room", {
        roomId,
        userId,
        username: socket.data.username,
      });
    } catch (error) {
      console.error("Leave room error:", error);
      socket.emit("error", "Failed to leave room");
    }
  });

  // msg read
  socket.on("message-read", async (data: { messageId: string }) => {
    try {
      const messageId = data?.messageId;

      // validate message ID
      if (
        typeof messageId !== "string" ||
        !mongoose.isValidObjectId(messageId)
      ) {
        socket.emit("error", "Invalid message ID");
        return;
      }

      // find message
      const message = await Message.findById(messageId);

      if (!message) {
        socket.emit("error", "Message not found");
        return;
      }

      // find room
      const room = await Room.findById(message.room);

      if (!room) {
        socket.emit("error", "Room not found");
        return;
      }

      // check access
      const isMember = room.members.some(
        (member) => member.toString() === userId,
      );

      if (room.isPrivate && !isMember) {
        socket.emit("error", "Access denied");
        return;
      }

      const roomId = room._id.toString();

      // check if user joined the room
      if (!socket.rooms.has(roomId)) {
        socket.emit("error", "Join room first");
        return;
      }

      // add read receipt only once
      const readAt = new Date();

      const result = await Message.updateOne(
        {
          _id: messageId,
          "readBy.user": {
            $ne: new mongoose.Types.ObjectId(userId),
          },
        },
        {
          $push: {
            readBy: {
              user: new mongoose.Types.ObjectId(userId),
              readAt,
            },
          },
        },
      );

      if (result.modifiedCount === 0) {
        return;
      }

      // notify participants
      io.to(roomId).emit("message-read", {
        messageId,
        roomId,
        userId,
        readAt,
      });
    } catch (error) {
      console.error("Message read error:", error);
      socket.emit("error", "Failed to mark message as read");
    }
  });
};
