import axios from 'axios';
import { cloudServerUrl, serverAppId } from '../../Utils.js';
async function AuthLoginAsMail(request) {
  try {
    const serverUrl = cloudServerUrl;
    const APPID = serverAppId;
    const masterKEY = process.env.MASTER_KEY;

    const otpN = request.params.otp;
    const otp = parseInt(otpN);
    const email = request.params.email;
    const phone = request.params.phone;

    const checkOtp = new Parse.Query('defaultdata_Otp');
    if (email) {
      checkOtp.equalTo('Email', email);
    } else if (phone) {
      checkOtp.equalTo('Phone', phone);
    } else {
      return 'Email or phone is required';
    }
    const res = await checkOtp.first({ useMasterKey: true });

    if (res !== undefined) {
      const resOtp = res.get('OTP');

      if (resOtp === otp) {
        try {
          const result = await getToken();
          if (email && !result?.emailVerified) {
            const userQuery = new Parse.Query(Parse.User);
            const user = await userQuery.get(result?.objectId, {
              sessionToken: result.sessionToken,
            });
            user.set('emailVerified', true);
            const saveRes = await user.save(null, { useMasterKey: true });
            if (saveRes) {
              return result;
            } else {
              return 'user not found!';
            }
          }
          return result;
        } catch (err) {
          return 'user not found!';
        }

        async function getToken() {
          const query = new Parse.Query(Parse.User);
          if (email) {
            query.equalTo('email', email);
          } else if (phone) {
            query.equalTo('phone', phone);
          }
          let user = await query.first({ useMasterKey: true });

          if (!user && phone) {
            user = await createPhoneUser(phone);
          }

          if (!user) {
            throw new Error('user not found');
          }

          const url = `${serverUrl}/loginAs`;
          const loginRes = await axios({
            method: 'POST',
            url: url,
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json;charset=utf-8',
              'X-Parse-Application-Id': APPID,
              'X-Parse-Master-Key': masterKEY,
            },
            params: {
              userId: user.id,
            },
          });

          if (!loginRes.data || !loginRes.data.sessionToken) {
            throw new Error('user not found');
          }

          return loginRes.data;
        }

        async function createPhoneUser(phone) {
          const username = `phone_${phone.replace(/[^+\d]/g, '')}`;
          const existingQuery = new Parse.Query(Parse.User);
          existingQuery.equalTo('username', username);
          const existing = await existingQuery.first({ useMasterKey: true });
          if (existing) return existing;
          const user = new Parse.User();
          user.set('username', username);
          user.set('phone', phone);
          user.set('password', Math.random().toString(36).slice(2));
          const saved = await user.signUp(null, { useMasterKey: true });
          try {
            const extUser = new Parse.Object('contracts_Users');
            extUser.set('UserId', saved);
            extUser.set('Email', phone);
            extUser.set('Name', username);
            extUser.set('Phone', phone);
            const acl = new Parse.ACL();
            acl.setPublicReadAccess(true);
            acl.setPublicWriteAccess(true);
            extUser.setACL(acl);
            await extUser.save(null, { useMasterKey: true });
          } catch (err) {
            console.log('err creating contracts_Users for phone user', err);
          }
          return saved;
        }
      } else {
        return 'Invalid Otp';
      }
    } else {
      return 'user not found!';
    }
  } catch (err) {
    console.log('err in Auth');
    console.log(err);
    return 'Result not found';
  }
}
export default AuthLoginAsMail;
