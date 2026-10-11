
const { DataTypes, Model } = require("sequelize");

class AuthSession extends Model {
    static initModel(sequelize) {
        AuthSession.init(
            {
                session_id: {
                    type: DataTypes.UUID,
                    primaryKey: true,
                    allowNull: false,
                },

                user_id: {
                    type: DataTypes.UUID,
                    allowNull: false,
                },

                expires_at: {
                    type: DataTypes.DATE,
                    allowNull: false,
                },

                revoked_at: {
                    type: DataTypes.DATE,
                    allowNull: true,
                },

                created_at: {
                    type: DataTypes.DATE,
                    allowNull: false,
                    defaultValue: DataTypes.NOW,
                },
            },
            {
                sequelize,
                modelName: "AuthSession",
                tableName: "auth_sessions",
                timestamps: false,
            }
        );

        return AuthSession;
    }
}

module.exports = AuthSession;
