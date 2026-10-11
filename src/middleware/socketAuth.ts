
import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";
import { User } from "../models/User.js";

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    username: string;
  };
}

export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    //  get JWT token
    const token = socket.handshake.auth.token;

    if (typeof token !== "string" || !token) {
      return next(new Error("Authentication required"));
    }

    //check JWT secret
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      return next(new Error("Server configuration error"));
    }

    //verify token
    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded === "string" ||
      typeof decoded.userId !== "string"
    ) {
      return next(new Error("Invalid token"));
    }

  //find user
    const user = await User.findById(decoded.userId);

    if (!user) {
      return next(new Error("User not found"));
    }

  
    socket.data.userId = user._id.toString();
    socket.data.username = user.username;

   
    next();
  } catch (error) {
    if (error instanceof Error) {
      return next(error);
    }

    next(new Error("Authentication failed"));
  }
};
