export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  salonTimezone: process.env.SALON_TIMEZONE ?? 'America/Guayaquil',
});
