import { smtpenable, updateMailCount } from '../../Utils.js';
async function getDocument(docId) {
  try {
    const query = new Parse.Query('contracts_Document');
    query.equalTo('objectId', docId);
    query.include('ExtUserPtr');
    query.include('CreatedBy');
    query.include('Signers');
    query.include('AuditTrail.UserPtr');
    query.include('ExtUserPtr.TenantId');
    query.include('Placeholders');
    query.notEqualTo('IsArchive', true);
    const res = await query.first({ useMasterKey: true });
    const _res = res?.toJSON();
    return _res?.ExtUserPtr?.objectId;
  } catch (err) {
    console.log('err ', err);
  }
}
async function sendMailOTPv1(request) {
  try {
    const code = Math.floor(1000 + Math.random() * 9000);
    const email = String(request.params.email || '')
      .trim()
      .toLowerCase();
    const TenantId = request.params.TenantId ? request.params.TenantId : undefined;
    if (email) {
      const recipient = email;
      const emailBrandName = '湘泰出海';
      const mailsender = smtpenable ? process.env.SMTP_USER_EMAIL : process.env.MAILGUN_SENDER;
      try {
        await Parse.Cloud.sendEmail({
          sender: emailBrandName + ' <' + mailsender + '>',
          recipient: recipient,
          subject: '你的湘泰出海验证码是',
          text: `你的${emailBrandName}验证码是：${code}`,
          html:
            `<html><head><meta http-equiv='Content-Type' content='text/html;charset=UTF-8' /></head><body><div style='background-color:#f5f5f5;padding:20px'><div style='background-color:white;'><div style='background-color:red;padding:2px;font-family:system-ui;background-color:#47a3ad;'><p style='font-size:20px;font-weight:400;color:white;padding-left:20px;'>湘泰出海验证码</p></div><div style='padding:20px;'><p style='font-family:system-ui;font-size:14px;'>你的湘泰出海验证码是：</p><p style='text-decoration:none;font-weight:bolder;color:blue;font-size:45px;margin:20px;'>` +
            code +
            '</p></div></div></div></body></html>',
        });
        console.log('OTP sent', code);
        if (request.params?.docId) {
          const extUserId = await getDocument(request.params?.docId);
          if (extUserId) {
            updateMailCount(extUserId);
          }
        }
      } catch (err) {
        console.log('error in send OTP mail', err);
      }
      const tempOtp = new Parse.Query('defaultdata_Otp');
      tempOtp.equalTo('Email', email);
      const resultOTP = await tempOtp.first({ useMasterKey: true });
      let otpRecord = resultOTP;
      if (!otpRecord) {
        const otpClass = Parse.Object.extend('defaultdata_Otp');
        otpRecord = new otpClass();
      }
      otpRecord.set('OTP', code);
      otpRecord.set('Email', email);
      otpRecord.set('TenantId', TenantId);
      otpRecord.set('ExpiresAt', new Date(Date.now() + 10 * 60 * 1000));
      await otpRecord.save(null, { useMasterKey: true });
      return 'Otp send';
    } else {
      return 'Please Enter valid email';
    }
  } catch (err) {
    console.log('err in sendMailOTPv1');
    console.log(err);
    return err;
  }
}
export default sendMailOTPv1;
