export default async function VerifyEmail(request) {
  try {
    if (!request?.user) {
      throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'User is not authenticated.');
    } else {
      const otp = parseInt(request.params.otp);
      const email = String(request.params.email || '')
        .trim()
        .toLowerCase();
      const authenticatedEmail = String(request.user.get('email') || '')
        .trim()
        .toLowerCase();

      if (!email || email !== authenticatedEmail) {
        const error = new Error('Email does not belong to the authenticated user.');
        error.code = 400;
        throw error;
      }

      //checking otp is correct or not which already save in defaultdata_Otp class
      const checkOtp = new Parse.Query('defaultdata_Otp');
      checkOtp.equalTo('Email', email);
      checkOtp.equalTo('OTP', otp);

      const res = await checkOtp.first({ useMasterKey: true });
      const expiresAt = res?.get('ExpiresAt');
      const isExpired = !(expiresAt instanceof Date) || expiresAt.getTime() <= Date.now();
      if (res && !isExpired) {
        // Fetch the user by their objectId
        const isEmailVerified = request?.user?.get('emailVerified');
        if (isEmailVerified) {
          await res.destroy({ useMasterKey: true });
          return { message: 'Email is already verified.' };
        } else {
          const userQuery = new Parse.Query(Parse.User);
          const user = await userQuery.get(request?.user.id, {
            sessionToken: request?.user.getSessionToken(),
          });

          // Consume the OTP before updating the user so it cannot be reused.
          await res.destroy({ useMasterKey: true });

          // Update the emailVerified field to true
          user.set('emailVerified', true);
          // Save the user object
          const saveResult = await user.save(null, { useMasterKey: true });
          if (saveResult) {
            return { message: 'Email is verified.' };
          } else {
            const error = new Error('Something went wrong, please try again later!');
            error.code = 400; // Set the error code (e.g., 400 for bad request)
            throw error;
          }
        }
      } else {
        if (res) {
          await res.destroy({ useMasterKey: true });
        }
        const error = new Error('OTP is invalid or expired.');
        error.code = 400; // Set the error code (e.g., 400 for bad request)
        throw error;
      }
    }
  } catch (err) {
    console.log('err ', err.code + ' ' + err.message);
    throw err;
  }
}
