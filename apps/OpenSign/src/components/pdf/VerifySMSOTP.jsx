import { useEffect, useState, useRef } from "react";
import Loader from "../../primitives/Loader";
import { useTranslation } from "react-i18next";
import CountryCodeSelect, { hasValidCountryCode } from "../CountryCodeSelect";

const COOLDOWN_SECONDS = 60;

function VerifySMSOTP(props) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const timerRef = useRef(null);

  const {
    setIsVerifyModal,
    setOtpLoader,
    otpLoader,
    showPhoneInput,
    isVerifyModal,
    phoneReadOnly,
    phone,
    countryCode,
    setCountryCode,
    setPhone,
    otp,
    setOtp,
    handleSendSMSOTP,
    handleVerifySMSOTP,
    handleResend,
  } = props;

  const localNumber = phone
    ? phone.replace(countryCode || "", "")
    : "";

  useEffect(() => {
    if (phoneReadOnly && showPhoneInput && phone) {
      handleSend();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCooldown() {
    setErrorMsg("");
    setCountdown(COOLDOWN_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  const handleSend = async () => {
    setErrorMsg("");
    if (!hasValidCountryCode(phone)) {
      setErrorMsg(t("invalid-phone-format"));
      return;
    }
    try {
      const res = await handleSendSMSOTP();
      if (res && typeof res === "string" && res !== "Otp send") {
        setErrorMsg(res);
        return res;
      }
      startCooldown();
      return res;
    } catch (err) {
      setErrorMsg(err?.message || t("something-went-wrong-mssg"));
      return null;
    }
  };

  const handleResendClick = async (e) => {
    e.preventDefault();
    if (countdown > 0) return;
    setErrorMsg("");
    setOtp("");
    try {
      const res = await handleResend(e);
      if (res && typeof res === "string" && res !== "Otp send") {
        setErrorMsg(res);
        return res;
      }
      startCooldown();
      return res;
    } catch (err) {
      setErrorMsg(err?.message || t("something-went-wrong-mssg"));
      return null;
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      await handleVerifySMSOTP(e);
    } catch (err) {
      setErrorMsg(err?.message || t("invalid-otp"));
    }
  };

  return (
    <dialog className="op-modal op-modal-open absolute z-[1999]">
      <div className="md:w-[40%] w-[80%] op-modal-box p-0 overflow-y-auto hide-scrollbar text-sm">
        <h3 className="font-bold text-lg pt-[15px] px-[20px] text-base-content">
          {t("otp-verification")}
        </h3>
        {!showPhoneInput && isVerifyModal ? (
          <form onSubmit={handleVerify}>
            <div className="px-6 py-3 text-base-content">
              <label className="mb-2">{t("enter-otp")}</label>
              {phone && (
                <p className="text-xs text-gray-500 mb-2">
                  {t("otp-sent-to")} <strong>{phone}</strong>
                </p>
              )}
              <input
                onInvalid={(e) =>
                  e.target.setCustomValidity(t("input-required"))
                }
                onInput={(e) => e.target.setCustomValidity("")}
                required
                type="tel"
                pattern="[0-9]{8}"
                className="w-full op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content text-xs"
                placeholder={t("otp-sms-placeholder")}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              {errorMsg && (
                <p className="text-xs text-red-500 mt-1">{errorMsg}</p>
              )}
            </div>
            <div className="px-6 my-3 flex items-center gap-2">
              <button type="submit" className="op-btn op-btn-primary" disabled={otpLoader}>
                {otpLoader ? <Loader /> : t("verify")}
              </button>
              <button
                className="op-btn op-btn-secondary ml-2"
                onClick={handleResendClick}
                disabled={countdown > 0 || otpLoader}
              >
                {countdown > 0
                  ? `${t("resend")} (${countdown}s)`
                  : t("resend")}
              </button>
            </div>
          </form>
        ) : otpLoader ? (
          <div className="h-[150px] flex items-center justify-center">
            <Loader />
          </div>
        ) : (
          <div className="px-6 py-3 text-base-content">
            <p className="mb-2 text-sm">{t("verify-phone")}</p>
            <div className="px-0 mt-3">
              {phoneReadOnly ? (
                <input
                  type="tel"
                  className="w-full op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content text-xs mb-3"
                  value={phone}
                  disabled
                />
              ) : (
                <div className="flex gap-2 items-start mb-3">
                  <CountryCodeSelect
                    value={countryCode || ""}
                    onChange={(code) => setCountryCode(code)}
                  />
                  <input
                    type="tel"
                    className="flex-1 op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content text-xs"
                    placeholder={t("otp-phone-input")}
                    value={localNumber}
                    onChange={(e) =>
                      setPhone((countryCode || "") + e.target.value)
                    }
                  />
                </div>
              )}
              {phoneReadOnly && (
                <p className="text-xs text-gray-500 mb-2">
                  {t("phone-locked")}
                </p>
              )}
              {errorMsg && (
                <p className="text-xs text-red-500 mb-2">{errorMsg}</p>
              )}
              <button
                className="op-btn op-btn-primary"
                type="submit"
                onClick={handleSend}
                disabled={otpLoader}
              >
                {otpLoader ? <Loader /> : t("send-otp")}
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}

export default VerifySMSOTP;
