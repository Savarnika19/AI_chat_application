// debug.js
require("dotenv").config({ path: "backend/.env" });
const mongoose = require("mongoose");
const TaskExtractionService = require("./backend/services/taskExtraction/TaskExtractionService");

const run = async () => {
    // Override saveTask to just print
    TaskExtractionService.__saveTaskOrig = TaskExtractionService.saveTask; // wait, it's not exported
};
