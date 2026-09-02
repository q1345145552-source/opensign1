import test from 'node:test';
import assert from 'node:assert/strict';

async function sendOtp(email) {
  process.env.appName = '湘泰出海';
  process.env.SMTP_ENABLE = 'true';
  process.env.SMTP_USER_EMAIL = 'sender@example.com';

  let sentMail;
  let createdOtp;
  class Query {
    equalTo() {}
    async first() {
      return undefined;
    }
  }
  class OtpRecord {
    constructor() {
      this.fields = new Map();
      createdOtp = this;
    }
    set(field, value) {
      this.fields.set(field, value);
    }
    async save() {}
  }

  global.Parse = {
    Cloud: {
      async sendEmail(mail) {
        sentMail = mail;
      },
    },
    Query,
    Object: {
      extend() {
        return OtpRecord;
      },
    },
  };

  const { default: sendMailOTPv1 } = await import(
    `../cloud/parsefunction/SendMailOTPv1.js?brand-test=${Date.now()}`
  );
  await sendMailOTPv1({
    params: { email },
    headers: { public_url: 'https://sign.example.com' },
  });

  return { sentMail, createdOtp };
}

test('OTP email contains only Xiangtai branding', async () => {
  const { sentMail } = await sendOtp('recipient@example.com');

  assert.equal(sentMail.sender, '湘泰出海 <sender@example.com>');
  assert.equal(sentMail.subject, '你的湘泰出海验证码是');
  assert.match(sentMail.html, /湘泰出海验证码/);
  assert.match(
    sentMail.html,
    /<img[^>]+src=['"]https:\/\/sign\.example\.com\/xiangtai-logo\.png['"]/i
  );
  assert.doesNotMatch(sentMail.html, /OpenSign/i);
});

test('stores a normalized OTP with a 10-minute expiration', async () => {
  const startedAt = Date.now();
  const { createdOtp } = await sendOtp(' Recipient@Example.com ');
  const expiresAt = createdOtp.fields.get('ExpiresAt');

  assert.equal(createdOtp.fields.get('Email'), 'recipient@example.com');
  assert.ok(expiresAt instanceof Date);
  assert.ok(expiresAt.getTime() >= startedAt + 599_000);
  assert.ok(expiresAt.getTime() <= Date.now() + 600_000);
});
