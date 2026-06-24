import { appName, smsProvider } from '../../Utils.js';

const RATE_LIMIT_SECONDS = 60;
const devMode = process.env.NODE_ENV !== 'production';

async function sendSMSOTP(request) {
  try {
    const phone = request.params.phone;
    const TenantId = request.params.TenantId || undefined;
    const AppName = appName;

    if (!phone) {
      return 'Please enter a valid phone number';
    }

    if (!smsProvider) {
      console.log('SMS provider not configured');
      return 'SMS service is not configured';
    }

    const existingOtpQuery = new Parse.Query('defaultdata_Otp');
    existingOtpQuery.equalTo('Phone', phone);
    const existingOtp = await existingOtpQuery.first({ useMasterKey: true });

    if (existingOtp) {
      const lastUpdate = existingOtp.updatedAt || existingOtp.createdAt;
      const elapsed = (Date.now() - lastUpdate.getTime()) / 1000;
      if (elapsed < RATE_LIMIT_SECONDS) {
        const waitTime = Math.ceil(RATE_LIMIT_SECONDS - elapsed);
        return `Too many requests. Please wait ${waitTime} seconds.`;
      }
    }

    const code = Math.floor(10000000 + Math.random() * 90000000);
    const message = `Your ${AppName} verification code is: ${code}`;

    const userId = request.user ? request.user.id : null;

    if (existingOtp) {
      existingOtp.set('OTP', code);
      existingOtp.set('Phone', phone);
      existingOtp.set('GeneratedAt', new Date());
      existingOtp.set('Attempts', 0);
      existingOtp.set('Used', false);
      if (userId) existingOtp.set('UserId', userId);
      await existingOtp.save(null, { useMasterKey: true });
    } else {
      const otpClass = Parse.Object.extend('defaultdata_Otp');
      const newOtp = new otpClass();
      newOtp.set('OTP', code);
      newOtp.set('Phone', phone);
      newOtp.set('TenantId', TenantId);
      newOtp.set('GeneratedAt', new Date());
      newOtp.set('Attempts', 0);
      newOtp.set('Used', false);
      if (userId) newOtp.set('UserId', userId);
      await newOtp.save(null, { useMasterKey: true });
    }

    try {
      await smsProvider.sendSMS(phone, message);
      if (devMode) console.log('Dev mode — SMS OTP', code, 'for', phone);
    } catch (err) {
      if (devMode) console.log('Dev mode — SMS OTP', code, 'for', phone);
    }
    return 'Otp send';
  } catch (err) {
    console.log('err in sendSMSOTP');
    console.log(err);
    return err;
  }
}
export default sendSMSOTP;
