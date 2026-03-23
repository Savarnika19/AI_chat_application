const mongoose = require("mongoose");

const notificationModel = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
    type: {
      type: String,
      enum: ["expense_created", "expense_settlement", "chat_message"],
      default: "chat_message",
      required: true,
    },
    expenseGroup: { type: mongoose.Schema.Types.ObjectId, ref: "ExpenseGroup" },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  }
);

const Notification = mongoose.model("Notification", notificationModel);

module.exports = Notification;
