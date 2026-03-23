const mongoose = require("mongoose");

const expenseGroupSchema = mongoose.Schema(
  {
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    payments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        amount: { type: Number, required: true },
        enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
    },
    settlements: [
      {
        from: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        to: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        amount: { type: Number },
      },
    ],
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

const ExpenseGroup = mongoose.model("ExpenseGroup", expenseGroupSchema);

module.exports = ExpenseGroup;
