const USER_ROOM_PREFIX =
    "user:";


function getUserRoom(
    userId
) {
    return (
        `${USER_ROOM_PREFIX}${userId}`
    );
}


function getUserRooms(
    userIds
) {
    return [
        ...new Set(
            userIds
                .filter(
                    userId =>
                        typeof userId ===
                            "string" &&
                        userId.length > 0
                )
                .map(
                    getUserRoom
                )
        ),
    ];
}


module.exports = {
    USER_ROOM_PREFIX,
    getUserRoom,
    getUserRooms,
};