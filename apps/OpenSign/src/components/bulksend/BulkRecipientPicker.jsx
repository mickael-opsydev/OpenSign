import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { emailRegex } from "../../constant/const";
import { generateId } from "../../constant/Utils";

const normalizeEmail = (email) => (email || "").toLowerCase().replace(/\s/g, "");

const parseLine = (line) => {
  const raw = line.trim();
  if (!raw) return null;
  let email = "";
  let name = "";
  let phone = "";
  const angle = raw.match(/^(.*)<([^>]+)>$/);
  if (angle) {
    name = angle[1].trim().replace(/[",;]+$/g, "").trim();
    email = angle[2].trim();
  } else {
    const parts = raw.split(/[,;\t]/).map((p) => p.trim()).filter(Boolean);
    const emailPart = parts.find((p) => emailRegex.test(p));
    email = emailPart || parts[0] || "";
    const rest = parts.filter((p) => p !== email);
    name = rest.find((p) => !/^\+?[\d\s().-]{6,}$/.test(p)) || "";
    phone = rest.find((p) => /^\+?[\d\s().-]{6,}$/.test(p)) || "";
  }
  if (!email) return null;
  return { Name: name, Email: email, Phone: phone };
};

const fetchContacts = async (search) => {
  const baseURL = localStorage.getItem("baseUrl");
  const url = `${baseURL}functions/getsigners`;
  const headers = {
    "Content-Type": "application/json",
    "X-Parse-Application-Id": localStorage.getItem("parseAppId"),
    "X-Parse-Session-Token": localStorage.getItem("accesstoken")
  };
  const axiosRes = await axios.post(url, { search: search || "" }, { headers });
  return axiosRes?.data?.result || [];
};

const BulkRecipientPicker = (props) => {
  const { t } = useTranslation();
  const { recipients, setRecipients } = props;
  const [tab, setTab] = useState("contacts");
  const [pasteValue, setPasteValue] = useState("");
  const [error, setError] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState([]);
  const [contactLoading, setContactLoading] = useState(false);
  const debounceRef = useRef(null);

  const loadContacts = async (search) => {
    setContactLoading(true);
    try {
      const res = await fetchContacts(search);
      setContactResults(res);
    } catch (err) {
      console.log("err loading contacts", err);
      setContactResults([]);
    } finally {
      setContactLoading(false);
    }
  };

  useEffect(() => {
    loadContacts("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadContacts(contactSearch);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactSearch]);

  const isAdded = (email) =>
    recipients.some((r) => normalizeEmail(r.Email) === normalizeEmail(email));

  const addRecipients = (incoming) => {
    setError("");
    setRecipients((prev) => {
      const seen = new Set(prev.map((r) => normalizeEmail(r.Email)));
      const next = [...prev];
      let added = 0;
      for (const item of incoming) {
        const email = normalizeEmail(item.Email);
        if (!email || !emailRegex.test(email) || seen.has(email)) continue;
        seen.add(email);
        next.push({
          id: generateId(8),
          Name: item.Name || "",
          Email: email,
          Phone: item.Phone || "",
          objectId: item.objectId || "",
          contact: item.contact || null
        });
        added += 1;
      }
      if (added === 0) setError(t("bulk-no-new-recipients"));
      return next;
    });
  };

  const removeRecipient = (id) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const addContact = (contact) => {
    addRecipients([
      {
        Name: contact.Name || "",
        Email: contact.Email || "",
        Phone: contact.Phone || "",
        objectId: contact.objectId,
        contact
      }
    ]);
  };

  const addAllContacts = () => {
    addRecipients(
      contactResults.map((c) => ({
        Name: c.Name || "",
        Email: c.Email || "",
        Phone: c.Phone || "",
        objectId: c.objectId,
        contact: c
      }))
    );
  };

  const handlePasteAdd = () => {
    const lines = pasteValue.split(/\r?\n/);
    const parsed = lines.map(parseLine).filter(Boolean);
    if (parsed.length === 0) {
      setError(t("bulk-no-valid-emails"));
      return;
    }
    addRecipients(parsed);
    setPasteValue("");
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || "");
      const rows = text.split(/\r?\n/).filter((r) => r.trim());
      if (rows.length === 0) {
        setError(t("bulk-no-valid-emails"));
        return;
      }
      let dataRows = rows;
      const header = rows[0].toLowerCase();
      const hasHeader =
        header.includes("email") || header.includes("name") || header.includes("phone");
      let emailIdx = 0;
      let nameIdx = 1;
      let phoneIdx = 2;
      if (hasHeader) {
        const cols = rows[0].split(/[,;\t]/).map((c) => c.trim().toLowerCase());
        emailIdx = cols.findIndex((c) => c.includes("email"));
        nameIdx = cols.findIndex((c) => c.includes("name"));
        phoneIdx = cols.findIndex((c) => c.includes("phone"));
        dataRows = rows.slice(1);
      }
      const parsed = dataRows
        .map((row) => {
          const cols = row.split(/[,;\t]/).map((c) => c.trim());
          const emailCol =
            emailIdx >= 0 ? cols[emailIdx] : cols.find((c) => emailRegex.test(c));
          if (!emailCol) return null;
          return {
            Name: nameIdx >= 0 ? cols[nameIdx] || "" : "",
            Email: emailCol,
            Phone: phoneIdx >= 0 ? cols[phoneIdx] || "" : ""
          };
        })
        .filter(Boolean);
      if (parsed.length === 0) {
        setError(t("bulk-no-valid-emails"));
      } else {
        addRecipients(parsed);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const tabs = [
    { key: "contacts", label: t("choose-from-contacts"), icon: "fa-light fa-address-book" },
    { key: "paste", label: t("bulk-paste-emails"), icon: "fa-light fa-paste" },
    { key: "csv", label: t("bulk-import-csv"), icon: "fa-light fa-file-csv" }
  ];

  return (
    <div className="px-4 py-2" id="bulkRecipientPicker">
      <div className="flex flex-wrap gap-2 border-b mb-3">
        {tabs.map((it) => (
          <button
            key={it.key}
            type="button"
            onClick={() => {
              setTab(it.key);
              setError("");
            }}
            className={`px-3 py-2 text-sm font-semibold focus:outline-none ${
              tab === it.key
                ? "border-b-2 border-primary text-primary"
                : "text-base-content opacity-70"
            }`}
          >
            <i className={`${it.icon} mr-1`}></i>
            {it.label}
          </button>
        ))}
      </div>

      {tab === "contacts" && (
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <i className="fa-light fa-magnifying-glass absolute left-2 top-1/2 -translate-y-1/2 text-[12px] opacity-60"></i>
              <input
                type="text"
                className="op-input op-input-bordered op-input-sm w-full text-[13px] pl-7"
                placeholder={t("search-contacts") || t("choose-from-contacts")}
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
              />
            </div>
            {contactResults.length > 0 && (
              <button
                type="button"
                className="op-btn op-btn-ghost op-btn-sm whitespace-nowrap"
                onClick={addAllContacts}
              >
                {t("add-all") || "Add all"}
              </button>
            )}
          </div>
          <div className="max-h-[200px] overflow-auto border rounded-md">
            {contactLoading ? (
              <p className="text-[12px] opacity-60 p-3">{t("loading")}</p>
            ) : contactResults.length === 0 ? (
              <p className="text-[12px] opacity-60 p-3">{t("contact-not-found")}</p>
            ) : (
              <ul className="divide-y">
                {contactResults.map((c) => {
                  const added = isAdded(c.Email);
                  return (
                    <li
                      key={c.objectId}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-[13px] font-medium truncate">
                          {c.Name || c.Email}
                        </span>
                        <span className="text-[11px] opacity-70 truncate">{c.Email}</span>
                      </div>
                      <button
                        type="button"
                        disabled={added}
                        onClick={() => addContact(c)}
                        className={`op-btn op-btn-xs ${
                          added ? "op-btn-ghost opacity-60" : "op-btn-primary"
                        }`}
                      >
                        {added ? (
                          <>
                            <i className="fa-light fa-check mr-1"></i>
                            {t("added") || "Added"}
                          </>
                        ) : (
                          <>
                            <i className="fa-light fa-plus mr-1"></i>
                            {t("add")}
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "paste" && (
        <div className="mb-2">
          <textarea
            className="op-textarea op-textarea-bordered w-full text-sm"
            rows={5}
            placeholder={t("bulk-paste-placeholder")}
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
          />
          <button
            type="button"
            className="op-btn op-btn-primary op-btn-sm mt-2"
            onClick={handlePasteAdd}
          >
            <i className="fa-light fa-plus mr-1"></i>
            {t("add")}
          </button>
        </div>
      )}

      {tab === "csv" && (
        <div className="mb-2">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvUpload}
            className="op-file-input op-file-input-bordered op-file-input-sm w-full"
          />
          <p className="text-[11px] opacity-70 mt-1">{t("bulk-csv-hint")}</p>
        </div>
      )}

      {error && <p className="text-[red] text-[12px] my-1">{error}</p>}

      <div className="mt-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-bold">
            {t("recipients")} ({recipients.length})
          </span>
          {recipients.length > 0 && (
            <button
              type="button"
              className="op-link op-link-primary text-[12px]"
              onClick={() => setRecipients([])}
            >
              {t("clear-all") || "Clear all"}
            </button>
          )}
        </div>
        <div className="max-h-[180px] overflow-auto border rounded-md">
          {recipients.length === 0 ? (
            <p className="text-[12px] opacity-60 p-3">{t("bulk-no-recipients-yet")}</p>
          ) : (
            <ul className="divide-y">
              {recipients.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-[13px] font-medium">{r.Name || r.Email}</span>
                    <span className="text-[11px] opacity-70">
                      {r.Email}
                      {r.Phone ? ` · ${r.Phone}` : ""}
                      {r.objectId ? "" : ` · ${t("guest") || "guest"}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="op-btn op-btn-ghost op-btn-xs"
                    onClick={() => removeRecipient(r.id)}
                  >
                    <i className="fa-light fa-trash-can text-[red]"></i>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkRecipientPicker;
