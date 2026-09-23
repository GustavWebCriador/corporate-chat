require("dotenv").config();

const mongoose = require("mongoose");

const { connectMongoDB } = require("../../src/config/db/mongodb");

const Conversation = 
    require("../../src/models/mongodb/Conversation");
const ConversationMember= 
    require('../../src/models/mongodb/ConversationMember');
const Message = 
    require('../../src/models/mongodb/Message');

async function syncIndexes() {
    try {
        console.log("[MONGODB] Connecting...");

        await connectMongoDB();

        console.log("[MONGODB] Synchronizing indexes...");

        await Conversation.syncIndexes();
        await ConversationMember.syncIndexes();
        await Message.syncIndexes();

        console.log("[MONGODB] Indexes synchronized successfully.");

    } catch (error) {

        console.error(
            "[MONGODB] Index synchronization failed:"
        );

        console.error(error);

        process.exitCode = 1;

    } finally {

        await mongoose.disconnect();

        console.log("[MONGODB] Connection closed.");
    }
}

syncIndexes();