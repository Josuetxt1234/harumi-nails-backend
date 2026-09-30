import * as dotenv from 'dotenv';
import * as nodemailer from 'nodemailer';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testEmailConnection(): Promise<void> {
  const enabled = process.env.EMAIL_ENABLED === 'true';
  const host = process.env.EMAIL_HOST;
  const port = parseInt(process.env.EMAIL_PORT ?? '587', 10);
  const secure =
    process.env.EMAIL_SECURE === 'true' || port === 465;
  const user = process.env.EMAIL_USER;
  const password = process.env.EMAIL_PASSWORD;
  const from = process.env.EMAIL_FROM ?? user;
  const testTo = process.env.EMAIL_TEST_TO ?? user;

  console.log('--- Email configuration check ---');
  console.log(`Enabled: ${enabled}`);
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`Secure: ${secure}`);
  console.log(`User: ${user}`);
  console.log(`From: ${from}`);
  console.log(`Test recipient: ${testTo}`);

  if (!enabled) {
    console.error('\nEMAIL_ENABLED is false. Set EMAIL_ENABLED=true in .env');
    process.exit(1);
  }

  if (!host || !user || !password || user.includes('your-email')) {
    console.error(
      '\nMissing or placeholder SMTP credentials. Update .env with your real Gmail and App Password.',
    );
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass: password,
    },
  });

  console.log('\nVerifying SMTP connection...');

  try {
    await transporter.verify();
    console.log('SMTP connection verified successfully.');
  } catch (error) {
    console.error('\nSMTP verification failed:');
    console.error(error);
    process.exit(1);
  }

  console.log('\nSending test email...');

  try {
    const result = await transporter.sendMail({
      from,
      to: testTo,
      subject: 'Harumi Nails - Test Email',
      text: 'This is a test email from Harumi Nails backend. Nodemailer is working correctly.',
      html: '<p>This is a <strong>test email</strong> from Harumi Nails backend.</p><p>Nodemailer is working correctly.</p>',
    });

    console.log('\nTest email sent successfully.');
    console.log(`Message ID: ${result.messageId}`);
    console.log(`Accepted: ${result.accepted.join(', ')}`);
  } catch (error) {
    console.error('\nFailed to send test email:');
    console.error(error);
    process.exit(1);
  }
}

testEmailConnection();
