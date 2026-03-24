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
        model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    } catch (e) {
        console.error("Gemini Init Error in TaskExtraction:", e.message);
    }
}

// Triggers
const STRONG_TRIGGERS = ["submit", "prepare", "complete", "finish", "deploy", "upload", "send", "review", "update", "deliver", "cheyali", "cheyyali", "ivvali", "pampali"];
const SOFT_TRIGGERS = ["please", "expected to", "kindly", "remember to"];
const URGENCY_KW = ["urgent", "asap", "immediately", "priority"];
const IGNORE_PHRASES = ["see you", "maybe", "ok", "yes", "hi", "hello", "thanks", "thank you", "good morning", "good evening", "good night", "bye", "see ya", "take care", "how are you", "what's up", "nice", "great", "awesome", "cool"];

const CLEANUP_PHRASES = [
    "we also planned to", "we plan to", "we need to", "i will", "we will", "he will", "she will", 
    "they will", "you need to", "you should", "we should", "i should", "is expected to",
    "please make sure to", "please ensure", "please", "can you", "could you", "make sure to"
];

const preNormalizeMessage = (text) => {
    let normalized = text;
    normalized = normalized.replace(/\brepu\b/gi, "tomorrow");
    normalized = normalized.replace(/\bellundi\b/gi, "day after tomorrow");
    return normalized;
};

// Service
const TaskExtractionService = {

    /**
     * Main Entry Point
     */
    extractAndSave: async (message, chatId, user) => {
        try {
            if (!message || !message.content || !chatId) return;

            // 1. Multilingual Normalization FIRST
            const preNormalizedContent = preNormalizeMessage(message.content);

            // 2. Safe Segmentation
            const segments = safeSegment(preNormalizedContent);

            for (const segment of segments) {
                console.log("SEGMENT DETECTED:", segment);
                const wordCount = getWordCount(segment);

                // 3. Strict Task Validation (Must contain trigger verb)
                const hasStrongTrigger = checkTriggers(segment, STRONG_TRIGGERS);
                if (!hasStrongTrigger || wordCount < 3) continue; // Reject invalid/broken sentences

                // Ignore casual phrases
                if (IGNORE_PHRASES.some(p => segment.toLowerCase().includes(p))) {
                    continue;
                }

                console.log("TASK CANDIDATE (VALID):", segment);

                let { date } = parseDate(segment);

                // 4. Responsibility
                let assignedTo = await extractResponsibility(segment, message.sender, chatId);

                // 5. Clean Title
                let finalTitle = cleanActionableTitle(segment);
                if (finalTitle.length < 5) continue; // Safety check

                // 6. Urgency Check
                const isUrgentKW = URGENCY_KW.some(kw => segment.toLowerCase().includes(kw));

                // 7. Logic Branch
                let finalPriority = "normal";
                let isAi = false;

                if (date) {
                    const hoursDiff = (date - new Date()) / (1000 * 60 * 60);
                    finalPriority = hoursDiff <= 24 ? "high" : "normal";
                } else if (isUrgentKW) {
                    finalPriority = "urgent";
                }

                if (wordCount > 5 && (!date || !assignedTo) && model) {
                    const geminiResult = await geminiFallbackWithRetry(segment);
                    if (geminiResult && geminiResult.isTask) {
                        finalTitle = geminiResult.taskTitle || finalTitle;

                        if (!date && geminiResult.dueDate) {
                            const parsedAiDate = new Date(geminiResult.dueDate);
                            if (!isNaN(parsedAiDate)) date = parsedAiDate;
                        }

                        if (!assignedTo && geminiResult.assignedToName) {
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

                if (!date && finalPriority !== "urgent") {
                    continue;
                }

                // 8. Deduplicate & Save
                await saveTask({
                    title: finalTitle.substring(0, 150),
                    dueAt: date,
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

const safeSegment = (text) => {
    // 1. Split strict hard delimiters
    let initialSegments = text.split(/\.\s+|;|\n+/i).map(s => s.trim()).filter(Boolean);
    
    // 2. Safe "and" / "mariyu" splitting
    let finalSegments = [];
    initialSegments.forEach(seg => {
        const andParts = seg.split(/\s+and\s+|\s+mariyu\s+/i);
        if (andParts.length > 1) {
            let currentClause = andParts[0];
            for (let i = 1; i < andParts.length; i++) {
                const leftHasVerb = checkTriggers(currentClause, STRONG_TRIGGERS);
                const rightHasVerb = checkTriggers(andParts[i], STRONG_TRIGGERS);
                
                if (leftHasVerb && rightHasVerb) {
                    finalSegments.push(currentClause.trim());
                    currentClause = andParts[i];
                } else {
                    currentClause += " and " + andParts[i];
                }
            }
            finalSegments.push(currentClause.trim());
        } else {
            finalSegments.push(seg);
        }
    });

    return finalSegments.filter(Boolean);
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

const cleanActionableTitle = (title) => {
    let clean = title;
    CLEANUP_PHRASES.forEach(phrase => {
        clean = clean.replace(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi'), "");
    });
    // Ensure first letter is capitalized for UI polish
    clean = clean.replace(/\s+/g, " ").trim();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
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
    normalized = normalized.replace(/\b(the|a|an|to)\b/g, "");
    return normalized.replace(/\s+/g, " ").trim();
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

    taskData.normalizedTitle = normTitle;

    const existingCount = await Deadline.countDocuments({
        chat: taskData.chat,
        normalizedTitle: normTitle,
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
