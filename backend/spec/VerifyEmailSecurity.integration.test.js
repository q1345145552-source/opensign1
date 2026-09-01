import test from 'node:test';
import assert from 'node:assert/strict';
import Parse from '../node_modules/parse/node.js';

Parse.initialize(process.env.APP_ID, undefined, process.env.MASTER_KEY);
Parse.serverURL = 'http://127.0.0.1:8080/app';

test('email OTP security rules work against the running Parse server', async t => {
  const suffix = Date.now();
  const email = `codex-otp-${suffix}@example.invalid`;
  const otherEmail = `codex-otp-other-${suffix}@example.invalid`;
  const password = `Codex-${suffix}-Aa1!`;
  const Otp = Parse.Object.extend('defaultdata_Otp');
  const user = new Parse.User();
  let sessionToken;

  async function createOtp(targetEmail, otp, expiresAt) {
    const record = new Otp();
    record.set('Email', targetEmail);
    record.set('OTP', otp);
    record.set('ExpiresAt', expiresAt);
    return record.save(null, { useMasterKey: true });
  }

  async function otpCount(targetEmail) {
    const query = new Parse.Query(Otp);
    query.equalTo('Email', targetEmail);
    return query.count({ useMasterKey: true });
  }

  try {
    user.set('username', email);
    user.set('email', email);
    user.set('password', password);
    await user.signUp();
    sessionToken = user.getSessionToken();

    await t.test('rejects an OTP belonging to another email', async () => {
      await createOtp(otherEmail, 1111, new Date(Date.now() + 60_000));
      await assert.rejects(
        Parse.Cloud.run('verifyemail', { email: otherEmail, otp: '1111' }, { sessionToken }),
        /does not belong to the authenticated user/i
      );
      assert.equal(await otpCount(otherEmail), 1);
    });

    await t.test('rejects and removes an expired OTP', async () => {
      await createOtp(email, 2222, new Date(Date.now() - 1_000));
      await assert.rejects(
        Parse.Cloud.run('verifyemail', { email, otp: '2222' }, { sessionToken }),
        /invalid or expired/i
      );
      assert.equal(await otpCount(email), 0);
    });

    await t.test('accepts a valid OTP exactly once', async () => {
      await createOtp(email, 3333, new Date(Date.now() + 60_000));
      const result = await Parse.Cloud.run(
        'verifyemail',
        { email: email.toUpperCase(), otp: '3333' },
        { sessionToken }
      );
      assert.equal(result.message, 'Email is verified.');
      assert.equal(await otpCount(email), 0);

      await user.fetch({ sessionToken });
      assert.equal(user.get('emailVerified'), true);

      await assert.rejects(
        Parse.Cloud.run('verifyemail', { email, otp: '3333' }, { sessionToken }),
        /invalid or expired/i
      );
    });
  } finally {
    const cleanupOtp = new Parse.Query(Otp);
    cleanupOtp.containedIn('Email', [email, otherEmail]);
    const records = await cleanupOtp.find({ useMasterKey: true });
    if (records.length > 0) {
      await Parse.Object.destroyAll(records, { useMasterKey: true });
    }
    if (user.id) {
      await user.destroy({ useMasterKey: true });
    }
  }
});
