import fs from 'node:fs';
import { createHash } from 'node:crypto';
import axios from 'axios';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import {
  cloudServerUrl,
  replaceMailVaribles,
  saveFileUsage,
  getSecureUrl,
  appName,
  serverAppId,
  brandLogoUrl,
} from '../../../Utils.js';
import GenerateCertificate from './GenerateCertificate.js';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { Placeholder } from './Placeholder.js';
import { SignPdf } from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';
import { presignedlocalUrl } from '../getSignedUrl.js';
import { buildDownloadFilename, parseUploadFile } from '../../../utils/fileUtils.js';
import sendMailWithAttachment from '../sendMailWithAttachment.js';
import sendSystemMail from '../sendSystemMail.js';
import {
  COMPLETION_ACTIVITIES,
  findPlaceholderIndex,
  findPendingPriorSigner,
  isCompletionRelevant,
} from '../../../utils/workflowUtils.js';

// Audit-trail activities that count toward document completion. The free
// build only counts 'Signed'; EE additionally counts 'Approved'.

// A placeholder participates in completion unless it is a prefill entry.
// EE additionally excludes viewers (who never act on the document).

// Strict-order gating: returns the signerObjId of the prior placeholder
// still pending, or null when the strict-order requirement is satisfied.

const serverUrl = cloudServerUrl; // process.env.SERVER_URL;
const APPID = serverAppId;
const masterKEY = process.env.MASTER_KEY;
const eSignName = '湘泰出海';
const eSigncontact = 'hello@opensignlabs.com';
const docUrl = `${serverUrl}/classes/contracts_Document`;
const headers = {
  'Content-Type': 'application/json',
  'X-Parse-Application-Id': APPID,
  'X-Parse-Master-Key': masterKEY,
};

function generateDocumentHash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function unlinkFile(path) {
  if (fs.existsSync(path)) {
    try {
      fs.unlinkSync(path);
    } catch (err) {
      console.log('Err in unlink file: ', path);
    }
  }
}

// `updateDoc` is used to create url in from pdfFile
async function uploadFile(pdfName, filepath) {
  try {
    const filedata = fs.readFileSync(filepath);
    let fileUrl;

    const fileRes = await parseUploadFile(pdfName, filedata, 'application/pdf');
    fileUrl = getSecureUrl(fileRes?.url)?.url;

    return { imageUrl: fileUrl };
  } catch (err) {
    console.log('Err ', err);
    // below line of code is used to remove exported signed pdf file from exports folder
    unlinkFile(filepath);
  }
}

// `updateDoc` is used to update signedUrl, AuditTrail, Iscompleted in document
async function updateDoc(
  docId,
  url,
  userId,
  ipAddress,
  data,
  className,
  sign,
  documentHash,
  activity
) {
  try {
    const UserPtr = { __type: 'Pointer', className: className, objectId: userId };
    const auditActivity = 'Signed';
    const obj = {
      UserPtr: UserPtr,
      SignedUrl: url,
      Activity: auditActivity,
      ipAddress: ipAddress,
      SignedOn: new Date(),
      Signature: sign,
    };
    let updateAuditTrail;
    if (data.AuditTrail && data.AuditTrail.length > 0) {
      const AuditTrail = JSON.parse(JSON.stringify(data.AuditTrail));
      const existingIndex = AuditTrail.findIndex(
        entry => entry.UserPtr.objectId === userId && entry.Activity !== 'Created'
      );
      existingIndex !== -1
        ? (AuditTrail[existingIndex] = { ...AuditTrail[existingIndex], ...obj })
        : AuditTrail.push(obj);

      updateAuditTrail = AuditTrail;
    } else {
      updateAuditTrail = [obj];
    }

    // Count both Signed and Approved entries; only signer/approver
    // placeholders count toward completion (viewers and prefill excluded).
    const auditTrail = updateAuditTrail.filter(x => COMPLETION_ACTIVITIES.includes(x.Activity));
    let isCompleted = false;
    if (data.Signers && data.Signers.length > 0) {
      const completionRelevant =
        data.Placeholders?.length > 0 ? data.Placeholders.filter(isCompletionRelevant) : [];
      if (auditTrail.length >= completionRelevant.length && completionRelevant.length > 0) {
        isCompleted = true;
      }
    } else {
      isCompleted = true;
    }
    const body = { SignedUrl: url, AuditTrail: updateAuditTrail, IsCompleted: isCompleted };
    if (documentHash && isCompleted) {
      body.DocumentHash = documentHash;
    }
    const signedRes = await axios.put(`${docUrl}/${docId}`, body, { headers });
    return {
      isCompleted: isCompleted,
      message: 'success',
      AuditTrail: updateAuditTrail,
      DocumentHash: documentHash && isCompleted ? documentHash : undefined,
    };
  } catch (err) {
    console.log('update doc err ', err);
    return 'err';
  }
}

// `sendNotifyMail` is used to send notification mail of signer signed the document
async function sendNotifyMail(doc, signUser, mailProvider, publicUrl) {
  try {
    const TenantAppName = appName;
    const logo =
      `<img src='${brandLogoUrl(publicUrl)}' height='50' style='padding:20px'/>`;

    const auditTrailCount =
      doc?.AuditTrail?.filter(x => COMPLETION_ACTIVITIES.includes(x.Activity))?.length || 0;
    const completionRelevant =
      doc?.Placeholders?.length > 0 ? doc.Placeholders.filter(isCompletionRelevant) : [];
    const signersCount = completionRelevant?.length;
    const remainingSign = signersCount - auditTrailCount;
    if (remainingSign > 1 && doc?.NotifyOnSignatures) {
      const sender = doc.ExtUserPtr;
      const pdfName = doc.Name;
      const creatorName = doc.ExtUserPtr.Name;
      const creatorEmail = doc.ExtUserPtr.Email;
      const signerName = signUser.Name;
      const signerEmail = signUser.Email;
      const viewDocUrl = `${publicUrl}/recipientSignPdf/${doc.objectId}`;
      const subject = `Document "${pdfName}" has been signed by ${signerName}`;
      const body =
        "<html><head><meta http-equiv='Content-Type' content='text/html; charset=UTF-8'/></head><body><div style='background-color:#f5f5f5;padding:20px'><div style='background-color:white'>" +
        `<div>${logo}</div><div style='padding:2px;font-family:system-ui;background-color:#47a3ad'><p style='font-size:20px;font-weight:400;color:white;padding-left:20px'>Document signed by ${signerName}</p>` +
        `</div><div style='padding:20px;font-family:system-ui;font-size:14px'><p>Dear ${creatorName},</p><p>${pdfName} has been signed by ${signerName} "${signerEmail}" successfully</p>` +
        `<p><a href=${viewDocUrl} target=_blank>View Document</a></p></div></div><div><p>This is an automated email from ${TenantAppName}. For any queries regarding this email, ` +
        `please contact the sender ${creatorEmail} directly.</p></div></div></body></html>`;

      const params = {
        extUserId: sender.objectId,
        from: TenantAppName,
        recipient: creatorEmail,
        subject: subject,
        pdfName: pdfName,
        html: body,
        mailProvider: mailProvider,
      };
      await sendSystemMail({ params });
    }
  } catch (err) {
    console.log('err in sendnotifymail', err);
  }
}

// `sendCompletedMail` is used to send copy of completed document mail
async function sendCompletedMail(obj) {
  const url = obj.doc?.SignedUrl;
  const doc = obj.doc;
  const sender = obj.doc.ExtUserPtr;
  const pdfName = doc.Name;
  const TenantAppName = appName;
  const logo =
    `<img src='${brandLogoUrl(obj.publicUrl)}' height='50' style='padding:20px'/>`;

  let signersMail;
  if (doc?.Signers?.length > 0) {
    const isOwnerExistsinSigners = doc?.Signers?.find(x => x.Email === sender.Email);
    signersMail = isOwnerExistsinSigners
      ? doc?.Signers?.map(x => x?.Email)?.join(',')
      : [...doc?.Signers?.map(x => x?.Email), sender.Email]?.join(',');
  } else {
    signersMail = sender.Email;
  }
  const recipient = signersMail;
  let subject = `Document "${pdfName}" has been signed by all parties`;
  let body =
    "<html><head><meta http-equiv='Content-Type' content='text/html; charset=UTF-8' /></head><body><div style='background-color:#f5f5f5;padding:20px'><div style='background-color:white'>" +
    `<div>${logo}</div><div style='padding:2px;font-family:system-ui;background-color:#47a3ad'><p style='font-size:20px;font-weight:400;color:white;padding-left:20px'>Document signed successfully</p></div><div>` +
    `<p style='padding:20px;font-family:system-ui;font-size:14px'>All parties have successfully signed the document <b>"${pdfName}"</b>. Kindly download the document from the attachment.</p>` +
    `</div></div><div><p>This is an automated email from ${TenantAppName}. For any queries regarding this email, please contact the sender ${sender.Email} directly.</p></div></div></body></html>`;

  if (obj?.isCustomMail) {
    const tenant = sender?.TenantId;
    if (tenant) {
      subject = tenant?.CompletionSubject ? tenant?.CompletionSubject : subject;
      body = tenant?.CompletionBody ? tenant?.CompletionBody : body;
    } else {
      const userId = sender?.CreatedBy?.objectId || sender?.UserId?.objectId;
      if (userId) {
        try {
          const tenantQuery = new Parse.Query('partners_Tenant');
          tenantQuery.equalTo('UserId', {
            __type: 'Pointer',
            className: '_User',
            objectId: userId,
          });
          const tenantRes = await tenantQuery.first({ useMasterKey: true });
          if (tenantRes) {
            const _tenantRes = JSON.parse(JSON.stringify(tenantRes));
            subject = _tenantRes?.CompletionSubject ? tenant?.CompletionSubject : subject;
            body = _tenantRes?.CompletionBody ? tenant?.CompletionBody : body;
          }
        } catch (err) {
          console.log('error in fetch tenant in signpdf', err.message);
        }
      }
    }
    const expireDate = doc.ExpiryDate.iso;
    const newDate = new Date(expireDate);
    const localExpireDate = newDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const variables = {
      document_title: pdfName,
      note: doc?.Note,
      sender_name: doc?.SenderName || sender.Name,
      sender_mail: doc?.SenderMail || sender.Email,
      sender_phone: sender?.Phone || '',
      receiver_name: sender.Name,
      receiver_email: sender.Email,
      receiver_phone: sender?.Phone || '',
      expiry_date: localExpireDate,
      company_name: sender.Company,
    };
    const replaceVar = replaceMailVaribles(subject, body, variables);
    subject = replaceVar.subject;
    body = replaceVar.body;
  }
  const Bcc = doc?.Bcc?.length > 0 ? doc.Bcc.map(x => x.Email) : [];
  const Cc = doc?.Cc?.length > 0 ? doc.Cc.map(x => x.Email) : [];
  const updatedBcc = doc?.SenderMail ? [...Bcc, doc?.SenderMail] : Bcc;
  const formatId = doc?.ExtUserPtr?.DownloadFilenameFormat;
  const filename = pdfName?.length > 100 ? pdfName?.slice(0, 100) : pdfName;
  const docName = buildDownloadFilename(formatId, {
    docName: filename,
    email: doc?.ExtUserPtr?.Email,
    isSigned: true,
  });
  const params = {
    extUserId: sender.objectId,
    url: url,
    from: doc?.SenderName || TenantAppName,
    replyto: doc?.SenderMail || doc?.ExtUserPtr?.Email || '',
    recipient: recipient,
    subject: subject,
    pdfName: pdfName,
    html: body,
    mailProvider: obj.mailProvider,
    bcc: updatedBcc?.length > 0 ? updatedBcc : '',
    cc: Cc?.length > 0 ? Cc : '',
    certificatePath: `./exports/signed_certificate_${doc.objectId}.pdf`,
    filename: docName,
  };
  try {
    const res = await sendMailWithAttachment(params);
    // console.log("res ", res)
    if (res?.status !== 'success') {
      unlinkFile(`./exports/signed_certificate_${doc.objectId}.pdf`);
    }
  } catch (err) {
    unlinkFile(`./exports/signed_certificate_${doc.objectId}.pdf`);
  }
}

// `sendMailsaveCertifcate` is used send completion mail and update complete status of document
async function sendMailsaveCertifcate(doc, pfx, isCustomMail, mailProvider, filename, publicUrl) {
  const certificate = await GenerateCertificate(doc);
  const certificatePdf = await PDFDocument.load(certificate);
  const P12Buffer = fs.readFileSync(pfx.name);
  const p12 = new P12Signer(P12Buffer, { passphrase: pfx.passphrase || null });
  //  `pdflibAddPlaceholder` is used to add code of only digitial sign in certificate
  pdflibAddPlaceholder({
    pdfDoc: certificatePdf,
    reason: `Digitally signed by ${eSignName}.`,
    location: 'n/a',
    name: eSignName,
    contactInfo: eSigncontact,
    signatureLength: 16000,
  });
  const pdfWithPlaceholderBytes = await certificatePdf.save();
  const CertificateBuffer = Buffer.from(pdfWithPlaceholderBytes);
  //`new signPDF` create new instance of CertificateBuffer and p12Buffer
  const certificateOBJ = new SignPdf();
  // `signedCertificate` is used to sign certificate digitally
  const signedCertificate = await certificateOBJ.sign(CertificateBuffer, p12);
  const certificatePath = `./exports/signed_certificate_${doc.objectId}.pdf`;

  //below is used to save signed certificate in exports folder
  fs.writeFileSync(certificatePath, signedCertificate);
  const file = await uploadFile('certificate.pdf', certificatePath);
  const body = { CertificateUrl: file.imageUrl };
  await axios.put(`${docUrl}/${doc.objectId}`, body, { headers });
  // used in API only
  if (doc.IsSendMail === false) {
    console.log("don't send mail");
  } else {
    sendCompletedMail({ isCustomMail, doc, mailProvider, filename, publicUrl });
  }
  saveFileUsage(CertificateBuffer.length, file.imageUrl, doc?.CreatedBy?.objectId);
  unlinkFile(pfx.name);
  return file.imageUrl;
}

/**
 * 获取文档发起人（公司）上传的公司章图片 URL。
 * 公司章保存在 contracts_Signature 的 Stamp 字段，通过 UserId 关联用户。
 */
async function fetchOwnerStampUrl(_resDoc) {
  try {
    const ownerUserId = _resDoc?.CreatedBy?.objectId || _resDoc?.ExtUserPtr?.UserId?.objectId;
    if (!ownerUserId) return null;
    const q = new Parse.Query('contracts_Signature');
    q.equalTo('UserId', { __type: 'Pointer', className: '_User', objectId: ownerUserId });
    q.exists('Stamp');
    q.notEqualTo('Stamp', '');
    q.descending('updatedAt');
    const rec = await q.first({ useMasterKey: true });
    return rec ? rec.get('Stamp') : null;
  } catch (err) {
    console.log('骑缝章: 查询公司章失败', err.message);
    return null;
  }
}

/**
 * 下载公司章图片并返回 Buffer。
 * 本地文件 URL 用外部地址重新签名后再下载，避免 token 过期和地址不匹配。
 */
async function downloadStampImage(rawUrl) {
  if (!rawUrl) return null;
  try {
    if (rawUrl.includes('/files/')) {
      const signedUrl = presignedlocalUrl(rawUrl);
      const resp = await axios.get(signedUrl, { responseType: 'arraybuffer', timeout: 30000 });
      return Buffer.from(resp.data);
    }
    const resp = await axios.get(rawUrl, { responseType: 'arraybuffer', timeout: 30000 });
    return Buffer.from(resp.data);
  } catch (err) {
    console.log('骑缝章: 下载公司章失败', err.message);
    return null;
  }
}

/**
 * 骑缝章：把公司章盖在所有页的装订侧（左侧）边缘。
 * 章按上下切成两半，奇数页盖上半，偶数页盖下半，
 * 这样相邻两页的边缘拼起来是一个完整的章。
 */
async function applyPagingSeal(pdfDoc, _resDoc) {
  try {
    const stampUrl = await fetchOwnerStampUrl(_resDoc);
    if (!stampUrl) {
      console.log('骑缝章: 未找到公司章，跳过');
      return;
    }
    const imgBuffer = await downloadStampImage(stampUrl);
    if (!imgBuffer) return;

    const meta = await sharp(imgBuffer).metadata();
    const w = meta.width;
    const h = meta.height;
    if (!w || !h) return;

    const topH = Math.floor(h / 2);
    const bottomH = h - topH;
    const topHalf = await sharp(imgBuffer)
      .extract({ left: 0, top: 0, width: w, height: topH })
      .png()
      .toBuffer();
    const bottomHalf = await sharp(imgBuffer)
      .extract({ left: 0, top: topH, width: w, height: bottomH })
      .png()
      .toBuffer();

    const topImg = await pdfDoc.embedPng(topHalf);
    const bottomImg = await pdfDoc.embedPng(bottomHalf);

    // 章宽固定，高度按原图比例算，保证不变形
    const sealWidth = 100;
    const halfHeightPt = (sealWidth * h) / (2 * w);

    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { height: pageHeight } = page.getSize();
      const isTop = i % 2 === 0;
      const img = isTop ? topImg : bottomImg;
      const y = isTop ? pageHeight / 2 : pageHeight / 2 - halfHeightPt;
      page.drawImage(img, { x: 0, y, width: sealWidth, height: halfHeightPt });
    }
    console.log(`骑缝章: 已在 ${pages.length} 页盖上公司章`);
  } catch (err) {
    console.log('骑缝章: 盖章失败', err.message);
  }
}

/**
 * Process a PDF for signing:
 * - updates audit trail, generates certificate.
 * - Optionally inserts a signature placeholder (Placeholder()).
 * - Otherwise (no merge + no placeholder), it flattens forms for finalization.
 *
 * @param {Object} _resDoc - Document details (expects AuditTrail, etc.)
 * @param {Buffer|Uint8Array} pdfBytes - Original PDF bytes
 * @param {string} [options.reason] - Reason text used in placeholder
 * @param {string} [options.UserPtr] -  user pointer (for audit trail)
 * @param {string} [options.ipAddress] - IP (for audit trail)
 * @param {string} [options.Signature] - Signature (for audit trail)
 * @returns {Promise<Buffer>} merged PDF Buffer
 */
async function processPdf(_resDoc, PdfBuffer, reason) {
  // No CC merge; operate directly on the original PDF
  const pdfDoc = await PDFDocument.load(PdfBuffer);
  const form = pdfDoc.getForm();
  // Updates the field appearances to ensure visual changes are reflected.
  form.updateFieldAppearances();
  // Flattens the form, converting all form fields into non-editable, static content
  form.flatten();
  // 骑缝章：仅当文档勾选了骑缝章时才把公司章盖在所有页的装订侧边缘
  if (_resDoc?.IsPagingSeal === true) {
    await applyPagingSeal(pdfDoc, _resDoc);
  }
  Placeholder({
    pdfDoc: pdfDoc,
    reason: `Digitally signed by ${eSignName} for ${reason}`,
    location: 'n/a',
    name: eSignName,
    contactInfo: eSigncontact,
    signatureLength: 16000,
  });
  const pdfWithPlaceholderBytes = await pdfDoc.save();
  return Buffer.from(pdfWithPlaceholderBytes);
}
/**
 *
 * @param docId Id of Document in which user is signing
 * @param pdfFile base64 of pdfFile which you want sign
 * @returns if success {status, data} else {status, message}
 */
async function PDF(req) {
  const docId = req.params.docId;
  const randomNumber = Math.floor(Math.random() * 5000);
  const pfxname = `keystore_${randomNumber}.pfx`;
  try {
    const userIP = req.headers['x-real-ip']; // client IPaddress
    const reqUserId = req.params.userId;
    const isCustomMail = req.params.isCustomCompletionMail || false;
    const mailProvider = req.params.mailProvider || '';
    const sign = req.params.signature || '';
    const auditActivity = 'Signed';
    const publicUrl = req.headers.public_url;
    // below bode is used to get info of docId
    const docQuery = new Parse.Query('contracts_Document');
    docQuery.include('ExtUserPtr,Signers,ExtUserPtr.TenantId,Bcc,Cc,CreatedBy');
    docQuery.equalTo('objectId', docId);
    docQuery.notEqualTo('IsDeclined', true);
    docQuery.notEqualTo('IsArchive', true);
    const resDoc = await docQuery.first({ useMasterKey: true });
    if (!resDoc) {
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Document not found.');
    }
    const IsEnableOTP = resDoc?.get('IsEnableOTP') || false;
    // if `IsEnableOTP` is false then we don't have to check authentication
    if (IsEnableOTP) {
      if (!req?.user) {
        throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'User is not authenticated.');
      }
    }
    const _resDoc = resDoc?.toJSON();
    let signUser;
    let className;
    // `reqUserId` is send throught pdfrequest signing flow
    if (reqUserId) {
      // to get contracts_Contactbook details for currentuser from reqUserId
      const _contractUser = _resDoc.Signers.find(x => x.objectId === reqUserId);
      if (_contractUser) {
        signUser = _contractUser;
        className = 'contracts_Contactbook';
      }
    } else {
      className = 'contracts_Users';
      signUser = _resDoc.ExtUserPtr;
    }
    // Strict-order gating: when both `SendinOrder` and `SendInOrderStrict`
    // are enabled the document creator wants the signing flow locked to a
    // strict sequence — a signer/approver may only act once every previous
    // signer/approver placeholder has a Signed/Approved audit entry. We
    // skip this check entirely for the document owner (className=Users)
    // because owners never sign through this path.
    if (reqUserId && _resDoc?.SendinOrder === true && _resDoc?.SendInOrderStrict === true) {
      const placeholders = Array.isArray(_resDoc?.Placeholders)
        ? _resDoc.Placeholders.filter(p => p?.Role !== 'prefill')
        : [];
      const myIdx = findPlaceholderIndex(placeholders, reqUserId);
      if (myIdx > 0) {
        const pendingId = findPendingPriorSigner(placeholders, myIdx, _resDoc?.AuditTrail);
        if (pendingId) {
          throw new Parse.Error(
            Parse.Error.OPERATION_FORBIDDEN,
            'Strict signing order is enabled — please wait for the previous signers to complete their action before signing.'
          );
        }
      }
    }
    const username = signUser.Name;
    const userEmail = signUser.Email;
    if (req.params.pdfFile) {
      //  `PdfBuffer` used to create buffer from pdf file
      let PdfBuffer = Buffer.from(req.params.pdfFile, 'base64');
      //  `P12Buffer` used to create buffer from p12 certificate
      let pfxFile = process.env.PFX_BASE64;
      let passphrase = process.env.PASS_PHRASE;
      if (_resDoc?.ExtUserPtr?.TenantId?.PfxFile?.base64) {
        pfxFile = _resDoc?.ExtUserPtr?.TenantId?.PfxFile?.base64;
        passphrase = _resDoc?.ExtUserPtr?.TenantId?.PfxFile?.password;
      }
      const pfx = { name: pfxname, passphrase: passphrase };
      const P12Buffer = Buffer.from(pfxFile, 'base64');
      fs.writeFileSync(pfxname, P12Buffer);
      const UserPtr = { __type: 'Pointer', className: className, objectId: signUser.objectId };
      const obj = { UserPtr: UserPtr, SignedUrl: '', Activity: auditActivity, ipAddress: userIP };
      let updateAuditTrail;
      if (_resDoc.AuditTrail && _resDoc.AuditTrail.length > 0) {
        updateAuditTrail = [..._resDoc.AuditTrail, obj];
      } else {
        updateAuditTrail = [obj];
      }

      // Both Signed and Approved entries count toward completion. Only
      // signer/approver placeholders are counted; viewers and prefill are
      // excluded.
      const auditTrail = updateAuditTrail.filter(x => COMPLETION_ACTIVITIES.includes(x.Activity));
      let isCompleted = false;
      if (_resDoc.Signers && _resDoc.Signers.length > 0) {
        const completionRelevant =
          _resDoc?.Placeholders?.length > 0
            ? _resDoc.Placeholders.filter(isCompletionRelevant)
            : [];
        if (auditTrail.length >= completionRelevant.length && completionRelevant.length > 0) {
          isCompleted = true;
        }
      } else {
        isCompleted = true;
      }
      // below regex is used to replace all word with "_" except A to Z, a to z, numbers
      const docName = _resDoc?.Name?.replace(/[^a-zA-Z0-9._-]/g, '_')?.toLowerCase();
      const filename = docName?.length > 100 ? docName?.slice(0, 100) : docName;
      const name = `${filename}_${randomNumber}.pdf`;
      let filePath = `./exports/${name}`;
      let signedFilePath = `./exports/signed_${name}`;
      let pdfSize = PdfBuffer.length;
      let documentHash;
      if (isCompleted) {
        const signersName = _resDoc.Signers?.map(x => x.Name + ' <' + x.Email + '>');
        const reason =
          signersName && signersName.length > 0
            ? signersName?.join(', ')
            : username + ' <' + userEmail + '>';
        const p12Cert = new P12Signer(P12Buffer, { passphrase: passphrase || null });
        signedFilePath = `./exports/signed_${name}`;
        PdfBuffer = await processPdf(_resDoc, PdfBuffer, reason, UserPtr, userIP, sign);
        //`new signPDF` create new instance of pdfBuffer and p12Buffer
        const OBJ = new SignPdf();
        // `signedDocs` is used to signpdf digitally
        const signedDocs = await OBJ.sign(PdfBuffer, p12Cert);

        //`saveUrl` is used to save signed pdf in exports folder
        fs.writeFileSync(signedFilePath, signedDocs);
        pdfSize = signedDocs.length;
        documentHash = generateDocumentHash(signedDocs);
        console.log(`✅ PDF digitally signed created: ${signedFilePath} \n`);
      } else {
        //`saveUrl` is used to save signed pdf in exports folder
        fs.writeFileSync(signedFilePath, PdfBuffer);
        pdfSize = PdfBuffer.length;
        console.log(`New Signed PDF created called: ${signedFilePath}`);
      }

      // `uploadFile` is used to upload pdf to aws s3 and get it's url
      const data = await uploadFile(`signed_${name}`, signedFilePath);

      if (data && data.imageUrl) {
        // `axios` is used to update signed pdf url in contracts_Document classes for given DocId
        const updatedDoc = await updateDoc(
          req.params.docId, //docId
          data.imageUrl, // SignedUrl
          signUser.objectId, // userID
          userIP, // client ipAddress,
          _resDoc, // auditTrail, signers, etc data
          className, // className based on flow
          sign, // sign base64
          isCompleted ? documentHash : undefined,
          auditActivity
        );
        sendNotifyMail(_resDoc, signUser, mailProvider, publicUrl);
        saveFileUsage(pdfSize, data.imageUrl, _resDoc?.CreatedBy?.objectId);
        if (updatedDoc && updatedDoc.isCompleted) {
          const hashForDoc = documentHash || updatedDoc?.DocumentHash;
          const doc = { ..._resDoc, AuditTrail: updatedDoc.AuditTrail, SignedUrl: data.imageUrl };
          if (hashForDoc) {
            doc.DocumentHash = hashForDoc;
          }
          sendMailsaveCertifcate(
            doc,
            pfx,
            isCustomMail,
            mailProvider,
            `signed_${name}`,
            publicUrl
          );
        } else {
          unlinkFile(pfxname);
        }
        // below code is used to remove exported signed pdf file from exports folder
        unlinkFile(signedFilePath);
        // console.log(`New Signed PDF created called: ${filePath}`);
        if (updatedDoc.message === 'success') {
          return { status: 'success', data: data.imageUrl };
        } else {
          const error = new Error('Please provide required parameters!');
          error.code = 400; // Set the error code (e.g., 400 for bad request)
          throw error;
        }
      }
    } else {
      const error = new Error('Pdf file not present!');
      error.code = 400; // Set the error code (e.g., 400 for bad request)
      throw error;
    }
  } catch (err) {
    console.log('Err in signpdf', err);
    const body = { DebugginLog: err?.message };
    try {
      await axios.put(`${docUrl}/${docId}`, body, { headers });
    } catch (err) {
      console.log('err in saving debugginglog', err);
    }
    unlinkFile(pfxname);
    throw err;
  }
}
export default PDF;
