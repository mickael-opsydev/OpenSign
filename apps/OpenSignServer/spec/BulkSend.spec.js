import axios from 'axios';
import createBatchDocs from '../cloud/parsefunction/createBatchDocs.js';
import getBulkSendList from '../cloud/parsefunction/getBulkSendList.js';
import getBulkSendReport from '../cloud/parsefunction/getBulkSendReport.js';

const uniq = () => `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

async function makeOwner() {
  const username = `bulkowner_${uniq()}`;
  const user = new Parse.User();
  user.set('username', username);
  user.set('password', 'pass1234');
  user.set('email', `${username}@example.com`);
  await user.signUp();
  const extUser = new Parse.Object('contracts_Users');
  extUser.set('UserId', user.toPointer());
  extUser.set('Name', 'Bulk Owner');
  extUser.set('Email', `${username}@example.com`);
  extUser.set('Company', 'ACME');
  await extUser.save(null, { useMasterKey: true });
  return { user, userId: user.id, extUser };
}

function buildDocPayload(owner, extUser, name, email) {
  return {
    Name: name,
    URL: 'https://example.com/file.pdf',
    Note: '',
    Description: '',
    CreatedBy: { __type: 'Pointer', className: '_User', objectId: owner.userId },
    ExtUserPtr: {
      __type: 'Pointer',
      className: 'contracts_Users',
      objectId: extUser.id,
      Name: 'Bulk Owner',
      Email: extUser.get('Email'),
      Company: 'ACME',
    },
    Placeholders: [
      {
        Id: 1,
        Role: 'Role 1',
        email,
        signerObjId: '',
        signerPtr: {},
        placeHolder: [{ pageNumber: 1, pos: [{ type: 'signature', options: { name: 'sig' } }] }],
      },
    ],
    Signers: [],
    TimeToCompleteDays: 15,
  };
}

async function makeDocument(owner, extUser, token, overrides) {
  const doc = new Parse.Object('contracts_Document');
  doc.set('Name', overrides.Name || 'Doc');
  doc.set('URL', 'https://example.com/file.pdf');
  doc.set('SignedUrl', 'https://example.com/file.pdf');
  doc.set('BulkSendToken', token);
  doc.set('CreatedBy', owner.user.toPointer());
  doc.set('ExtUserPtr', extUser.toPointer());
  doc.set('Placeholders', [
    { Id: 1, Role: 'Role 1', email: overrides.email, signerObjId: '', signerName: overrides.signerName || '' },
  ]);
  if (overrides.IsCompleted) doc.set('IsCompleted', true);
  if (overrides.IsDeclined) doc.set('IsDeclined', true);
  if (overrides.AuditTrail) doc.set('AuditTrail', overrides.AuditTrail);
  await doc.save(null, { useMasterKey: true });
  return doc;
}

describe('Bulk send — createBatchDocs', () => {
  let owner;
  let extUser;

  beforeAll(async () => {
    const o = await makeOwner();
    owner = o;
    extUser = o.extUser;
  });

  it('creates ALL documents, mails each, and records a campaign with a shared token', async () => {
    spyOn(axios, 'post').and.callFake(async (url, body) => {
      if (url === 'batch') {
        return {
          data: (body.requests || []).map((r, i) => ({
            success: { objectId: `created_${uniq()}_${i}`, createdAt: new Date().toISOString() },
          })),
        };
      }
      if (typeof url === 'string' && url.includes('/functions/sendmailv3')) {
        return { data: { result: { status: 'success' } } };
      }
      return { data: {} };
    });

    const Documents = [
      buildDocPayload(owner, extUser, 'Contrat', 'alice@example.com'),
      buildDocPayload(owner, extUser, 'Contrat', 'bob@example.com'),
      buildDocPayload(owner, extUser, 'Contrat', 'carol@example.com'),
    ];

    const request = {
      params: { Documents: JSON.stringify(Documents) },
      headers: {
        sessiontoken: 'x',
        type: 'bulksend',
        public_url: 'http://localhost:3000',
        'x-real-ip': '1.2.3.4',
      },
      user: { id: owner.userId },
    };

    const res = await createBatchDocs(request);

    expect(res.total).toBe(3);
    expect(res.created).toBe(3);
    expect(res.failed).toBe(0);
    expect(res.bulkSendToken).toBeTruthy();

    const postCalls = axios.post.calls.all();
    const batchCalls = postCalls.filter(c => c.args[0] === 'batch');
    const mailCalls = postCalls.filter(c => String(c.args[0]).includes('sendmailv3'));
    expect(batchCalls.length).toBe(1);
    expect(mailCalls.length).toBe(3);

    const campQ = new Parse.Query('contracts_Bulksend');
    campQ.equalTo('Token', res.bulkSendToken);
    const campaign = await campQ.first({ useMasterKey: true });
    expect(campaign).toBeDefined();
    expect(campaign.get('TotalRecipients')).toBe(3);
    expect(campaign.get('Type')).toBe('bulksend');
    expect(campaign.get('CreatedBy').id).toBe(owner.userId);
  });
});

describe('Bulk send — tracking functions', () => {
  let owner;
  let extUser;
  const token = `tok_${uniq()}`;

  beforeAll(async () => {
    const o = await makeOwner();
    owner = o;
    extUser = o.extUser;

    const campaign = new Parse.Object('contracts_Bulksend');
    campaign.set('Name', 'Reglement interieur');
    campaign.set('Token', token);
    campaign.set('Type', 'bulksend');
    campaign.set('TotalRecipients', 3);
    campaign.set('ExtUserPtr', extUser.toPointer());
    campaign.set('CreatedBy', owner.user.toPointer());
    await campaign.save(null, { useMasterKey: true });

    await makeDocument(owner, extUser, token, {
      Name: 'Doc A',
      email: 'alice@example.com',
      signerName: 'Alice',
      IsCompleted: true,
      AuditTrail: [{ Activity: 'Signed', SignedOn: new Date().toISOString() }],
    });
    await makeDocument(owner, extUser, token, {
      Name: 'Doc B',
      email: 'bob@example.com',
      signerName: 'Bob',
      IsDeclined: true,
    });
    await makeDocument(owner, extUser, token, {
      Name: 'Doc C',
      email: 'carol@example.com',
      signerName: 'Carol',
    });
  });

  function stubUsersMe() {
    spyOn(axios, 'get').and.callFake(async url => {
      if (typeof url === 'string' && url.includes('/users/me')) {
        return { data: { objectId: owner.userId, email: extUser.get('Email') } };
      }
      return { data: {} };
    });
  }

  it('getBulkSendList returns per-campaign counts (signed/declined/pending)', async () => {
    stubUsersMe();
    const list = await getBulkSendList({ headers: { 'x-parse-session-token': 'x' } });
    expect(Array.isArray(list)).toBe(true);
    const campaign = list.find(c => c.Token === token);
    expect(campaign).toBeDefined();
    expect(campaign.total).toBe(3);
    expect(campaign.signed).toBe(1);
    expect(campaign.declined).toBe(1);
    expect(campaign.pending).toBe(1);
  });

  it('getBulkSendReport returns each recipient with its own status', async () => {
    stubUsersMe();
    const res = await getBulkSendReport({
      params: { token },
      headers: { 'x-parse-session-token': 'x' },
    });
    expect(res.error).toBeUndefined();
    expect(res.campaign.Token).toBe(token);
    expect(res.recipients.length).toBe(3);
    const byEmail = Object.fromEntries(res.recipients.map(r => [r.signerEmail, r]));
    expect(byEmail['alice@example.com'].status).toBe('signed');
    expect(byEmail['bob@example.com'].status).toBe('declined');
    expect(byEmail['carol@example.com'].status).toBe('waiting');
    expect(byEmail['alice@example.com'].signerName).toBe('Alice');
  });

  it('getBulkSendReport denies access to another user', async () => {
    const other = await makeOwner();
    spyOn(axios, 'get').and.callFake(async url => {
      if (typeof url === 'string' && url.includes('/users/me')) {
        return { data: { objectId: other.userId, email: other.extUser.get('Email') } };
      }
      return { data: {} };
    });
    const res = await getBulkSendReport({
      params: { token },
      headers: { 'x-parse-session-token': 'y' },
    });
    expect(res.error).toBeDefined();
  });
});
