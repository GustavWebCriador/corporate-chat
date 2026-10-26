const REALTIME_EVENTS =
    Object.freeze({

        READY:
            "realtime:ready",
            
        SYNC:
            "realtime:sync",

        MESSAGE_SEND:
            "message:send",

        MESSAGE_NEW:
            "message:new",

        MESSAGE_DELIVERED:
            "message:delivered",

        MESSAGE_DELIVERY_UPDATE:
            "message:delivery:update",

        MESSAGE_READ:
            "message:read",

        MESSAGE_READ_UPDATE:
            "message:read:update",
    });


module.exports = {
    REALTIME_EVENTS,
};