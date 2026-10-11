import mongoose, { Schema, Document } from "mongoose";

export interface IReadReceipt {
  user: mongoose.Types.ObjectId;
  readAt: Date;
}

// msg interface
export interface IMessage extends Document {
  room: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  content: string;
  readBy: IReadReceipt[];
  edited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const readReceiptSchema = new Schema<IReadReceipt>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    readAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

// msg schema
const messageSchema = new Schema<IMessage>(
  {
    room: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },

    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
    },

    readBy: {
      type: [readReceiptSchema],
      default: [],
    },

    edited: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// index for message history
messageSchema.index({ room: 1, createdAt: -1 });

//export model
export const Message = mongoose.model<IMessage>("Message", messageSchema);
