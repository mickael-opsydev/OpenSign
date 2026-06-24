/**
 *
 * @param {Parse} Parse
 */
exports.up = async Parse => {
  const bulkSend = new Parse.Schema('contracts_Bulksend');
  bulkSend
    .addString('Name')
    .addString('Token')
    .addString('Type')
    .addString('SourceFileUrl')
    .addPointer('ExtUserPtr', 'contracts_Users')
    .addPointer('CreatedBy', '_User')
    .addPointer('TemplateId', 'contracts_Template')
    .addNumber('TotalRecipients', 0)
    .addBoolean('IsArchive', false)
    .addIndex('Token_1', { Token: 1 })
    .setCLP({
      get: {},
      find: {},
      count: {},
      create: { '*': true },
      update: { '*': true },
      delete: {},
      addField: {},
    });
  await bulkSend.save(null, { useMasterKey: true });

  const doc = new Parse.Schema('contracts_Document');
  doc.addString('BulkSendToken');
  await doc.update(null, { useMasterKey: true });
};

/**
 *
 * @param {Parse} Parse
 */
exports.down = async Parse => {
  const doc = new Parse.Schema('contracts_Document');
  doc.deleteField('BulkSendToken');
  await doc.update(null, { useMasterKey: true });

  const bulkSend = new Parse.Schema('contracts_Bulksend');
  return bulkSend.purge().then(() => bulkSend.delete());
};
