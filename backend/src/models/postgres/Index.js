const {
    sequelize
} = require ("../../config/db/postgres");

const User = 
    require("./User");

const RegistrationRequest = 
    require("./RegistrationRequest");
    
const AuthSession = 
    require("./AuthSession");

User.initModel(sequelize);

RegistrationRequest.initModel(
    sequelize
);

AuthSession.initModel(sequelize);

RegistrationRequest.belongsTo( 
    User,
    {
        as: "reviewer",
        foreignKey: "reviewed_by"
    }
);

RegistrationRequest.belongsTo(
    User,
    {
        as: "createdUser",
        foreignKey: "created_user_id"
    }
);
AuthSession.belongsTo(User, {
    as: "user",
    foreignKey: "user_id",
});

User.hasMany(AuthSession, {
    as: "sessions",
    foreignKey: "user_id",
});


module.exports = {
    sequelize,
    User,
    RegistrationRequest,
    AuthSession
};
