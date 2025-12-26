import twilio from "twilio";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} env var`);
  return v;
}

const client = twilio(mustEnv("TWILIO_ACCOUNT_SID"), mustEnv("TWILIO_AUTH_TOKEN"));

export async function sendSms(to: string, body: string) {
  const from = mustEnv("TWILIO_FROM_NUMBER");
  return client.messages.create({ to, from, body });
}
