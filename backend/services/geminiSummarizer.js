const { GoogleGenerativeAI } = require("@google/generative-ai");
const { summarize: textRankSummarize } = require("../config/TextRank");

// NOTE: Backend restart required after modifying summarizer.

let genAI = null;
let model = null;

const initializeGemini = () => {
    if (!model) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            try {
                genAI = new GoogleGenerativeAI(apiKey);
                model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
            } catch (error) {
                console.error("Gemini initialization error:", error.message);
            }
        } else {
            console.warn("GEMINI_API_KEY not found in environment variables. Defaulting to TextRank.");
        }
    }
};

// Global Throttling State
let globalRequestCount = 0;
const GLOBAL_RATE_LIMIT = 50; // requests per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute
setInterval(() => { globalRequestCount = 0; }, RATE_LIMIT_WINDOW);

// Per-Chat Cooldown State
const chatCooldowns = new Map();
const CHAT_COOLDOWN_MS = 60000; // 1 minute

// Cost Safeguard
let dailyTokenUsage = 0;
const DAILY_TOKEN_LIMIT = 4000000; // ~4M tokens ($2.00)
setInterval(() => { dailyTokenUsage = 0; }, 24 * 60 * 60 * 1000); // Reset daily

/**
 * Custom Concurrency Limiter
 */
const limit = (concurrency) => {
    const queue = [];
    let active = 0;
    const next = () => {
        if (queue.length && active < concurrency) {
            const { fn, resolve, reject } = queue.shift();
            active++;
            fn().then(resolve).catch(reject).finally(() => {
                active--;
                next();
            });
        }
    };
    return (fn) => new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        next();
    });
};

const limiter = limit(5); // Concurrency 5

/**
 * Normalizes string for deduplication.
 */
const normalize = (str) => {
    if (!str) return "";
    return str.trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
};

/**
 * Extract max 8 bullets safely
 */
const extractBullets = (response) => {
    if (!response) return "";
    const bullets = response
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.startsWith("-") || l.startsWith("*"));
    return bullets.slice(0, 8).map(l => l.replace(/^\*\s*/, "- ")).join("\n");
};

/**
 * Chunks messages by character limit.
 */
const chunkMessages = (messages, limit = 3000) => {
    const chunks = [];
    let currentChunk = "";

    messages.forEach(msg => {
        const sender = msg.sender && msg.sender.name ? msg.sender.name : "User";
        const content = msg.content || "";
        const formatted = `[${sender}]: ${content}\n`;

        if (currentChunk.length + formatted.length > limit) {
            if (currentChunk.length > 0) chunks.push(currentChunk);
            currentChunk = formatted;
        } else {
            currentChunk += formatted;
        }
    });
    if (currentChunk.length > 0) chunks.push(currentChunk);

    // Safety check for massive single messages (rare but possible)
    return chunks.map(c => c.length > limit * 1.5 ? c.substring(0, limit * 1.5) : c);
};

/**
 * Retry wrapper
 */
const withRetry = async (fn, retries = 1, timeout = 6000) => {
    for (let i = 0; i <= retries; i++) {
        try {
            return await Promise.race([
                fn(),
                new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), timeout))
            ]);
        } catch (err) {
            if (i === retries) throw err;
            // Only retry network/5xx/timeout
            if (!err.message.includes("Timeout") && !err.message.includes("fetch failed") && !err.response?.status?.toString().startsWith('5')) {
                // Check if it is the 404 to allow fallback logic higher up?
                // No, fallback logic is inside extraction function now.
                // If it throws here, it failed fallback too.
                throw err;
            }
            await new Promise(r => setTimeout(r, 1000)); // Backoff
        }
    }
};

/**
 * Extracts bullet points from text chunk.
 */
const extractSummary = async (text) => {
    if (!model) throw new Error("Gemini not initialized");

    const prompt = `
You are an AI assistant that extracts a concise summary from chat conversations.

Your task is to analyze the input text and return a **SHORT, HIGH-QUALITY SUMMARY** of maximum 5-8 bullet points.

---
## RULES

### 1. Focus on Importance
Include ONLY:
- Key tasks
- Critical deadlines
- Important financial info (if present)
- Major decisions

DO NOT include minor details, repeated info, generic statements, or technical suggestions.

### 2. Strict Length Control
- Maximum: 5 to 8 bullet points
- Each point: 1 short line only
- No paragraphs

### 3. Merge Information
Combine related points into single bullet points where possible.

### 4. Multilingual Normalization
Convert words like 'repu' to 'tomorrow' and 'ellundi' to 'day after tomorrow'.

### 5. No Hallucination
Only use given content. Do not add new info.

### 6. NO Categories
DO NOT group points into Tasks, Deadlines, etc. Return a single, unified list.

## OUTPUT FORMAT
Each point must start with '-' and be one short line only. Do not exceed 8 points.
Return ONLY the bullet points.

Chat Segment:
"""
${text}
"""
`;
    let currentModel = model;
    let fallbackTried = false;

    while (true) {
        try {
            dailyTokenUsage += text.length / 4;
            const result = await currentModel.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3 },
            });
            const txt = result.response.text();
            dailyTokenUsage += txt.length / 4;
            return extractBullets(txt);
        } catch (error) {
            if ((error.message.includes("404") || error.message.includes("not found")) && !fallbackTried) {
                console.warn("Gemini Flash failed (404). Falling back to gemini-pro-latest.");
                try {
                    currentModel = genAI.getGenerativeModel({ model: "gemini-pro-latest" });
                    model = currentModel; 
                    fallbackTried = true;
                    continue;
                } catch (fallbackError) {
                    throw error;
                }
            }
            throw error;
        }
    }
};

/**
 * Merges multiple summaries into one final max-8 array.
 */
const mergeSummaries = async (textList) => {
    if (textList.length === 0) return "";
    if (textList.length === 1) return extractBullets(textList[0]);

    const listsString = textList.join("\n\n");

    const prompt = `
Merge the following bullet points into a final list of maximum 8 unique, non-duplicate bullet points.
Combine related points. Do not expand. Do not exceed 8.
Each point must start with '-' and be one short line only. Return ONLY the bullet points.

Input Lists:
${listsString}
`;
    dailyTokenUsage += listsString.length / 4;

    const result = await withRetry(async () => {
        return model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 },
        });
    }, 0, 60000); 

    const txt = result.response.text();
    dailyTokenUsage += txt.length / 4;
    return extractBullets(txt);
};

/**
 * Main Summary Function
 */
const summarize = async (input, chatId = "unknown") => {
    initializeGemini();

    // 0. Safeguards
    if (dailyTokenUsage > DAILY_TOKEN_LIMIT) {
        console.warn("Daily token limit exceeded. Falling back to TextRank.");
        return textRankFallback(input);
    }
    if (globalRequestCount >= GLOBAL_RATE_LIMIT) {
        throw new Error("Global rate limit exceeded (429)");
    }
    if (chatId && chatCooldowns.has(chatId)) {
        const last = chatCooldowns.get(chatId);
        if (Date.now() - last < CHAT_COOLDOWN_MS) throw new Error("Rate limit per chat exceeded (429)");
    }

    // Update Counters
    globalRequestCount++;
    if (chatId) chatCooldowns.set(chatId, Date.now());

    // 1. Normalization
    let messages = Array.isArray(input) ? input : [{ sender: { name: "User" }, content: input }];
    const totalChars = messages.reduce((acc, m) => acc + (m.content || "").length, 0);

    // 2. Strict Input Bound
    if (totalChars > 60000) {
        throw new Error("Input too large (Max 60k characters).");
    }

    // 3. Fallback to TextRank if no API key
    if (!model) return textRankFallback(messages);

    try {
        // Global Timeout Race
        const processPromise = (async () => {
            // 4. Chunking
            let chunks = chunkMessages(messages, 3000);

            // 5. Map Phase (Parallel Extraction)
            const extractionPromises = chunks.map(chunk =>
                limiter(() => withRetry(() => extractSummary(chunk), 0, 60000))
            );

            const results = await Promise.allSettled(extractionPromises);

            // Filter success
            let successfulResults = results
                .filter(r => r.status === 'fulfilled')
                .map(r => r.value)
                .filter(t => t.length > 0);

            if (successfulResults.length === 0) {
                const errors = results.filter(r => r.status === 'rejected').map(r => r.reason.message);
                console.error("All chunks failed. Errors:", errors);
                throw new Error("All extractions failed: " + errors.join(", "));
            }

            // 6. Level 2 Recursive Merge (if needed)
            while (successfulResults.length > 5) {
                const nextLevel = [];
                for (let i = 0; i < successfulResults.length; i += 5) {
                    const batch = successfulResults.slice(i, i + 5);
                    try {
                        const merged = await mergeSummaries(batch);
                        if (merged) nextLevel.push(merged);
                    } catch (e) {
                        console.warn("Merge batch failed:", e.message);
                        // Fallback: manually concat and trim
                        const manualConcat = batch.join("\n").split("\n").filter(l => l.trim().startsWith("-")).slice(0, 8).join("\n");
                        nextLevel.push(manualConcat);
                    }
                }
                successfulResults = nextLevel;
            }

            // 7. Final Integration
            const finalSummary = await mergeSummaries(successfulResults);

            return finalSummary || textRankFallback(input);
        })();

        // Global 60s Timeout
        return await Promise.race([
            processPromise,
            new Promise((_, r) => setTimeout(() => r(new Error("Global Processing Timeout")), 60000))
        ]);

    } catch (error) {
        require('fs').appendFileSync('frontend_debug.log', new Date().toISOString() + " Gemini Aggregation Failed: " + error.message + '\n' + error.stack + '\n\n');
        console.error("Gemini Aggregation Failed:", error.message);
        return textRankFallback(messages);
    }
};

/**
 * Fallback Wrapper
 */
const textRankFallback = (messages) => {
    console.log("Using TextRank Fallback");
    let text = "";
    try {
        text = Array.isArray(messages)
            ? messages.map(m => m.content).join(" ")
            : messages;

        const trStr = textRankSummarize(text, 5); // 5 sentences max
        if (trStr && trStr !== "Summary unavailable.") {
            const lines = trStr.split(". ").filter(l => l.trim().length > 0);
            const bullets = lines.map(l => `- ${l.trim().replace(/\.$/, "")}`);
            return bullets.slice(0, 8).join("\n");
        }
    } catch (e) {
        console.warn("TextRank also failed:", e.message);
    }
    
    // Ultimate Fallback: just return the first few text blobs directly
    if (Array.isArray(messages)) {
        return messages.slice(0, 5).map(m => `- ${m.content || ""}`.trim()).join("\n");
    }
    return `- ${text.substring(0, 100).trim()}...`;
};

module.exports = { summarize };
