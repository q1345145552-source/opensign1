import EmailBodyEditor from "../EmailBodyEditor";
import { QuillEmailEditor } from "./quillemailbuilder";

const EmailEditor = ({
  type = "basic",
  values = {},
  onChange,
  placeholder = "add body of email",
  bodyName,
  isReset,
  isTemplateLoaded,
  smallscreen
}) => {
  const currentValue = values[type] ?? "";
  const handleChange = (newValue) => {
    onChange?.(newValue, type);
  };

  if (type === "advanced") {
    return (
      <EmailBodyEditor
        value={currentValue}
        onChange={handleChange}
        bodyName={bodyName}
        isReset={isReset}
        isTemplateLoaded={isTemplateLoaded}
        smallscreen={smallscreen}
      />
    );
  }

  return (
    <QuillEmailEditor
      value={currentValue}
      onChange={handleChange}
      placeholder={placeholder}
    />
  );
};

export default EmailEditor;
