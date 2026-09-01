import { useTranslation } from "react-i18next";

export default function CellsInput(props) {
  const { t } = useTranslation();
  return (
    <div className="w-full">
      <input
        type="text"
        placeholder={props?.hint || t("widgets-name.text")}
        value={props?.cellsValue ?? ""}  
        onChange={(e) => props?.handleCellsInput(e)}
        className={`${props?.textInputcls} pr-4`}
        onBlur={props?.handleValidation || props?.handleValidation}
        maxLength={props?.count}
      />
    </div>
  );
}
