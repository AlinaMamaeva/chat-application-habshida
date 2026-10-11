
import mongoose, { Schema, Document } from "mongoose";

export interface IRoom extends Document {
  name: string;
  description: string;
  isPrivate: boolean;
  members: mongoose.Types.ObjectId[];
  admins: mongoose.Types.ObjectId[];
  lastActivity: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    isPrivate: {
      type: Boolean,
      default: false,
    },

    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const Room = mongoose.model<IRoom>("Room", roomSchema);
