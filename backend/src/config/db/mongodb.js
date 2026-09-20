const mongoose = require('mongoose');

async function connectMongoDB() {
    try {
        const username = encodeURIComponent(process.env.MONGO_USER);
        const password = encodeURIComponent(process.env.MONGO_PASSWORD);

        const mongoUri =
            `mongodb://${username}:${password}` +
            `@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}` +
            `/${process.env.MONGO_DB}?authSource=admin`;

        await mongoose.connect(mongoUri);

        console.log('[MONGODB] Connection established successfully.');
    } catch (error) {
        console.error('[MONGODB] Connection failed:');
        console.error(error.message);

        throw error;
    }
}

module.exports = {
    connectMongoDB,
};