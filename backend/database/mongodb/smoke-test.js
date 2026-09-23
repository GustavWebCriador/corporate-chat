require("dotenv").config();

const mongoose = require("mongoose");

const { connectMongoDB } = require("../../src/config/db/mongodb");

const Conversation =
    require("../../src/models/mongodb/Conversation");

const ConversationMember =
    require("../../src/models/mongodb/ConversationMember");

const Message =
    require("../../src/models/mongodb/Message");


async function smokeTest() {

    try {

        await connectMongoDB();

        console.log("");
        console.log("MongoDB Smoke Test");
        console.log("==============================");

        const conversations =
            await Conversation.countDocuments();

        const members =
            await ConversationMember.countDocuments();

        const messages =
            await Message.countDocuments();


        console.log(
            `Conversations: ${conversations}`
        );

        console.log(
            `Members: ${members}`
        );

        console.log(
            `Messages: ${messages}`
        );


        const privateConversation =
            await Conversation.findOne({
                type: "PRIVATE",
            });


        if (!privateConversation) {
            throw new Error(
                "PRIVATE conversation not found."
            );
        }


        const latestMessages =
            await Message.find({
                conversation_id:
                    privateConversation._id,
            })
                .sort({
                    created_at: -1,
                    _id: -1,
                })
                .limit(50);


        console.log("");
        console.log(
            `History loaded: ${latestMessages.length}`
        );


        latestMessages.forEach(
            (message) => {

                console.log(
                    `- ${message.content}`
                );
            }
        );


        console.log("");
        console.log("==============================");
        console.log("MongoDB PER-03: OK");
        console.log("==============================");

    } catch (error) {

        console.error("");
        console.error("MongoDB PER-03: FAILED");
        console.error(error);

        process.exitCode = 1;

    } finally {

        await mongoose.disconnect();
    }
}


smokeTest();