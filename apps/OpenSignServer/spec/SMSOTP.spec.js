import SMSProvider from '../cloud/smsProviders/SMSProvider.js';
import TwilioProvider from '../cloud/smsProviders/TwilioProvider.js';

describe('SMSProvider abstraction', () => {
  it('should throw when sendSMS is called directly', async () => {
    const provider = new SMSProvider();
    await expectAsync(provider.sendSMS('+1234567890', 'test')).toBeRejectedWithError(
      'sendSMS() must be implemented by subclass'
    );
  });
});

describe('TwilioProvider', () => {
  beforeEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
  });

  it('should warn on construction when env vars are missing', () => {
    const warnSpy = spyOn(console, 'warn');
    const provider = new TwilioProvider();
    expect(provider.accountSid).toBeUndefined();
    expect(provider.authToken).toBeUndefined();
    expect(provider.fromNumber).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      'TwilioProvider: missing environment variables (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)'
    );
  });

  it('should throw on sendSMS when not configured', async () => {
    const provider = new TwilioProvider();
    await expectAsync(
      provider.sendSMS('+1234567890', 'Your OTP is 1234')
    ).toBeRejectedWithError(
      'Twilio is not configured. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.'
    );
  });

  it('should construct with env vars set', () => {
    process.env.TWILIO_ACCOUNT_SID = 'test_sid';
    process.env.TWILIO_AUTH_TOKEN = 'test_token';
    process.env.TWILIO_PHONE_NUMBER = '+15551234567';
    const provider = new TwilioProvider();
    expect(provider.accountSid).toBe('test_sid');
    expect(provider.authToken).toBe('test_token');
    expect(provider.fromNumber).toBe('+15551234567');
  });
});

describe('SMS Provider initialization in Utils', () => {
  it('should have smsProvider matching the SMS_PROVIDER env var', async () => {
    const Utils = await import('../Utils.js');
    if (process.env.SMS_PROVIDER && process.env.SMS_PROVIDER.toLowerCase() === 'twilio') {
      expect(Utils.smsProvider).not.toBeNull();
      expect(Utils.smsProvider.constructor.name).toBe('TwilioProvider');
    } else {
      expect(Utils.smsProvider).toBeNull();
    }
  });
});
