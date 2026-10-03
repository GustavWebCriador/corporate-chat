const {
    DataTypes,
    Model
} = require("sequelize");

class User extends Model {
    static initModel(sequelize) {
        User.init(
            {
                user_id: {
                    type: DataTypes.UUID,
                    primaryKey: true,
                    defaultValue: DataTypes.UUIDV4,
                },

                name: {
                    type: DataTypes.STRING(150),
                    allowNull: false,
                },

                email: {
                    type: DataTypes.STRING(50),
                    allowNull: false,
                    unique: true,
                },

                password_hash: {
                    type: DataTypes.STRING(255),
                    allowNull: false,
                },

                status: {
                    type: DataTypes.STRING(20),
                    allowNull: false,

                    validate: {
                        isIn: [
                            [
                                "ACTIVE",
                                "INACTIVE",
                            ],
                        ],
                    },
                },

                is_admin: {
                    type: DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },

                created_at: {
                    type: DataTypes.DATE,
                    allowNull: false,
                },

                updated_at: {
                    type: DataTypes.DATE,
                    allowNull: false,
                },

                last_login_at: {
                    type: DataTypes.DATE,
                    allowNull: true,
                },
            },
            {
                sequelize,
                modelName: "User",
                tableName: "users",
                timestamps: true,

                createdAt: "created_at",
                updatedAt: "updated_at",
            }
        );

        return User;
    }
}

module.exports = User;