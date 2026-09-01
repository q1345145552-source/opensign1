import React, { useId, useMemo } from "react";
import ReactQuill from "react-quill-new";
// import "react-quill-new/dist/quill.snow.css";
import '../../../styles/quill.css'

import QuillToolbar from "./QuillToolbar";
import { createModules, formats } from "./quillConfig";

const QuillEmailEditor = ({
  value = "",
  onChange,
  placeholder = "Write your email...",
  readOnly = false,
  theme = "snow",
  className = "",
  editorClassName = "",
  toolbarId: toolbarIdProp
}) => {
  const reactId = useId();
  const safeId = reactId.replace(/:/g, "");
  const toolbarId = toolbarIdProp || `quill-toolbar-${safeId}`;

  const modules = useMemo(() => createModules({ toolbarId }), [toolbarId]);

  return (
    <div className={`quill-email-editor ${className}`}>
      {!readOnly && <QuillToolbar toolbarId={toolbarId} />}

      <ReactQuill
        theme={theme}
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        readOnly={readOnly}
        placeholder={placeholder}
        className={editorClassName}
      />
    </div>
  );
};

export default React.memo(QuillEmailEditor);
