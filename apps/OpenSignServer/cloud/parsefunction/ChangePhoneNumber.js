import axios from 'axios';
import { cloudServerUrl, serverAppId, appName } from '../../Utils.js';

async function ChangePhoneNumber(request) {
  try {
    const user = request.user;
    if (!user) return 'User not authenticated';

    const currentPassword = request.params.currentPassword;
    const newPhone = request.params.newPhone;
    const otp = parseInt(request.params.otp);

    if (!newPhone) return 'New phone number is required';
    if (!otp) return 'OTP is required';

    const APPID = serverAppId;
    const serverUrl = cloudServerUrl;

    try {
      const loginUrl = `${serverUrl}/login`;
      await axios({
        method: 'POST',
        url: loginUrl,
        headers: { 'X-Parse-Application-Id': APPID },
        data: {
          username: user.get('username'),
          password: currentPassword,
        },
      });
    } catch (err) {
      return 'Current password is incorrect';
    }

    const otpQuery = new Parse.Query('defaultdata_Otp');
    otpQuery.equalTo('UserId', user.id);
    const otpRecord = await otpQuery.first({ useMasterKey: true });

    if (!otpRecord) return 'OTP not found. Please request a new code.';

    const storedOtp = otpRecord.get('OTP');
    if (storedOtp !== otp) return 'Invalid OTP';

    const userQuery = new Parse.Query(Parse.User);
    const userToUpdate = await userQuery.get(user.id, { useMasterKey: true });
    userToUpdate.set('phone', newPhone);
    await userToUpdate.save(null, { useMasterKey: true });

    const extQuery = new Parse.Query('contracts_Users');
    extQuery.equalTo('UserId', { __type: 'Pointer', className: '_User', objectId: user.id });
    const extUser = await extQuery.first({ useMasterKey: true });
    if (extUser) {
      extUser.set('Phone', newPhone);
      await extUser.save(null, { useMasterKey: true });
    }

    await otpRecord.destroy({ useMasterKey: true });

    const userEmail = user.get('email');
    if (userEmail) {
      try {
        await Parse.Cloud.sendEmail({
          recipient: userEmail,
          subject: `Your ${appName} phone number has been changed`,
          text: `Hello,\n\nYour phone number on ${appName} has been changed to ${newPhone}.\n\nIf you did not make this change, please contact your administrator immediately.\n\nThank you,\n${appName} Team`,
        });
      } catch (err) {
        console.log('error sending phone change email', err);
      }
    }

    return 'Phone number updated successfully';
  } catch (err) {
    console.log('err in ChangePhoneNumber', err);
    return 'Failed to update phone number';
  }
}

export default ChangePhoneNumber;
