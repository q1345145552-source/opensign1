import test from 'node:test';
import assert from 'node:assert/strict';

function installParse({ accountEmail, otpEmail = accountEmail, expiresAt }) {
  const state = {
    otpDestroyed: false,
    emailVerified: false,
  };

  const otpRecord = {
    get(field) {
      if (field === 'ExpiresAt') return expiresAt;
      return undefined;
    },
    async destroy() {
      state.otpDestroyed = true;
    },
  };

  const persistedUser = {
    set(field, value) {
      if (field === 'emailVerified') state.emailVerified = value;
    },
    async save() {
      return this;
    },
  };

  class User {}
  class Query {
    constructor(className) {
      this.className = className;
      this.filters = new Map();
    }
    equalTo(field, value) {
      this.filters.set(field, value);
    }
    async first() {
      if (state.otpDestroyed) return undefined;
      const emailMatches = this.filters.get('Email') === otpEmail;
      const otpMatches = this.filters.get('OTP') === 1234;
      return emailMatches && otpMatches ? otpRecord : undefined;
    }
    async get() {
      return persistedUser;
    }
  }

  class ParseError extends Error {}
  ParseError.INVALID_SESSION_TOKEN = 209;

  global.Parse = {
    Error: ParseError,
    Query,
    User,
  };

  const requestUser = {
    id: 'user-1',
    get(field) {
      if (field === 'email') return accountEmail;
      if (field === 'emailVerified') return state.emailVerified;
      return undefined;
    },
    getSessionToken() {
      return 'session-token';
    },
  };

  return { state, requestUser };
}

const { default: verifyEmail } = await import('../cloud/parsefunction/VerifyEmail.js');

test('rejects an OTP issued for a different email than the signed-in account', async () => {
  const { state, requestUser } = installParse({
    accountEmail: 'owner@example.com',
    otpEmail: 'other@example.com',
    expiresAt: new Date(Date.now() + 60_000),
  });

  await assert.rejects(
    verifyEmail({ user: requestUser, params: { email: 'other@example.com', otp: '1234' } }),
    /does not belong to the authenticated user/i
  );
  assert.equal(state.emailVerified, false);
  assert.equal(state.otpDestroyed, false);
});

test('rejects an expired OTP', async () => {
  const { state, requestUser } = installParse({
    accountEmail: 'owner@example.com',
    expiresAt: new Date(Date.now() - 1_000),
  });

  await assert.rejects(
    verifyEmail({ user: requestUser, params: { email: 'owner@example.com', otp: '1234' } }),
    /invalid or expired/i
  );
  assert.equal(state.emailVerified, false);
});

test('consumes a valid OTP so it cannot be used twice', async () => {
  const { state, requestUser } = installParse({
    accountEmail: 'Owner@Example.com',
    otpEmail: 'owner@example.com',
    expiresAt: new Date(Date.now() + 60_000),
  });

  const firstResult = await verifyEmail({
    user: requestUser,
    params: { email: ' owner@example.com ', otp: '1234' },
  });
  assert.equal(firstResult.message, 'Email is verified.');
  assert.equal(state.emailVerified, true);
  assert.equal(state.otpDestroyed, true);

  await assert.rejects(
    verifyEmail({ user: requestUser, params: { email: 'owner@example.com', otp: '1234' } }),
    /invalid or expired/i
  );
});
