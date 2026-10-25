const USER_ROOM_PREFIX =
    "user:";


function getUserRoom(
    userId
) {
    return (
        `${USER_ROOM_PREFIX}${userId}`
    );
}


module.exports = {
    USER_ROOM_PREFIX,
    getUserRoom,
};