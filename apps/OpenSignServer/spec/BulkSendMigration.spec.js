async function classExists(name) {
  try {
    await new Parse.Schema(name).get({ useMasterKey: true });
    return true;
  } catch (e) {
    if (e.code === Parse.Error.INVALID_CLASS_NAME || /does not exist/i.test(e.message)) {
      return false;
    }
    throw e;
  }
}

describe('contracts_Bulksend migration', () => {
  it('up() creates the class with its fields, down() removes it', async () => {
    const mod = await import(
      '../databases/migrations/20260624000000-create_contracts_bulksend.cjs'
    );
    const migration = mod.default || mod;

    if (!(await classExists('contracts_Document'))) {
      await new Parse.Schema('contracts_Document').addString('Name').save(null, {
        useMasterKey: true,
      });
    }

    // Ensure a clean slate so the test is order-independent within the suite.
    if (await classExists('contracts_Bulksend')) {
      const existing = new Parse.Schema('contracts_Bulksend');
      await existing.purge();
      await existing.delete();
    }

    expect(await classExists('contracts_Bulksend')).toBe(false);

    await migration.up(Parse);

    expect(await classExists('contracts_Bulksend')).toBe(true);
    const schema = await new Parse.Schema('contracts_Bulksend').get({ useMasterKey: true });
    expect(schema.fields.Token).toBeDefined();
    expect(schema.fields.Token.type).toBe('String');
    expect(schema.fields.TotalRecipients.type).toBe('Number');
    expect(schema.fields.ExtUserPtr.type).toBe('Pointer');
    expect(schema.fields.TemplateId.targetClass).toBe('contracts_Template');

    const docSchema = await new Parse.Schema('contracts_Document').get({ useMasterKey: true });
    expect(docSchema.fields.BulkSendToken).toBeDefined();

    await migration.down(Parse);

    expect(await classExists('contracts_Bulksend')).toBe(false);
  });
});
