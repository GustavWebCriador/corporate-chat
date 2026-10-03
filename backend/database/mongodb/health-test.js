require("dotenv").config();

const mongoose = require("mongoose");

const connectMongoDB =
    require("../../src/config/db/mongodb").connectMongoDB;


async function healthTest() {

    try {

        console.log("");
        console.log("======================================");
        console.log(" MongoDB Health Test");
        console.log("======================================");


        await connectMongoDB();


        const ping =
            await mongoose.connection.db
                .admin()
                .ping();


        if (ping.ok !== 1) {

            throw new Error(
                "MongoDB ping failed."
            );
        }


        console.log(
            "[MONGODB] Connection: OK"
        );


        const collections =
            await mongoose.connection.db
                .listCollections()
                .toArray();


        const names =
            collections.map(
                collection => collection.name
            );


        const expected = [
            "conversations",
            "conversation_members",
            "messages",
        ];


        for (
            const collection of expected
        ) {

            if (
                !names.includes(collection)
            ) {

                throw new Error(
                    `Collection ${collection} não encontrada.`
                );
            }


            console.log(
                `[MONGODB] ${collection}: OK`
            );
        }


        console.log("");
        console.log(
            "MongoDB environment: OK"
        );

    } catch (error) {

        console.error("");
        console.error(
            "MongoDB environment: FAILED"
        );

        console.error(
            error.message
        );

        process.exitCode = 1;

    } finally {

        await mongoose.disconnect();
    }
}


healthTest();