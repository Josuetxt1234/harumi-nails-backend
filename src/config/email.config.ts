export default () => ({
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    from: process.env.EMAIL_FROM ?? 'noreply@haruminails.com',
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT ?? '587', 10),
    secure:
      process.env.EMAIL_SECURE === 'true' ||
      parseInt(process.env.EMAIL_PORT ?? '587', 10) === 465,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
  },
});
