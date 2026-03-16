const chrono = require("chrono-node");
const { normalizeDateText } = require("./DateNormalizer");
const Deadline = require("../../models/deadlineModel");
const User = require("../../models/userModel");
const Chat = require("../../models/chatModel");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Init Gemini (conditional)
let model = null;
if (process.env.GEMINI_API_KEY) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    } catch (e) {
        console.error("Gemini Init Error in TaskExtraction:", e.message);
    }
}

// Triggers
const STRONG_TRIGGERS = ["submit", "complete", "finish", "deploy", "upload", "send", "review", "update", "deliver", "prepare", "ivvali", "cheyali", "cheyyali", "pampali"];
const SOFT_TRIGGERS = ["please", "expected to", "kindly", "remember to"];
const URGENCY_KW = ["urgent", "asap", "immediately", "priority"];

// Service
const TaskExtractionService = {

    /**
     * Main Entry Point
     */
    extractAndSave: async (message, chatId, user) => {
        try {
            if (!message || !message.content || !chatId) return;

            // 1. Segmentation
            const segments = splitMessageIntoSegments(message.content);

            for (const segment of segments) {
                console.log("SEGMENT DETECTED:", segment);
                const wordCount = getWordCount(segment);

                // 2. Initial Date Parsing to help with Candidate Detection
                let { date, normalizedText } = parseDate(segment);
                if (date) {
                    console.log("DATE PARSED:", date);
                }

                // 3. Task Candidate Detection
                const hasStrongTrigger = checkTriggers(segment, STRONG_TRIGGERS);
                const hasSoftTrigger = checkTriggers(segment, SOFT_TRIGGERS);

                // Rule: Has trigger OR (Has Date AND >=3 words)
                const isCandidate = hasStrongTrigger || hasSoftTrigger || (date && wordCount >= 3);

                if (!isCandidate) continue;
                console.log("TASK CANDIDATE:", segment);

                // 4. Responsibility
                // We fetch the chat to validate exact participants
                let assignedTo = await extractResponsibility(segment, message.sender, chatId);

                // 5. Urgency Check
                const isUrgentKW = URGENCY_KW.some(kw => segment.toLowerCase().includes(kw));

                // 6. Logic Branch / Priority
                let finalDate = date;
                let finalPriority = "normal";
                let isAi = false;
                let finalTitle = segment;

                if (finalDate) {
                    const hoursDiff = (finalDate - new Date()) / (1000 * 60 * 60);
                    finalPriority = hoursDiff <= 24 ? "high" : "normal";
                } else if (isUrgentKW) {
                    finalPriority = "urgent";
                    finalDate = null;
                }

                // 7. Gemini Fallback Logic
                // Trigger Gemini if >5 words AND (no date OR no assignee)
                if (wordCount > 5 && (!finalDate || !assignedTo) && model) {
                    const geminiResult = await geminiFallbackWithRetry(segment);
                    if (geminiResult && geminiResult.isTask) {
                        finalTitle = geminiResult.taskTitle || segment;

                        if (!finalDate && geminiResult.dueDate) {
                            const parsedAiDate = new Date(geminiResult.dueDate);
                            if (!isNaN(parsedAiDate)) finalDate = parsedAiDate;
                        }

                        if (!assignedTo && geminiResult.assignedToName) {
                            // Optionally try to match the AI returned name again
                            const aiAssigned = await tryMatchNameInChat(geminiResult.assignedToName, chatId);
                            if (aiAssigned) assignedTo = aiAssigned;
                        }

                        if (geminiResult.priority) {
                            finalPriority = ["high", "normal", "urgent"].includes(geminiResult.priority.toLowerCase())
                                ? geminiResult.priority.toLowerCase()
                                : finalPriority;
                        }

                        isAi = true;
                    }
                }

                // If still no date and not urgent, it's not a measurable task
                if (!finalDate && finalPriority !== "urgent") {
                    continue;
                }

                // Clean Title
                if (!isAi) {
                    finalTitle = cleanTitle(segment, normalizedText);
                }

                // 8. Deduplication & Save
                await saveTask({
                    title: finalTitle.substring(0, 150),
                    dueAt: finalDate,
                    priority: finalPriority,
                    assignedTo: assignedTo,
                    chat: chatId,
                    message: message._id,
                    createdBy: message.sender,
                    originalText: segment,
                    isAiGenerated: isAi
                });
            }

        } catch (error) {
            console.error("TaskExtractionService Error:", error.message);
        }
    }
};

// --- Helpers ---

const splitMessageIntoSegments = (text) => {
    return text
        .split(/\s+(?:and|mariyu)\s+|\.\s+|;|\n+/i)
        .map(segment => segment.trim())
        .filter(Boolean);
};

const checkTriggers = (text, triggers) => {
    const lower = text.toLowerCase();
    return triggers.some(t => lower.includes(t));
};

const parseDate = (text) => {
    const normalized = normalizeDateText(text);
    const results = chrono.parse(normalized);
    if (results && results.length > 0) {
        return {
            date: results[0].start.date(),
            normalizedText: results[0].text
        };
    }
    return { date: null, normalizedText: "" };
};

const cleanTitle = (rawSegment, dateText) => {
    let title = rawSegment;
    if (dateText) {
        title = title.replace(new RegExp(escapeRegExp(dateText), 'i'), "");
    }
    const allKw = [...STRONG_TRIGGERS, ...SOFT_TRIGGERS, ...URGENCY_KW];
    allKw.forEach(w => {
        title = title.replace(new RegExp(`\\b${escapeRegExp(w)}\\b`, 'gi'), "");
    });
    title = title.replace(/\s+/g, " ").trim();

    // If we stripped everything (e.g., "submit asap"), fallback to original so title is not empty
    return title.length > 0 ? title : rawSegment;
};

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getWordCount = (str) => str.trim().split(/\s+/).length;

const tryMatchNameInChat = async (nameCandidate, chatId) => {
    if (!nameCandidate) return null;
    const lowerCandidate = nameCandidate.toLowerCase();

    // Ignore pronouns
    if (["i", "you", "we", "he", "she", "it", "they"].includes(lowerCandidate)) return null;

    try {
        const chat = await Chat.findById(chatId).populate("users", "name");
        if (chat && chat.users) {
            const matchedUser = chat.users.find(u => u.name && u.name.toLowerCase() === lowerCandidate);
            if (matchedUser) {
                return matchedUser._id;
            }
        }
    } catch (e) { /* ignore */ }

    return null;
};

const extractResponsibility = async (segment, senderId, chatId) => {
    const lower = segment.toLowerCase();

    // 1. Starts with "I" or "Nenu"
    if (lower.startsWith("i ") || lower.startsWith("i'll ") || lower.startsWith("nenu ") || lower.startsWith("naaku ")) {
        return senderId;
    }

    // 2. "@Mention" logic (approximated by looking for "name will" pattern since we don't have explicit entity map here)
    const match = segment.match(/([a-zA-Z]+)\s+will/i);
    if (match && match[1]) {
        const nameCandidate = match[1];
        return await tryMatchNameInChat(nameCandidate, chatId);
    }

    return null;
};

const withTimeout = (promise, ms) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
    ]);
};

const geminiFallbackWithRetry = async (segment, retries = 1) => {
    for (let i = 0; i <= retries; i++) {
        try {
            return await geminiFallback(segment);
        } catch (error) {
            if (i === retries) return null;
        }
    }
};

const geminiFallback = async (segment) => {
    if (!model) return null;

    const prompt = `
    Extract task details from this sentence and return ONLY strict JSON. 
    Sentence: "${segment}"
    Categories:
    - isTask: boolean
    - taskTitle: string (brief description)
    - dueDate: string format "YYYY-MM-DD HH:mm" or null
    - priority: "high", "normal", or "urgent"
    - assignedToName: string (person name) or null
    
    Output JSON format:
    {"isTask": true/false, "taskTitle": "...", "dueDate": "...", "priority": "...", "assignedToName": "..."}
    `;

    const request = model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 150 }
    });

    const result = await withTimeout(request, 8000); // 8 second timeout

    const txt = result.response.text().replace(/```json/g, "").replace(/```/g, "").trim();
    const json = JSON.parse(txt);

    return json;
};

const deduplicationNormalize = (title) => {
    let normalized = title.toLowerCase();
    // Remove stop words
    normalized = normalized.replace(/\\b(the|a|an|to)\\b/g, "");
    // Collapse spaces
    return normalized.replace(/\\s+/g, " ").trim();
};

const saveTask = async (taskData) => {
    const normTitle = deduplicationNormalize(taskData.title);

    let dateQuery = {};
    if (taskData.dueAt) {
        const start = new Date(taskData.dueAt); start.setSeconds(0, 0);
        const end = new Date(taskData.dueAt); end.setSeconds(59, 999);
        dateQuery = { dueAt: { $gte: start, $lte: end } };
    } else {
        dateQuery = { dueAt: null };
    }

    // Deduplication check: Chat ID + normalized Title + Date
    // We use JS filtering inside DB for simplicity or approximate regex
    const existingCount = await Deadline.countDocuments({
        chat: taskData.chat,
        // Match if DB title normalized would be the same. 
        // We can do a simpler regex match:
        title: new RegExp(escapeRegExp(taskData.title.trim()), 'i'),
        ...dateQuery
    });

    if (existingCount === 0) {
        await Deadline.create(taskData);
        console.log("TASK CREATED:", taskData.title);
    } else {
        console.log("Duplicate Task Ignored:", normTitle);
    }
};

module.exports = TaskExtractionService;
