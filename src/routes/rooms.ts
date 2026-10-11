import { Router } from "express";
import { Room } from "../models/Room.js";
import { authenticate, type AuthRequest } from "../middleware/auth.js";
import mongoose from "mongoose";
import { Message } from "../models/Message.js";

const router = Router();

// POST /api/rooms
router.post("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, description, isPrivate } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({
        message: "Room name is required",
      });
      return;
    }

    if (description !== undefined && typeof description !== "string") {
      res.status(400).json({
        message: "Description must be a string",
      });
      return;
    }

    if (isPrivate !== undefined && typeof isPrivate !== "boolean") {
      res.status(400).json({
        message: "isPrivate must be a boolean",
      });
      return;
    }

    if (!req.userId) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    const room = await Room.create({
      name: name.trim(),
      description: description ?? "",
      isPrivate: isPrivate ?? false,
      members: [req.userId],
      admins: [req.userId],
    });

    res.status(201).json({
      message: "Room created successfully",
      room,
    });
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({
      message: "Failed to create room",
    });
  }
});

router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      res.status(401).json({
        message: "Unauthorized",
      });
      return;
    }

    const rooms = await Room.find({
      $or: [{ isPrivate: false }, { members: req.userId }],
    })
      .sort({ lastActivity: -1 })
      .populate("members", "username")
      .populate("admins", "username");

    res.json({
      rooms,
    });
  } catch (error) {
    console.error("Get rooms error:", error);

    res.status(500).json({
      message: "Failed to fetch rooms",
    });
  }
});


router.get("/:roomId/messages", authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomId } = req.params;

    if (!req.userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (typeof roomId !== "string" ||
        !mongoose.isValidObjectId(roomId)) {
      res.status(400).json({ message: "Invalid room ID" });
      return;
    }

    const room = await Room.findById(roomId);

    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }

    const isMember = room.members.some(
      (member) => member.toString() === req.userId
    );

    if (room.isPrivate && !isMember) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    if (
      !Number.isInteger(page) || page < 1 ||
      !Number.isInteger(limit) || limit < 1 || limit > 100
    ) {
      res.status(400).json({ message: "Invalid pagination" });
      return;
    }

    const messages = await Message.find({ room: roomId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("sender", "username");

    res.json({
      messages: messages.reverse(),
      page,
      limit,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({
      message: "Failed to fetch messages",
    });
  }
});


export default router;
