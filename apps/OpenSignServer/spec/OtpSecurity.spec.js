import AuthLoginAsMail from '../cloud/parsefunction/AuthLoginAsMail.js';
import sendMailOTPv1 from '../cloud/parsefunction/SendMailOTPv1.js';

const uniqEmail = () => `otp_${Date.now()}_${Math.floor(Math.random() * 100000)}@example.com`;

async function seedOtp({ email, otp, attempts = 0, used = false, generatedAt = new Date() }) {
  const OtpClass = Parse.Object.extend('defaultdata_Otp');
  const rec = new OtpClass();
  rec.set('Email', email);
  rec.set('OTP', otp);
  rec.set('Attempts', attempts);
  rec.set('Used', used);
  rec.set('GeneratedAt', generatedAt);
  await rec.save(null, { useMasterKey: true });
  return rec;
}

async function getOtpRecord(email) {
  const q = new Parse.Query('defaultdata_Otp');
  q.equalTo('Email', email);
  return q.first({ useMasterKey: true });
}

describe('OTP security — AuthLoginAsMail guards', () => {
  it('rejects a wrong OTP and increments the attempt counter', async () => {
    const email = uniqEmail();
    await seedOtp({ email, otp: 12345678 });

    const out = await AuthLoginAsMail({ params: { email, otp: '00000000' }, headers: {} });
    expect(out).toBe('Invalid Otp');

    const rec = await getOtpRecord(email);
    expect(rec.get('Attempts')).toBe(1);
  });

  it('locks out after the maximum number of attempts (even with the correct code)', async () => {
    const email = uniqEmail();
    await seedOtp({ email, otp: 12345678, attempts: 5 });

    const out = await AuthLoginAsMail({ params: { email, otp: '12345678' }, headers: {} });
    expect(out).toBe('Too many attempts');
  });

  it('rejects an expired OTP', async () => {
    const email = uniqEmail();
    const old = new Date(Date.now() - 11 * 60 * 1000);
    await seedOtp({ email, otp: 12345678, generatedAt: old });

    const out = await AuthLoginAsMail({ params: { email, otp: '12345678' }, headers: {} });
    expect(out).toBe('Otp expired');
  });

  it('rejects an already-used OTP', async () => {
    const email = uniqEmail();
    await seedOtp({ email, otp: 12345678, used: true });

    const out = await AuthLoginAsMail({ params: { email, otp: '12345678' }, headers: {} });
    expect(out).toBe('Otp expired');
  });
});

describe('OTP security — generation', () => {
  it('SendMailOTPv1 generates an 8-digit code and resets the guard fields', async () => {
    const email = uniqEmail();
    const out = await sendMailOTPv1({ params: { email }, headers: {} });
    expect(out).toBe('Otp send');

    const rec = await getOtpRecord(email);
    expect(rec).toBeDefined();
    const code = rec.get('OTP');
    expect(code).toBeGreaterThanOrEqual(10000000);
    expect(code).toBeLessThanOrEqual(99999999);
    expect(rec.get('Attempts')).toBe(0);
    expect(rec.get('Used')).toBe(false);
    expect(rec.get('GeneratedAt')).toBeDefined();
  });
});
