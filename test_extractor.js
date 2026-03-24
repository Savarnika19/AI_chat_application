const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://localhost:5000/api';
let token = '';
let chatId = '';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const tests = {
  part1: [
    { msg: "Submit the report tomorrow at 5pm", type: "English" },
    { msg: "Finish backend work by Friday evening", type: "English" },
    { msg: "Prepare slides and deploy code Monday", type: "English" },
    { msg: "repu project submit cheyali", type: "Telugu" },
    { msg: "ellundi morning meeting undi", type: "Telugu" },
    { msg: "ivala report complete cheyyali", type: "Telugu" },
    { msg: "repu submit cheyali report", type: "Mixed" },
    { msg: "project ellundi complete cheyali and deploy Friday", type: "Mixed" },
    { msg: "Ravi will complete task repu evening", type: "Mixed" },
    { msg: "submit report tomorrow and deploy backend friday", type: "Multi-task" },
    { msg: "prepare slides monday mariyu meeting ellundi morning", type: "Multi-task" },
    { msg: "finish UI today and Ravi will test tomorrow", type: "Multi-task" },
    { msg: "Ravi will submit report tomorrow", type: "Responsibility" },
    { msg: "I will complete this by Friday", type: "Responsibility" },
    { msg: "@Sahithi finish this by tomorrow", type: "Responsibility" },
    { msg: "meeting friday", type: "Edge" },
    { msg: "see you tomorrow", type: "Edge" },
    { msg: "submit asap", type: "Edge" },
    { msg: "complete this soon", type: "Edge" },
    { msg: "random message without task", type: "Edge" }
  ],
  part3: [
    "repu project submit cheyali",
    "Ravi will review code tomorrow",
    "We spent 1500 on dinner",
    "meeting ellundi morning",
    "prepare slides friday",
    "I paid 500 for snacks",
    "deploy backend monday"
  ],
  part4: {
    onlyTelugu: ["repu testing cheyali", "ellundi project ivvali"],
    onlyEnglish: ["review code today", "push to prod tomorrow"],
    mixedLong: ["we need to finish this soon, repu chusdam kudurte friday lopu test chedam. anyway deploy monday confirm"],
    noTask: ["hi how are you", "what did you have for dinner", "ok cool"]
  },
  part5: [
    "k",
    "ok",
    "yes",
    "I will do it", // no date
    "let's plan something", // ambiguous
    "maybe next week" // ambiguous
  ]
};

async function login() {
  console.log("Logging in...");
  const res = await axios.post(`${API_URL}/user/login`, {
    email: 'savarnikajalla@gmail.com',
    password: 'jalla@2005'
  });
  token = res.data.token;
  console.log("Logged in successfully. User ID:", res.data._id);
  return res.data;
}

async function searchUsers(names) {
  let users = [];
  for (const name of names) {
    try {
      const res = await axios.get(`${API_URL}/user?search=${name}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.length > 0) {
        users.push(res.data[0]._id);
      }
    } catch(e) { console.error("Error searching", name); }
  }
  // If not enough users, just grab some random ones
  if (users.length < 2) {
    const backupRes = await axios.get(`${API_URL}/user?search=a`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const moreUsers = backupRes.data.map(u => u._id).filter(id => !users.includes(id));
    users = [...users, ...moreUsers].slice(0, 2);
  }
  return users;
}

async function createGroup(userIds) {
  console.log("Creating Test Group...");
  const res = await axios.post(`${API_URL}/chat/group`, {
    name: "Extractor Test Group " + Date.now(),
    users: JSON.stringify(userIds)
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  chatId = res.data._id;
  console.log("Created Group Chat with ID:", chatId);
}

async function sendMessage(content) {
  const res = await axios.post(`${API_URL}/message`, {
    content,
    chatId
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
}

const mongoose = require('mongoose');
const Deadline = require('./backend/models/deadlineModel');
require('./backend/models/userModel');
require('dotenv').config({ path: "backend/.env" });

async function getDeadlines() {
  if (mongoose.connection.readyState === 0) {
    let uri = process.env.MONGO_URI || "";
    if (uri && uri.includes("mongodb.net/?")) {
      uri = uri.replace("mongodb.net/?", "mongodb.net/test?");
    }
    await mongoose.connect(uri);
  }
  const deadlines = await Deadline.find({ chat: chatId });
  return deadlines;
}

async function summarizeChat(messageIds = []) {
  const payload = messageIds.length ? { messageIds } : { chatId };
  while (true) {
    try {
      const res = await axios.post(`${API_URL}/message/summarize`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    } catch (err) {
      if (err.response && err.response.status === 429) {
        console.log("Got 429 Rate Limit, retrying in 30s...");
        await delay(30000);
      } else {
        throw err;
      }
    }
  }
}

async function runTests() {
  const report = {};
  
  try {
    const me = await login();
    const otherUsers = await searchUsers(['Ravi', 'Sahithi']);
    await createGroup(otherUsers);

    console.log("\n================ PART 1 & 5: TASK EXTRACTION ==============");
    report.extraction = [];
    
    const allExtractedTests = [...tests.part1, ...tests.part5.map(msg => ({msg, type: "FailureTest"}))];

    for (const test of allExtractedTests) {
      console.log(`Sending (${test.type}): "${test.msg}"`);
      const sent = await sendMessage(test.msg);
      await delay(2000); // give time for background extraction/DB save
      
      const deadlines = await getDeadlines();
      // Find deadlines belonging to this specific message ID
      const extracted = deadlines.filter(d => d.message && d.message.toString() === sent._id.toString());
      
      console.log(` -> Extracted ${extracted.length} deadlines`);
      extracted.forEach(d => {
        console.log(`    * Title: ${d.title}`);
        console.log(`    * Due At: ${d.dueAt}`);
        console.log(`    * Assigned To: ${d.assignedTo && d.assignedTo.length ? d.assignedTo.join(', ') : 'None'}`);
      });
      
      report.extraction.push({
        message: test.msg,
        type: test.type,
        extracted: extracted
      });
    }

    console.log("\n================ PART 3: SUMMARIZATION ==============");
    report.summarization = {};
    const p3MsgIds = [];
    for (const msg of tests.part3) {
      const sent = await sendMessage(msg);
      p3MsgIds.push(sent._id);
      await delay(300);
    }
    await delay(61000);
    console.log("Generating summary for Part 3...");
    const sum3 = await summarizeChat(p3MsgIds);
    console.log("Summary Output:\n", sum3.summary);
    report.summarization.part3 = sum3.summary;

    console.log("\n================ PART 4: EDGE CASE SUMMARIZATION ==============");
    for (const [key, msgs] of Object.entries(tests.part4)) {
      console.log(`\nTesting ${key} summarization...`);
      const msgIds = [];
      for (const msg of msgs) {
        const sent = await sendMessage(msg);
        msgIds.push(sent._id);
        await delay(300);
      }
      console.log("Waiting 61s for summarization rate limits...");
      await delay(61000); // Strict wait for backend rate limiter
      const sumEdge = await summarizeChat(msgIds);
      console.log(`Summary Output (${key}):\n`, sumEdge.summary);
      report.summarization[key] = sumEdge.summary;
    }

    // Write report to file
    fs.writeFileSync('test_report.json', JSON.stringify(report, null, 2));
    console.log("\nTests complete. Results saved to test_report.json");

  } catch (err) {
    fs.writeFileSync('error.json', JSON.stringify({
      message: err.message,
      data: err.response ? err.response.data : null,
      stack: err.stack
    }, null, 2));
    console.error("Test execution failed, error written to error.json");
  }
}

runTests();
