require("dotenv").config({ path: "backend/.env" });
const mongoose = require("mongoose");
const TaskExtractionService = require("./services/taskExtraction/TaskExtractionService");
const Deadline = require("./models/deadlineModel");
const User = require("./models/userModel");
const Chat = require("./models/chatModel");

const runTest = async () => {
    console.log("--- Starting Task Extraction Test ---");

    // 1. Connect DB
    try {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/mern-chat", {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("DB Connected");
    } catch (e) {
        console.error("DB Connection Failed:", e);
        return;
    }

    // 2. Setup Dummy Data
    const dummyUserId = new mongoose.Types.ObjectId();
    const dummyChatId = new mongoose.Types.ObjectId();
    const mockRaviId = new mongoose.Types.ObjectId();

    // Mock Chat and Users in DB so tryMatchNameInChat works
    await Chat.deleteOne({ _id: dummyChatId });
    await User.deleteMany({ email: { $in: ["sender@t.com", "ravi@t.com"] } });

    await User.create({ _id: dummyUserId, name: "SenderProfile", email: "sender@t.com", password: "123" });
    await User.create({ _id: mockRaviId, name: "Ravi", email: "ravi@t.com", password: "123" });
    await Chat.create({ _id: dummyChatId, chatName: "Test Chat", users: [dummyUserId, mockRaviId], isGroupChat: false });

    // Mock Message Helper
    const createMsg = (content) => ({
        _id: new mongoose.Types.ObjectId(),
        content: content,
        sender: dummyUserId,
        chat: dummyChatId
    });

    const verify = async (name, query, expectedCount = 1) => {
        // Wait briefly for async saving
        await new Promise(r => setTimeout(r, 1000));
        const count = await Deadline.countDocuments({ chat: dummyChatId, ...query });
        if (count >= expectedCount) {
            console.log(`[PASS] ${name}`);
        } else {
            console.log(`[FAIL] ${name} (Expected >= ${expectedCount}, Found ${count})`);
            const all = await Deadline.find({ chat: dummyChatId });
            console.log("Current DB state:", all.map(t => ({ title: t.title, ai: t.isAiGenerated, asgn: t.assignedTo })));
        }
    };

    try {
        await Deadline.deleteMany({ chat: dummyChatId });

        // --- Case 1: English Trigger ---
        await TaskExtractionService.extractAndSave(createMsg("Submit report tomorrow"), dummyChatId, dummyUserId);
        await verify("English Trigger", { originalText: "Submit report tomorrow" });

        // --- Case 2: Telugu Trigger ---
        await TaskExtractionService.extractAndSave(createMsg("repu report submit cheyali"), dummyChatId, dummyUserId);
        await verify("Telugu Trigger", { originalText: "repu report submit cheyali" });

        // --- Case 3: Mixed Language ---
        await TaskExtractionService.extractAndSave(createMsg("project repu complete cheyali"), dummyChatId, dummyUserId);
        await verify("Mixed Phrase", { originalText: "project repu complete cheyali" });

        // --- Case 4: Urgent ---
        await TaskExtractionService.extractAndSave(createMsg("submit asap"), dummyChatId, dummyUserId);
        await verify("Urgency context", { originalText: "submit asap", priority: "urgent" });

        // --- Case 5: Multiple Tasks (Segmentation) ---
        await TaskExtractionService.extractAndSave(createMsg("submit final report tomorrow and deploy frontend friday"), dummyChatId, dummyUserId);
        await verify("Multiple Tasks via Split (Report)", { originalText: "submit final report tomorrow" });
        await verify("Multiple Tasks via Split (Deploy)", { originalText: "deploy frontend friday" });

        // --- Case 6: Responsibility case-insensitive ---
        await TaskExtractionService.extractAndSave(createMsg("ravi will review the code tomorrow"), dummyChatId, dummyUserId);
        await verify("Responsibility assignment", { assignedTo: mockRaviId });

        // --- Case 7: Date-only task without explicit trigger ---
        await TaskExtractionService.extractAndSave(createMsg("meeting ellundi morning"), dummyChatId, dummyUserId);
        await verify("Date-based task candidate (>3 words, real date)", { originalText: "meeting ellundi morning" });

        // --- Case 8: Multi-Task Conjunction Connectors ---
        await Deadline.deleteMany({ chat: dummyChatId });
        await TaskExtractionService.extractAndSave(createMsg("submit report tomorrow and deploy backend friday"), dummyChatId, dummyUserId);
        await verify("Conjunction Split (Report)", { originalText: "submit report tomorrow" });
        await verify("Conjunction Split (Deploy)", { originalText: "deploy backend friday" });

        // --- Case 9: Multiline Task Extraction ---
        await Deadline.deleteMany({ chat: dummyChatId });
        const multilineMsg = `repu project report submit cheyali
project ellundi morning complete cheyali
Ravi will review the code tomorrow evening
submit report tomorrow and deploy backend friday
Sahithi urgent please submit the project files asap`;
        await TaskExtractionService.extractAndSave(createMsg(multilineMsg), dummyChatId, dummyUserId);
        // We expect multiple tasks from this single message:
        await verify("Multiline Extract 1", { originalText: "repu project report submit cheyali" });
        await verify("Multiline Extract 2", { originalText: "project ellundi morning complete cheyali" });
        await verify("Multiline Extract 3", { originalText: "Ravi will review the code tomorrow evening" });
        await verify("Multiline Extract 4", { originalText: "submit report tomorrow" });
        await verify("Multiline Extract 5", { originalText: "deploy backend friday" });
        await verify("Multiline Extract 6", { originalText: "Sahithi urgent please submit the project files asap" });

        // --- Case 10: Three tasks in one line ---
        await Deadline.deleteMany({ chat: dummyChatId });
        await TaskExtractionService.extractAndSave(createMsg("submit report tomorrow and deploy backend friday mariyu prepare presentation sunday"), dummyChatId, dummyUserId);
        await verify("Three Tasks 1", { originalText: "submit report tomorrow" });
        await verify("Three Tasks 2", { originalText: "deploy backend friday" });
        await verify("Three Tasks 3", { originalText: "prepare presentation sunday" });

        // --- Case 11: Multi-task with Responsibility ---
        await TaskExtractionService.extractAndSave(createMsg("prepare slides tomorrow and Ravi will send report friday"), dummyChatId, dummyUserId);
        await verify("Resp Task 1", { originalText: "prepare slides tomorrow" });
        await verify("Resp Task 2", { originalText: "Ravi will send report friday", assignedTo: mockRaviId });




    } catch (e) {
        console.error("Test Error:", e);
    } finally {
        // Cleanup
        console.log("\nCleaning up test data...");
        await Deadline.deleteMany({ chat: dummyChatId });
        await Chat.deleteOne({ _id: dummyChatId });
        await User.deleteMany({ email: { $in: ["sender@t.com", "ravi@t.com"] } });
        await mongoose.connection.close();
        console.log("Done.");
    }
};

runTest();
