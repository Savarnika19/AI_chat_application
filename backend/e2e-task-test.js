const mongoose = require('mongoose');
const TaskExtractionService = require('./services/taskExtraction/TaskExtractionService');
const Deadline = require('./models/deadlineModel');
const User = require('./models/userModel');
const Chat = require('./models/chatModel');
require('dotenv').config();

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mern-chat');
    
    const dummyUserId = new mongoose.Types.ObjectId();
    const dummyChatId = new mongoose.Types.ObjectId();
    const mockRaviId = new mongoose.Types.ObjectId();
    
    await Chat.deleteOne({ _id: dummyChatId });
    await User.deleteMany({ email: { $in: ['sender@t.com', 'ravi@t.com'] } });
    
    await User.create({ _id: dummyUserId, name: 'SenderProfile', email: 'sender@t.com', password: '123' });
    await User.create({ _id: mockRaviId, name: 'Ravi', email: 'ravi@t.com', password: '123' });
    await Chat.create({ _id: dummyChatId, chatName: 'Test Chat', users: [dummyUserId, mockRaviId], isGroupChat: false });

    const createMsg = (content) => ({ _id: new mongoose.Types.ObjectId(), content, sender: dummyUserId, chat: dummyChatId });

    console.log('--- PART 1: TEST CASES ---');
    const tests = [
        'submit report tomorrow',
        'repu project complete cheyali',
        'we should prepare slides monday',
        'Ravi will review code tomorrow',
        'meeting friday',
        'tommoarow we have presentaion'
    ];
    
    let passCount = 0;
    for(const t of tests) {
        await Deadline.deleteMany({ chat: dummyChatId });
        await TaskExtractionService.extractAndSave(createMsg(t), dummyChatId, dummyUserId);
        await new Promise(r => setTimeout(r, 600)); // wait for save
        const c = await Deadline.countDocuments({ chat: dummyChatId });
        console.log(`[${c > 0 ? 'PASS' : 'FAIL'}] ${t} (${c} tasks)`);
        if (c > 0) {
            passCount++;
            const d = await Deadline.findOne({ chat: dummyChatId });
            console.log(`  -> Title: ${d.title}, Due: ${d.dueAt}`);
        }
    }

    console.log('\n--- PART 1: NEGATIVE TESTS ---');
    const negs = [
        'I am going to college tomorrow',
        'see you tomorrow',
        'hello good morning'
    ];
    let negPass = 0;
    for(const n of negs) {
        await Deadline.deleteMany({ chat: dummyChatId });
        await TaskExtractionService.extractAndSave(createMsg(n), dummyChatId, dummyUserId);
        await new Promise(r => setTimeout(r, 600));
        const c = await Deadline.countDocuments({ chat: dummyChatId });
        console.log(`[${c === 0 ? 'PASS' : 'FAIL'}] ${n} (${c} tasks)`);
        if (c === 0) negPass++;
    }
    
    console.log(`\nResults: Tests Passed: ${passCount}/${tests.length}, Negative Tests Passed: ${negPass}/${negs.length}`);
    mongoose.connection.close();
};
run();
