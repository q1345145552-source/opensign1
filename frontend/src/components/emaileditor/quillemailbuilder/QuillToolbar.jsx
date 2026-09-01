import React from "react";

const CustomUndo = () => (
  <svg viewBox="0 0 18 18">
    <polygon className="ql-fill ql-stroke" points="6 10 4 12 2 10 6 10" />
    <path
      className="ql-stroke"
      d="M8.09,13.91A4.6,4.6,0,0,0,9,14,5,5,0,1,0,4,9"
    />
  </svg>
);

const CustomRedo = () => (
  <svg viewBox="0 0 18 18">
    <polygon className="ql-fill ql-stroke" points="12 10 14 12 16 10 12 10" />
    <path
      className="ql-stroke"
      d="M9.91,13.91A4.6,4.6,0,0,1,9,14a5,5,0,1,1,5-5"
    />
  </svg>
);

const QuillToolbar = ({ toolbarId }) => {
  return (
    <div id={toolbarId}>
      <span className="ql-formats">
        <select className="ql-font" defaultValue="arial">
          <option value="arial">Arial</option>
          <option value="comic-sans">Comic Sans</option>
          <option value="courier-new">Courier New</option>
          <option value="georgia">Georgia</option>
          <option value="helvetica">Helvetica</option>
          <option value="lucida">Lucida</option>
        </select>

        <select className="ql-size" defaultValue="medium">
          <option value="extra-small">Size 1</option>
          <option value="small">Size 2</option>
          <option value="medium">Size 3</option>
          <option value="large">Size 4</option>
        </select>

        <select className="ql-header" defaultValue="">
          <option value="1">Heading</option>
          <option value="2">Subheading</option>
          <option value="3">Normal</option>
        </select>
      </span>

      <span className="ql-formats">
        <button className="ql-bold" type="button" />
        <button className="ql-italic" type="button" />
        <button className="ql-underline" type="button" />
        <button className="ql-strike" type="button" />
      </span>

      <span className="ql-formats">
        <button className="ql-list" value="ordered" type="button" />
        <button className="ql-list" value="bullet" type="button" />
        <button className="ql-indent" value="-1" type="button" />
        <button className="ql-indent" value="+1" type="button" />
      </span>

      <span className="ql-formats">
        <button className="ql-script" value="super" type="button" />
        <button className="ql-script" value="sub" type="button" />
        <button className="ql-blockquote" type="button" />
        <button className="ql-direction" type="button" />
      </span>

      <span className="ql-formats">
        <select className="ql-align" />
        <select className="ql-color" />
        <select className="ql-background" />
      </span>

      <span className="ql-formats">
        <button className="ql-link" type="button" />
        <button className="ql-image" type="button" />
        <button className="ql-video" type="button" />
        <button className="ql-formula" type="button" />
        <button className="ql-code-block" type="button" />
        <button className="ql-clean" type="button" />
      </span>

      <span className="ql-formats">
        <button className="ql-undo" type="button">
          <CustomUndo />
        </button>
        <button className="ql-redo" type="button">
          <CustomRedo />
        </button>
      </span>
    </div>
  );
};

export default React.memo(QuillToolbar);
