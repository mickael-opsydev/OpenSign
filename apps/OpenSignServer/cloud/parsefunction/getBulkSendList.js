import { cloudServerUrl, serverAppId } from '../../Utils.js';
import axios from 'axios';

export default async function getBulkSendList(request) {
  const serverUrl = cloudServerUrl;
  const appId = serverAppId;
  const sessionToken = request.headers['sessiontoken'] || request.headers['x-parse-session-token'];
  try {
    const userRes = await axios.get(serverUrl + '/users/me', {
      headers: {
        'X-Parse-Application-Id': appId,
        'X-Parse-Session-Token': sessionToken,
      },
    });
    const userId = userRes.data && userRes.data.objectId;
    if (!userId) {
      return { error: 'Invalid session token' };
    }
    const userPtr = { __type: 'Pointer', className: '_User', objectId: userId };
    const campQuery = new Parse.Query('contracts_Bulksend');
    campQuery.equalTo('CreatedBy', userPtr);
    campQuery.notEqualTo('IsArchive', true);
    campQuery.descending('createdAt');
    campQuery.limit(1000);
    const campaigns = await campQuery.find({ useMasterKey: true });

    const result = await Promise.all(
      campaigns.map(async campaign => {
        const token = campaign.get('Token');
        const buildQuery = () => {
          const q = new Parse.Query('contracts_Document');
          q.equalTo('BulkSendToken', token);
          return q;
        };
        const totalQ = buildQuery();
        const signedQ = buildQuery();
        signedQ.equalTo('IsCompleted', true);
        signedQ.notEqualTo('IsDeclined', true);
        const declinedQ = buildQuery();
        declinedQ.equalTo('IsDeclined', true);
        const pendingQ = buildQuery();
        pendingQ.notEqualTo('IsCompleted', true);
        pendingQ.notEqualTo('IsDeclined', true);

        const [total, signed, declined, pending] = await Promise.all([
          totalQ.count({ useMasterKey: true }),
          signedQ.count({ useMasterKey: true }),
          declinedQ.count({ useMasterKey: true }),
          pendingQ.count({ useMasterKey: true }),
        ]);

        return {
          objectId: campaign.id,
          Name: campaign.get('Name'),
          Token: token,
          Type: campaign.get('Type'),
          TotalRecipients: campaign.get('TotalRecipients') || total,
          createdAt: campaign.createdAt,
          total,
          signed,
          declined,
          pending,
        };
      })
    );
    return result;
  } catch (err) {
    const message = err?.response?.data?.error || err?.message || 'Something went wrong';
    console.log('getbulksendlist error:', message);
    if (err.code == 209) {
      return { error: 'Invalid session token' };
    }
    return { error: "You don't have access!" };
  }
}
