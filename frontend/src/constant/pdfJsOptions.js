// PDF.js needs the CMaps (and standard font data) to decode CID-keyed fonts,
// which is how most Chinese/CJK PDFs encode their text. Without these options
// such text renders as garbled glyphs or empty boxes (tofu).
//
// These files are bundled locally under /public/pdfjs so that PDF rendering
// never depends on a third-party CDN (which is often unreachable in some
// regions and makes Chinese text show as empty boxes).
export const pdfJsOptions = {
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  // Fall back to the OS/browser fonts for text whose font is not embedded in
  // the PDF (covers CJK PDFs produced without embedded fonts). This only kicks
  // in for fonts with no embedded program, so embedded-font PDFs (including
  // normal English PDFs) are unaffected.
  useSystemFonts: true
};
