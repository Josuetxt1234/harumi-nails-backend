export default () => ({
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshRememberExpiresIn:
      process.env.JWT_REFRESH_REMEMBER_EXPIRES_IN ?? '30d',
    refreshSessionExpiresIn:
      process.env.JWT_REFRESH_SESSION_EXPIRES_IN ?? '1d',
  },
});
