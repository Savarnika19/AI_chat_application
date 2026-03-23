const express = require("express");
const { fetchNotifications, markAsRead } = require("../controllers/notificationControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(protect, fetchNotifications);
router.route("/:id").patch(protect, markAsRead);

module.exports = router;
