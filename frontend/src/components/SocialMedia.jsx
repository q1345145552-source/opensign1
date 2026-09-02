import React from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";

const SocialMedia = () => {
  const { t } = useTranslation();

  return (
    <React.Fragment>
      <NavLink
        to="https://www.linkedin.com/company/opensign%E2%84%A2/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <i aria-hidden="true" className="fa-brands fa-linkedin"></i>
        <span className="fa-sr-only">
          湘泰出海&apos;s {t("social-media.linked-in")}
        </span>
      </NavLink>
      <NavLink
        to="https://www.twitter.com/opensignlabs"
        target="_blank"
        rel="noopener noreferrer"
      >
        <i aria-hidden="true" className="fa-brands fa-square-x-twitter"></i>
        <span className="fa-sr-only">
          湘泰出海&apos;s {t("social-media.twitter")}
        </span>
      </NavLink>
    </React.Fragment>
  );
};

export default SocialMedia;
