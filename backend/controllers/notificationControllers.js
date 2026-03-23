const asyncHandler = require("express-async-handler");
const Notification = require("../models/notificationModel");

const fetchNotifications = asyncHandler(async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .populate("chat", "chatName")
      .sort({ createdAt: -1 });
    
    res.status(200).json(notifications);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const markAsRead = asyncHandler(async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    res.status(200).json(notification);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

module.exports = { fetchNotifications, markAsRead };
