const {
    DataTypes,
    Model
} = require("sequelize");

class RegistrationRequest extends Model {
    static initModel(sequelize) {
        RegistrationRequest.init(
            {
                request_id: {
                    type: DataTypes.UUID,
                    primaryKey: true,
                    defaultValue:
                        DataTypes.UUIDV4,
                },

                name: {
                    type: DataTypes.STRING(150),
                    allowNull: false,
                },

                email: {
                    type: DataTypes.STRING(50),
                    allowNull: false,
                },

                status: {
                    type: DataTypes.STRING(20),
                    allowNull: false,
                    defaultValue: "PENDING",

                    validate: {
                        isIn: [
                            [
                                "PENDING",
                                "APPROVED",
                                "REJECTED",
                            ],
                        ],
                    },
                },

                requested_at: {
                    type: DataTypes.DATE,
                    allowNull: false,
                },

                reviewed_at: {
                    type: DataTypes.DATE,
                    allowNull: true,
                },

                reviewed_by: {
                    type: DataTypes.UUID,
                    allowNull: true,
                },

                rejection_reason: {
                    type: DataTypes.STRING(500),
                    allowNull: true,
                },

                created_user_id: {
                    type: DataTypes.UUID,
                    allowNull: true,
                },
            },

            {
                sequelize,

                modelName:
                    "RegistrationRequest",

                tableName:
                    "registration_requests",

                timestamps: false,
            }
        );

        return RegistrationRequest;
    }
}


module.exports = RegistrationRequest;