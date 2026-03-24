require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function checkApiKey() {
  console.log("-----------------------------------------");
  console.log("Checking API Key setup...");
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.log("❌ ERROR: GEMINI_API_KEY is completely missing from process.env!");
    return;
  }
  
  console.log("✅ GEMINI_API_KEY is present in process.env.");
  console.log(`Key snippet: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`);

  console.log("\nAttempting to initialize the 'gemini-flash-latest' model...");
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    
    console.log("✅ Model initialized successfully.");
    console.log("\nSending a test prompt: 'Hi, are you working?'...");
    
    const result = await model.generateContent("Hi, are you working? Please reply with a short yes.");
    const text = result.response.text();
    
    console.log("✅ Response received successfully from Gemini API!");
    console.log("Response Text:", text.trim());
    console.log("-----------------------------------------");
    console.log("\nCONCLUSION: The Gemini API Key IS VALID and 100% WORKING.");
  } catch (err) {
    console.log("❌ ERROR during Gemini call:");
    console.log(err.message);
  }
}

checkApiKey();
