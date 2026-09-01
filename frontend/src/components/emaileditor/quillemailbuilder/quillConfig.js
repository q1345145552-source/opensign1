import { Quill } from "react-quill-new";
import htmlEditButton from "quill-html-edit-button";

// Register modules once
// Quill.register({ "modules/table-better": QuillTableBetter }, true);
Quill.register("modules/htmlEditButton", htmlEditButton, true);

// Size whitelist
const Size = Quill.import("formats/size");
Size.whitelist = ["extra-small", "small", "medium", "large"];
Quill.register(Size, true);

// Font whitelist
const Font = Quill.import("formats/font");
Font.whitelist = [
  "arial",
  "comic-sans",
  "courier-new",
  "georgia",
  "helvetica",
  "lucida"
];
Quill.register(Font, true);

const undoChange = function () {
  this.quill.history.undo();
};

const redoChange = function () {
  this.quill.history.redo();
};

const HISTORY_CONFIG = { delay: 500, maxStack: 100, userOnly: true };

export const createModules = ({ toolbarId }) => ({
  toolbar: {
    container: `#${toolbarId}`,
    handlers: { undo: undoChange, redo: redoChange }
  },
  htmlEditButton: {},
  history: HISTORY_CONFIG
});

export const formats = [
  "header",
  "font",
  "size",
  "bold",
  "italic",
  "underline",
  "strike",
  "script",
  "blockquote",
  "direction",
  "align",
  "background",
  "list",
  "indent",
  "link",
  "image",
  "video",
  "color",
  "formula",
  "code-block"
];
