const users = {

    gustavo: {
        user_id:
            "11111111-1111-4111-8111-111111111111",

        name:
            "Gustavo Medeiros",

        email:
            "gustavo@corporatechat.local",

        is_admin:
            true,
    },

    eduardo: {
        user_id:
            "22222222-2222-4222-8222-222222222222",

        name:
            "Eduardo",

        email:
            "eduardo@corporatechat.local",

        is_admin:
            false,
    },

    alexandre: {
        user_id:
            "33333333-3333-4333-8333-333333333333",

        name:
            "Alexandre",

        email:
            "alexandre@corporatechat.local",

        is_admin:
            false,
    },

    mauricio: {
        user_id:
            "44444444-4444-4444-8444-444444444444",

        name:
            "Mauricio",

        email:
            "mauricio@corporatechat.local",

        is_admin:
            false,
    },
};


const registrationRequests = {

    pending: {
        request_id:
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",

        name:
            "Usuário Pendente",

        email:
            "pendente@corporatechat.local",
    },

    rejected: {
        request_id:
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",

        name:
            "Usuário Rejeitado",

        email:
            "rejeitado@corporatechat.local",
    },

    approved: {
        request_id:
            "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    },
};


const mongoIds = {

    conversations: {

        private:
            "66f000000000000000000001",

        group:
            "66f000000000000000000002",
    },

    messages: {

        private1:
            "66f000000000000000000101",

        private2:
            "66f000000000000000000102",

        group1:
            "66f000000000000000000201",

        group2:
            "66f000000000000000000202",

        group3:
            "66f000000000000000000203",
    },
};


const clientMessageIds = {

    private1:
        "90000000-0000-4000-8000-000000000001",

    private2:
        "90000000-0000-4000-8000-000000000002",

    group1:
        "90000000-0000-4000-8000-000000000003",

    group2:
        "90000000-0000-4000-8000-000000000004",

    group3:
        "90000000-0000-4000-8000-000000000005",
};


function generatePrivateKey(
    userA,
    userB
) {

    return [
        userA,
        userB,
    ]
        .sort()
        .join(":");
}


module.exports = {
    users,
    registrationRequests,
    mongoIds,
    clientMessageIds,
    generatePrivateKey,
};