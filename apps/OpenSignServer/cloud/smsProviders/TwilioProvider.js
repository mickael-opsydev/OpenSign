import SMSProvider from './SMSProvider.js';

class TwilioProvider extends SMSProvider {
  constructor() {
    super();
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      console.warn('TwilioProvider: missing environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)');
    }
  }

  async sendSMS(phone, message) {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      throw new Error('Twilio is not configured. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.');
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const auth = btoa(`${this.accountSid}:${this.authToken}`);
    const body = new URLSearchParams({
      To: phone,
      From: this.fromNumber,
      Body: message,
    });
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(`Twilio error: ${data.message || response.statusText}`);
      }
      return data;
    } catch (err) {
      console.error('TwilioProvider.sendSMS error:', err);
      throw err;
    }
  }
}

export default TwilioProvider;
