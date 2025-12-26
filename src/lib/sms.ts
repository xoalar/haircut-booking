const smsEnabled = process.env.SEND_CUSTOMER_SMS === "true";

export function sendSMS(to: string, body: string) {
  if (!smsEnabled) {
    console.log("SMS disabled, skipping send");
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.warn("Twilio env vars missing, SMS skipped");
    return;
  }

  const twilio = require("twilio");
  const client = twilio(accountSid, authToken);

  return client.messages.create({
    from,
    to,
    body,
  });
}
