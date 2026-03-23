const express = require("express");
const { createExpenseGroup, submitExpense, getExpenseGroup, getAllGroups, finishGroup } = require("../controllers/expenseControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(protect, getAllGroups).post(protect, createExpenseGroup);
router.post("/:id/submit", protect, submitExpense);
router.post("/:id/finish", protect, finishGroup);
router.get("/:id", protect, getExpenseGroup);

module.exports = router;
