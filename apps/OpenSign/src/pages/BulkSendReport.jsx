import { useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import Loader from "../primitives/Loader";

const statusStyles = {
  signed: "op-badge-success",
  declined: "op-badge-error",
  viewed: "op-badge-info",
  waiting: "op-badge-warning"
};

const callFunction = async (name, params = {}) => {
  const baseURL = localStorage.getItem("baseUrl");
  const headers = {
    "Content-Type": "application/json",
    "X-Parse-Application-Id": localStorage.getItem("parseAppId"),
    "X-Parse-Session-Token": localStorage.getItem("accesstoken")
  };
  const res = await axios.post(`${baseURL}functions/${name}`, params, { headers });
  return res?.data?.result;
};

const formatDate = (value) => {
  if (!value) return "-";
  try {
    const d = typeof value === "object" && value.iso ? new Date(value.iso) : new Date(value);
    return d.toLocaleString();
  } catch (err) {
    return "-";
  }
};

const BulkSendReport = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const loadCampaigns = async () => {
    setIsLoading(true);
    setError("");
    try {
      const list = await callFunction("getbulksendlist");
      if (Array.isArray(list)) {
        setCampaigns(list);
      } else {
        setError(list?.error || t("something-went-wrong-mssg"));
      }
    } catch (err) {
      setError(err?.response?.data?.error || t("something-went-wrong-mssg"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (campaign) => {
    setSelected(campaign);
    setDetail(null);
    setIsDetailLoading(true);
    try {
      const res = await callFunction("getbulksendreport", { token: campaign.Token });
      if (res && !res.error) {
        setDetail(res);
      } else {
        setError(res?.error || t("something-went-wrong-mssg"));
      }
    } catch (err) {
      setError(err?.response?.data?.error || t("something-went-wrong-mssg"));
    } finally {
      setIsDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setDetail(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[300px]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-2 md:p-4">
      <div className="op-card bg-base-100 shadow rounded-box p-3 md:p-5">
        {!selected ? (
          <>
            <h2 className="text-lg font-semibold mb-3">{t("bulk-sends")}</h2>
            {error && <p className="text-[red] text-sm mb-2">{error}</p>}
            {campaigns.length === 0 ? (
              <p className="text-sm opacity-70 py-6 text-center">{t("bulk-no-campaigns")}</p>
            ) : (
              <div className="overflow-auto">
                <table className="op-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>{t("title")}</th>
                      <th>{t("sent-date") || "Sent"}</th>
                      <th className="text-center">{t("recipients")}</th>
                      <th className="text-center">{t("signed-status") || "Signed"}</th>
                      <th className="text-center">{t("pending") || "Pending"}</th>
                      <th className="text-center">{t("declined") || "Declined"}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.objectId}>
                        <td className="font-medium">{c.Name}</td>
                        <td>{formatDate(c.createdAt)}</td>
                        <td className="text-center">{c.total}</td>
                        <td className="text-center text-[green] font-semibold">{c.signed}</td>
                        <td className="text-center">{c.pending}</td>
                        <td className="text-center text-[red]">{c.declined}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="op-btn op-btn-primary op-btn-xs"
                            onClick={() => openDetail(c)}
                          >
                            <i className="fa-light fa-eye mr-1"></i>
                            {t("view") || "View"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <button
                type="button"
                className="op-btn op-btn-ghost op-btn-sm"
                onClick={closeDetail}
              >
                <i className="fa-light fa-arrow-left mr-1"></i>
                {t("back") || "Back"}
              </button>
              <h2 className="text-lg font-semibold">{selected.Name}</h2>
            </div>
            {isDetailLoading ? (
              <div className="flex justify-center items-center h-[200px]">
                <Loader />
              </div>
            ) : detail ? (
              <div className="overflow-auto">
                <table className="op-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>{t("name") || "Name"}</th>
                      <th>{t("email") || "Email"}</th>
                      <th className="text-center">{t("status") || "Status"}</th>
                      <th>{t("signed-date") || "Signed on"}</th>
                      <th className="text-center">{t("certificate") || "Certificate"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.recipients.map((r) => (
                      <tr key={r.objectId}>
                        <td className="font-medium">{r.signerName || "-"}</td>
                        <td>{r.signerEmail}</td>
                        <td className="text-center">
                          <span className={`op-badge ${statusStyles[r.status] || "op-badge-ghost"}`}>
                            {t(`bulk-status-${r.status}`)}
                          </span>
                        </td>
                        <td>{formatDate(r.signedAt)}</td>
                        <td className="text-center">
                          {r.CertificateUrl ? (
                            <a
                              href={r.CertificateUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="op-link op-link-primary"
                            >
                              <i className="fa-light fa-download"></i>
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm opacity-70">{error || t("something-went-wrong-mssg")}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BulkSendReport;
