const asyncHandler = require("express-async-handler");
const Message = require("../models/messageModel");
const User = require("../models/userModel");
const Chat = require("../models/chatModel");
const TaskExtractionService = require("../services/taskExtraction/TaskExtractionService");

//@description     Get all Messages
//@route           GET /api/Message/:chatId
//@access          Protected
const allMessages = asyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({
      chat: req.params.chatId,
      deletedBy: { $nin: [req.user._id] }
    })
      .populate("sender", "name pic email")
      .populate("chat");
    res.json(messages);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//@description     Create New Message
//@route           POST /api/Message/
//@access          Protected
const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    console.log("Invalid data passed into request");
    return res.sendStatus(400);
  }

  var newMessage = {
    sender: req.user._id,
    content: content,
    chat: chatId,
  };

  try {
    var message = await Message.create(newMessage);

    message = await message.populate("sender", "name pic");
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic email",
    });

    await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

    // --- Auto-detect Deadline Logic (TaskExtractionService) ---
    try {
      await TaskExtractionService.extractAndSave(message, chatId, req.user._id);
    } catch (deadlineError) {
      console.error("Failed to auto-detect deadline:", deadlineError);
    }

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const { summarize } = require("../services/geminiSummarizer");

const summarizeMessages = asyncHandler(async (req, res) => {
  const { chatId, messageIds } = req.body;
  let messages = [];

  if (chatId) {
    // Unread messages: those NOT read by current user
    messages = await Message.find({
      chat: chatId,
      readBy: { $ne: req.user._id },
    }).populate("sender", "name");
  } else if (messageIds && messageIds.length > 0) {
    messages = await Message.find({
      _id: { $in: messageIds },
    }).populate("sender", "name");
  }

  if (!messages || messages.length === 0) {
    return res.status(400);
    throw new Error("No messages found to summarize");
  }

  try {
    const summaryText = await summarize(messages, chatId || "unknown");
    res.json({ summary: summaryText });
  } catch (err) {
    console.error("Summarization error:", err);
    res.json({ summary: "Summary unavailable." });
  }
});

const deleteMessages = asyncHandler(async (req, res) => {
  const { messageIds } = req.body;

  if (!messageIds || messageIds.length === 0) {
    return res.status(400);
    throw new Error("No message IDs provided");
  }

  // Find affected chats before deleting
  const messagesToDelete = await Message.find({ _id: { $in: messageIds } });
  const chatIds = [...new Set(messagesToDelete.map(m => m.chat.toString()))];

  // Hard Delete: Remove completely from the database
  const result = await Message.deleteMany(
    { _id: { $in: messageIds } }
  );

  // Update latestMessage for affected chats
  for (const chatId of chatIds) {
    const latestMsg = await Message.findOne({ chat: chatId }).sort({ createdAt: -1 });
    await Chat.findByIdAndUpdate(chatId, {
      latestMessage: latestMsg ? latestMsg._id : null
    });
  }

  if (result.deletedCount > 0 || result.acknowledged) {
    res.json({ message: "Messages deleted", deletedCount: result.deletedCount || messageIds.length });
  } else {
    res.status(404);
    throw new Error("No messages found to delete");
  }
});

module.exports = { allMessages, sendMessage, summarizeMessages, deleteMessages };
