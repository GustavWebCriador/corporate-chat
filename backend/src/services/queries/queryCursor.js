const {
    PersistenceIntegrationError
} = require(
    "../integration/userIdentityService"
);


function normalizeLimit(
    value,
    defaultValue = 50,
    maxValue = 100
) {

    const parsed =
        Number(value);


    if (
        !Number.isInteger(parsed) ||
        parsed <= 0
    ) {

        return defaultValue;
    }


    return Math.min(
        parsed,
        maxValue
    );
}


function encodeCursor(
    {
        timestamp,
        id,
    }
) {

    const payload = {

        timestamp:
            new Date(
                timestamp
            ).toISOString(),

        id:
            id.toString(),
    };


    return Buffer
        .from(
            JSON.stringify(
                payload
            )
        )
        .toString(
            "base64url"
        );
}


function decodeCursor(
    cursor
) {

    if (!cursor) {

        return null;
    }


    try {

        const payload =
            JSON.parse(

                Buffer
                    .from(
                        cursor,
                        "base64url"
                    )
                    .toString(
                        "utf8"
                    )
            );


        if (
            !payload.timestamp ||
            !payload.id
        ) {

            throw new Error(
                "Cursor incompleto."
            );
        }


        const timestamp =
            new Date(
                payload.timestamp
            );


        if (
            Number.isNaN(
                timestamp.getTime()
            )
        ) {

            throw new Error(
                "Data inválida."
            );
        }


        return {

            timestamp,

            id:
                payload.id,
        };


    } catch (error) {

        throw new PersistenceIntegrationError(

            "INVALID_QUERY_CURSOR",

            "Cursor de paginação inválido."
        );
    }
}


module.exports = {

    normalizeLimit,
    encodeCursor,
    decodeCursor,
};