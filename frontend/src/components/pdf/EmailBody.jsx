import Tooltip from "../../primitives/Tooltip";
import { useTranslation } from "react-i18next";
import EmailEditor from "../emaileditor";

export function EmailBody(props) {
  const { t } = useTranslation();
  return (
    <form className="flex flex-col text-base-content text-lg font-normal">
      <div className="m-2 md:m-10 p-3 md:p-10 shadow-md hover:shadow-lg border-[1px] border-indigo-800 rounded-md">
        <label className="text-sm ml-2">
          {t("subject")} <Tooltip message={t("email-subject")} />
        </label>
        <input
          required
          onInvalid={(e) => e.target.setCustomValidity(t("input-required"))}
          onInput={(e) => e.target.setCustomValidity("")}
          value={props.requestSubject}
          onChange={(e) => props?.onChangeSubject?.(e.target.value)}
          placeholder='${senderName} has requested you to sign "${documentName}"'
          className="op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content w-full text-xs"
        />
        <label className="flex justify-between text-sm ml-2 mt-3">
          <span>
            {t("body")} <Tooltip message={t("email-body")} />
          </span>
          <button
            className="op-link op-link-primary"
            onClick={(e) => props?.handleSwitch(e)}
          >
            {props?.emailEditorType === "basic"
              ? t("switch-to-advanced")
              : t("switch-to-basic")}
          </button>
        </label>
        <div className="px-1 py-2 w-full focus:outline-none text-xs">
          <EmailEditor
            type={props?.emailEditorType}
            values={props.requestBody}
            onChange={props?.onChangeBody}
            isReset={props?.isReset}
            smallscreen
          />
        </div>
      </div>
    </form>
  );
}
