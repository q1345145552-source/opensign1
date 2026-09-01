import { pdfjs } from "react-pdf";

// PDF.js needs the CMaps (and standard font data) to decode CID-keyed fonts,
// which is how most Chinese/CJK PDFs encode their text. Without these options
// such text renders as garbled glyphs or empty boxes (tofu).
const version = pdfjs.version || "5.4.296";
const baseUrl = `https://unpkg.com/pdfjs-dist@${version}`;

export const pdfJsOptions = {
  cMapUrl: `${baseUrl}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${baseUrl}/standard_fonts/`,
  // Fall back to the OS/browser fonts for text whose font is not embedded in
  // the PDF (covers CJK PDFs produced without embedded fonts). This only kicks
  // in for fonts with no embedded program, so embedded-font PDFs (including
  // normal English PDFs) are unaffected.
  useSystemFonts: true
};
