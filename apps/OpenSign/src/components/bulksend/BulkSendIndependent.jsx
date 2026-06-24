import { useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import Loader from "../../primitives/Loader";
import { hasSignatureWidget, normalizeKey } from "../../utils";
import BulkRecipientPicker from "./BulkRecipientPicker";

const BulkSendIndependent = (props) => {
  const { t } = useTranslation();
  const { Placeholders = [], item = {}, signatureType, sourceType = "template" } = props;
  const [recipients, setRecipients] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState(null);

  const signerRoles = useMemo(
    () => (Placeholders || []).filter((p) => p?.Role !== "prefill"),
    [Placeholders]
  );

  const singleRole = signerRoles.length === 1 ? signerRoles[0] : null;
  const signatureOk = singleRole ? hasSignatureWidget(singleRole) : false;

  const buildDocuments = () => {
    const pdfUrl = item?.URL || item?.SignedUrl;
    return recipients.map((r) => {
      const updatedPlaceholders = (Placeholders || []).map((ph) => {
        if (ph?.Role === "prefill") return ph;
        if (singleRole && ph?.Id === singleRole?.Id) {
          if (r.objectId && r.contact) {
            return {
              ...ph,
              email: normalizeKey(r.Email),
              signerObjId: r.objectId,
              signerPtr: r.contact,
              signerName: r.Name || "",
              signerPhone: r.Phone || ""
            };
          }
          return {
            ...ph,
            email: normalizeKey(r.Email),
            signerObjId: "",
            signerPtr: {},
            signerName: r.Name || "",
            signerPhone: r.Phone || ""
          };
        }
        return ph;
      });
      const signers = r.objectId && r.contact ? [r.contact] : [];
      const doc = {
        ...item,
        URL: pdfUrl,
        SignedUrl: pdfUrl,
        Placeholders: updatedPlaceholders,
        SignatureType: signatureType,
        Signers: signers,
        SendinOrder: false
      };
      if (sourceType !== "template") {
        delete doc.objectId;
      }
      return doc;
    });
  };

  const handleSend = async () => {
    if (recipients.length === 0) {
      setResult({ status: "failed", message: t("bulk-no-recipients-yet") });
      return;
    }
    setIsSending(true);
    setResult(null);
    try {
      const Documents = buildDocuments();
      const functionsUrl = `${localStorage.getItem("baseUrl")}functions/batchdocuments`;
      const headers = {
        "Content-Type": "application/json",
        "X-Parse-Application-Id": localStorage.getItem("parseAppId"),
        "X-Parse-Session-Token": localStorage.getItem("accesstoken"),
        sessiontoken: localStorage.getItem("accesstoken"),
        public_url: window.location.origin,
        type: "bulksend"
      };
      const res = await axios.post(
        functionsUrl,
        { Documents: JSON.stringify(Documents) },
        { headers }
      );
      const data = res?.data?.result;
      if (data) {
        setResult({
          status: data.failed > 0 ? "partial" : "success",
          total: data.total,
          created: data.created,
          failed: data.failed,
          token: data.bulkSendToken
        });
        if (props.onSuccess) props.onSuccess(data);
      } else {
        setResult({ status: "failed", message: t("something-went-wrong-mssg") });
      }
    } catch (err) {
      const message =
        err?.response?.data?.error || err?.message || t("something-went-wrong-mssg");
      setResult({ status: "failed", message });
    } finally {
      setIsSending(false);
    }
  };

  if (!singleRole) {
    return (
      <div className="text-black p-4 bg-white w-full text-sm flex justify-center items-center">
        {t("bulk-single-signer-only")}
      </div>
    );
  }

  if (!signatureOk) {
    return (
      <div className="text-black p-4 bg-white w-full text-sm flex justify-center items-center">
        {t("quick-send-alert-2")}
      </div>
    );
  }

  if (result && (result.status === "success" || result.status === "partial")) {
    return (
      <div className="p-6 text-center">
        <i className="fa-light fa-circle-check text-[40px] text-[green]"></i>
        <p className="mt-3 font-semibold">
          {t("bulk-send-summary", {
            created: result.created,
            total: result.total
          })}
        </p>
        {result.failed > 0 && (
          <p className="text-[red] text-sm mt-1">
            {t("bulk-send-failed-count", { failed: result.failed })}
          </p>
        )}
        <button
          type="button"
          className="op-btn op-btn-primary op-btn-sm mt-4"
          onClick={() => props.handleClose && props.handleClose("success", result.created)}
        >
          {t("close") || "Close"}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="border-t mt-2" />
      <BulkRecipientPicker recipients={recipients} setRecipients={setRecipients} />
      {result?.status === "failed" && (
        <p className="text-[red] text-[12px] px-4">{result.message}</p>
      )}
      <div className="flex flex-row flex-wrap pb-3 pt-2 px-4 gap-3 justify-center items-center border-t mt-2">
        {isSending ? (
          <Loader />
        ) : (
          <button
            type="button"
            disabled={recipients.length === 0}
            onClick={handleSend}
            className="op-btn op-btn-primary w-[180px] focus:outline-none disabled:opacity-50"
          >
            <i className="fa-light fa-paper-plane mr-1"></i>
            <span>
              {t("send")}
              {recipients.length > 0 ? ` (${recipients.length})` : ""}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default BulkSendIndependent;
