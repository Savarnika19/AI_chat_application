const mongoose = require("mongoose");

const deadlineSchema = mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            default: "Deadline",
        },
        dueAt: {
            type: Date,
            required: false, // Made optional to support 'urgent' tasks without dates
        },
        priority: {
            type: String,
            enum: ["high", "normal", "urgent"],
            default: "normal",
        },
        chat: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Chat",
            required: true,
        },
        message: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            required: true,
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "completed"],
            default: "pending",
        },
        originalText: {
            type: String,
            trim: true,
        },
        isAiGenerated: {
            type: Boolean,
            default: false,
        }
    },
    {
        timestamps: true,
    }
);

const Deadline = mongoose.model("Deadline", deadlineSchema);

module.exports = Deadline;
