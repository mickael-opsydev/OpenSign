import { cloudServerUrl, serverAppId } from '../../Utils.js';
import axios from 'axios';

export default async function getBulkSendReport(request) {
  const token = request.params.token;
  const serverUrl = cloudServerUrl;
  const appId = serverAppId;
  const sessionToken = request.headers['sessiontoken'] || request.headers['x-parse-session-token'];
  try {
    if (!token) {
      return { error: 'Bulk send token is required' };
    }
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
    campQuery.equalTo('Token', token);
    campQuery.equalTo('CreatedBy', userPtr);
    const campaign = await campQuery.first({ useMasterKey: true });
    if (!campaign) {
      return { error: "You don't have access!" };
    }

    const docQuery = new Parse.Query('contracts_Document');
    docQuery.equalTo('BulkSendToken', token);
    docQuery.descending('createdAt');
    docQuery.limit(10000);
    const docs = await docQuery.find({ useMasterKey: true });

    const signerIds = new Set();
    docs.forEach(doc => {
      const placeholders = (doc.get('Placeholders') || []).filter(p => p?.Role !== 'prefill');
      placeholders.forEach(p => {
        if (p?.signerObjId) signerIds.add(p.signerObjId);
      });
    });

    const contactMap = {};
    if (signerIds.size > 0) {
      const contactQuery = new Parse.Query('contracts_Contactbook');
      contactQuery.containedIn('objectId', [...signerIds]);
      contactQuery.limit(10000);
      const contacts = await contactQuery.find({ useMasterKey: true });
      contacts.forEach(c => {
        contactMap[c.id] = {
          Name: c.get('Name') || '',
          Email: c.get('Email') || '',
          Phone: c.get('Phone') || '',
        };
      });
    }

    const recipients = docs.map(doc => {
      const placeholders = (doc.get('Placeholders') || []).filter(p => p?.Role !== 'prefill');
      const ph = placeholders[0] || {};
      const contact = ph?.signerObjId ? contactMap[ph.signerObjId] : null;
      const signerName = contact?.Name || ph?.signerPtr?.Name || ph?.signerName || '';
      const signerEmail = contact?.Email || ph?.email || '';
      const signerPhone = contact?.Phone || ph?.signerPtr?.Phone || ph?.signerPhone || '';

      const isCompleted = doc.get('IsCompleted');
      const isDeclined = doc.get('IsDeclined');
      const auditTrail = doc.get('AuditTrail') || [];
      const signedEntry = auditTrail.find(a => a?.Activity === 'Signed');
      const viewedEntry = auditTrail.find(a => a?.Activity === 'Viewed');

      let status = 'waiting';
      if (isDeclined) status = 'declined';
      else if (isCompleted) status = 'signed';
      else if (viewedEntry) status = 'viewed';

      return {
        objectId: doc.id,
        Name: doc.get('Name'),
        signerName,
        signerEmail,
        signerPhone,
        status,
        SignedUrl: doc.get('SignedUrl') || '',
        CertificateUrl: doc.get('CertificateUrl') || '',
        signedAt: signedEntry?.SignedOn || null,
        viewedAt: viewedEntry?.ViewedOn || null,
        declineReason: doc.get('DeclineReason') || '',
        createdAt: doc.createdAt,
      };
    });

    return {
      campaign: {
        objectId: campaign.id,
        Name: campaign.get('Name'),
        Token: token,
        Type: campaign.get('Type'),
        TotalRecipients: campaign.get('TotalRecipients') || recipients.length,
        createdAt: campaign.createdAt,
      },
      recipients,
    };
  } catch (err) {
    const message = err?.response?.data?.error || err?.message || 'Something went wrong';
    console.log('getbulksendreport error:', message);
    if (err.code == 209) {
      return { error: 'Invalid session token' };
    }
    return { error: "You don't have access!" };
  }
}
