const {
    sequelize
} = require ("../../config/db/postgres");

const User = 
    require("./User");

const RegistrationRequest = 
    require("./RegistrationRequest");

User.initModel(sequelize);

RegistrationRequest.initModel(
    sequelize
);

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

module.exports = {
    sequelize,
    User,
    RegistrationRequest,
};
