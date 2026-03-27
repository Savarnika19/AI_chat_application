const asyncHandler = require("express-async-handler");
const { calculateSettlement } = require("../services/expenseService");
const Notification = require("../models/notificationModel");
const ExpenseGroup = require("../models/expenseGroupModel");

const createExpenseGroup = asyncHandler(async (req, res) => {
  const { participants } = req.body;

  if (!participants) {
    res.status(400);
    throw new Error("Please provide participants");
  }

  if (participants.length < 2) {
    res.status(400);
    throw new Error("At least 2 participants are required");
  }

  const expenseGroup = await ExpenseGroup.create({
    createdBy: req.user._id,
    participants,
    status: "active",
  });

  const createdNotifications = [];

  for (const participantId of participants) {
    const notification = await Notification.create({
      user: participantId,
      message: "Expense group created. Please enter your expenses.",
      expenseGroup: expenseGroup._id,
      type: "expense_created"
    });
    
    const fullNotification = await Notification.findById(notification._id)
      .populate("expenseGroup");
      
    createdNotifications.push(fullNotification);
  }

  res.status(201).json({ expenseGroup, notifications: createdNotifications });
});

const submitExpense = asyncHandler(async (req, res) => {
  const { targetUserId, amount } = req.body;
  const groupId = req.params.id;

  if (amount < 0) {
    res.status(400);
    throw new Error("Negative amounts are not allowed.");
  }

  const group = await ExpenseGroup.findOneAndUpdate(
    { _id: groupId, status: "active", "payments.user": { $ne: targetUserId } },
    { $push: { payments: { user: targetUserId, amount: Number(amount), enteredBy: req.user._id } } },
    { new: true }
  ).populate("participants", "name");

  if (!group) {
    res.status(400);
    throw new Error("Duplicate submission, unauthorized user, or group is already completed.");
  }

  let createdNotifications = [];

  if (group.payments.length === group.participants.length) {
    const formattedParticipants = group.participants.map(p => {
      const payment = group.payments.find(pay => pay.user.toString() === p._id.toString());
      return {
        userId: p._id,
        name: p.name,
        amountPaid: payment ? payment.amount : 0
      };
    });

    const settlements = calculateSettlement(formattedParticipants);

    group.settlements = settlements;
    group.status = "completed";
    await group.save();

    for (const settlement of settlements) {
      const message = `You should pay ₹${settlement.amount} to ${settlement.toName}`;
      const notification = await Notification.create({
        user: settlement.from,
        message,
        expenseGroup: group._id,
        type: "expense_settlement"
      });
      
      const fullNotification = await Notification.findById(notification._id)
        .populate("expenseGroup");
        
      createdNotifications.push(fullNotification);
    }
  }

  res.status(200).json({ expenseGroup: group, notifications: createdNotifications });
});

const getExpenseGroup = asyncHandler(async (req, res) => {
  const expenseGroup = await ExpenseGroup.findById(req.params.id)
    .populate("participants", "name email pic")
    .populate("payments.user", "name email pic")
    .populate("createdBy", "name email pic")
    .populate("chat", "chatName isGroupChat users");

  if (!expenseGroup) {
    res.status(404);
    throw new Error("Expense group not found");
  }

  res.status(200).json(expenseGroup);
});

const getAllGroups = asyncHandler(async (req, res) => {
  const groups = await ExpenseGroup.find({ participants: req.user._id })
    .populate("participants", "name pic")
    .populate("createdBy", "name")
    .populate("chat", "chatName isGroupChat users")
    .sort({ createdAt: -1 });

  const active = groups.filter(g => g.status === "active");
  const completed = groups.filter(g => g.status === "completed");

  res.status(200).json({ active, completed });
});

const finishGroup = asyncHandler(async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user._id;

  const group = await ExpenseGroup.findOneAndUpdate(
    { _id: groupId, status: "active", createdBy: userId },
    { $set: { status: "completed" } },
    { new: true }
  ).populate("participants", "name");

  if (!group) {
    res.status(400);
    throw new Error("Group not found, unauthorized, or already completed");
  }

  const formattedParticipants = group.participants.map(p => {
    const payment = group.payments.find(pay => pay.user.toString() === p._id.toString());
    return {
      userId: p._id,
      name: p.name,
      amountPaid: payment ? payment.amount : 0
    };
  });

  const settlements = calculateSettlement(formattedParticipants);

  group.settlements = settlements;
  await group.save();

  let createdNotifications = [];
  for (const settlement of settlements) {
    const message = `You should pay ₹${settlement.amount} to ${settlement.toName}`;
    const notification = await Notification.create({
      user: settlement.from,
      message,
      expenseGroup: group._id,
      type: "expense_settlement"
    });
    
    const fullNotification = await Notification.findById(notification._id)
      .populate("expenseGroup");
      
    createdNotifications.push(fullNotification);
  }

  res.status(200).json({ expenseGroup: group, notifications: createdNotifications });
});

const deleteExpenseGroup = asyncHandler(async (req, res) => {
  const groupId = req.params.id;
  const userId = req.user._id;

  const group = await ExpenseGroup.findById(groupId);
  if (!group) {
    res.status(404);
    throw new Error("Expense group not found");
  }

  const isParticipant = group.participants.some(
    (participantId) => participantId.toString() === userId.toString()
  );
  if (!isParticipant) {
    res.status(403);
    throw new Error("Only participants can delete this group");
  }

  await Notification.deleteMany({ expenseGroup: group._id });
  await ExpenseGroup.deleteOne({ _id: groupId });

  res.status(200).json({ message: "Expense group deleted" });
});

module.exports = { createExpenseGroup, submitExpense, getExpenseGroup, getAllGroups, finishGroup, deleteExpenseGroup };
