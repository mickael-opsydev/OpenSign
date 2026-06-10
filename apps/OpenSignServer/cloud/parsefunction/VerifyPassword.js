import axios from 'axios';
import { cloudServerUrl, serverAppId } from '../../Utils.js';

async function VerifyPassword(request) {
  try {
    const user = request.user;
    if (!user) return 'User not authenticated';

    const password = request.params.password;
    if (!password) return 'Password is required';

    const serverUrl = cloudServerUrl;
    const APPID = serverAppId;

    try {
      const loginUrl = `${serverUrl}/login`;
      await axios({
        method: 'POST',
        url: loginUrl,
        headers: { 'X-Parse-Application-Id': APPID },
        data: {
          username: user.get('username'),
          password,
        },
      });
      return 'Password verified';
    } catch (err) {
      return 'Current password is incorrect';
    }
  } catch (err) {
    return 'Failed to verify password';
  }
}

export default VerifyPassword;
