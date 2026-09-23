require("dotenv").config();

const mongoose = require("mongoose");
const { randomUUID } = require("crypto");

const { connectMongoDB } = require("../../../src/config/db/mongodb");

const Conversation =
    require("../../../src/models/mongodb/Conversation");

const ConversationMember =
    require("../../../src/models/mongodb/ConversationMember");

const Message =
    require("../../../src/models/mongodb/Message");


const users = {
    gustavo: "11111111-1111-4111-8111-111111111111",
    eduardo: "22222222-2222-4222-8222-222222222222",
    alexandre: "33333333-3333-4333-8333-333333333333",
    mauricio: "44444444-4444-4444-8444-444444444444",
};


function generatePrivateKey(userA, userB) {
    return [userA, userB]
        .sort()
        .join(":");
}


async function seed() {

    try {

        await connectMongoDB();

        console.log("[SEED] Cleaning collections...");

        await Message.deleteMany({});
        await ConversationMember.deleteMany({});
        await Conversation.deleteMany({});


        /*
         * PRIVATE
         */
        console.log("[SEED] Creating private conversation...");

        const privateConversation =
            await Conversation.create({

                type: "PRIVATE",

                created_by: users.gustavo,

                private_key: generatePrivateKey(
                    users.gustavo,
                    users.eduardo
                ),
            });


        await ConversationMember.insertMany([
            {
                conversation_id: privateConversation._id,
                user_id: users.gustavo,
                role: "CREATOR",
                status: "ACTIVE",
            },

            {
                conversation_id: privateConversation._id,
                user_id: users.eduardo,
                role: "MEMBER",
                status: "ACTIVE",
            },
        ]);


        const privateMessage1 =
            await Message.create({

                conversation_id:
                    privateConversation._id,

                sender_id: users.gustavo,

                client_message_id: randomUUID(),

                content:
                    "Olá Eduardo! Esta é uma mensagem de teste.",
            });


        const privateMessage2 =
            await Message.create({

                conversation_id:
                    privateConversation._id,

                sender_id: users.eduardo,

                client_message_id: randomUUID(),

                content:
                    "Olá Gustavo! MongoDB funcionando.",
            });


        await Conversation.findByIdAndUpdate(
            privateConversation._id,
            {
                last_message_id:
                    privateMessage2._id,

                last_message_at:
                    privateMessage2.created_at,
            }
        );


        /*
         * GROUP
         */
        console.log("[SEED] Creating group...");

        const group =
            await Conversation.create({

                type: "GROUP",

                name: "Equipe Corporate Chat",

                created_by: users.gustavo,
            });


        await ConversationMember.insertMany([

            {
                conversation_id: group._id,
                user_id: users.gustavo,
                role: "CREATOR",
                status: "ACTIVE",
            },

            {
                conversation_id: group._id,
                user_id: users.eduardo,
                role: "MEMBER",
                status: "ACTIVE",
            },

            {
                conversation_id: group._id,
                user_id: users.alexandre,
                role: "MEMBER",
                status: "ACTIVE",
            },

            {
                conversation_id: group._id,
                user_id: users.mauricio,
                role: "MEMBER",
                status: "ACTIVE",
            },

        ]);


        const groupMessage =
            await Message.create({

                conversation_id: group._id,

                sender_id: users.gustavo,

                client_message_id: randomUUID(),

                content:
                    "PER-03 MongoDB em desenvolvimento.",
            });


        await Conversation.findByIdAndUpdate(
            group._id,
            {
                last_message_id:
                    groupMessage._id,

                last_message_at:
                    groupMessage.created_at,
            }
        );


        console.log("");
        console.log("================================");
        console.log(" MongoDB seed completed");
        console.log("================================");
        console.log("");

        console.log(
            "PRIVATE:",
            privateConversation._id
        );

        console.log(
            "GROUP:",
            group._id
        );

    } catch (error) {

        console.error("[SEED] Error:");
        console.error(error);

        process.exitCode = 1;

    } finally {

        await mongoose.disconnect();
    }
}


seed();

