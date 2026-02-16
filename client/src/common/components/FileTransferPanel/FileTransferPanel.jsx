import React, { useRef, useState } from "react";
import "./FileTransferPanel.sass";

export default function FileTransferPanel({ serverId }) {
  const fileInputRef = useRef(null);
  const [uploadPath, setUploadPath] = useState("");
  const [downloadPath, setDownloadPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const chooseFile = () => fileInputRef.current?.click();

  const onFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!uploadPath) {
      setMessage("Enter remote upload path first.");
      e.target.value = "";
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("path", uploadPath);

      const res = await fetch(`/api/servers/${serverId}/files/upload`, {
        method: "POST",
        body: form
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage("Upload failed: " + (json.error || res.statusText));
      } else {
        setMessage("Upload successful.");
      }
    } catch (err) {
      console.error(err);
      setMessage("Upload error: " + (err.message || "Unknown error"));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const download = () => {
    if (!downloadPath) {
      setMessage("Enter remote download path.");
      return;
    }

    const a = document.createElement("a");
    a.href = `/api/servers/${serverId}/files/download?path=${encodeURIComponent(
      downloadPath
    )}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="file-transfer-panel">
      <h3>File Transfer</h3>

      <div className="ftp-block">
        <label>Upload to remote path:</label>
        <input
          value={uploadPath}
          onChange={(e) => setUploadPath(e.target.value)}
          placeholder="/tmp/file.txt or C:\\Temp\\file.txt"
        />
        <button disabled={busy} onClick={chooseFile}>
          {busy ? "Uploading…" : "Choose file & upload"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={onFileSelected}
        />
      </div>

      <div className="ftp-block">
        <label>Download remote path:</label>
        <input
          value={downloadPath}
          onChange={(e) => setDownloadPath(e.target.value)}
          placeholder="/var/log/syslog or C:\\Temp\\x.zip"
        />
        <button onClick={download}>Download</button>
      </div>

      {message && <div className="ftp-message">{message}</div>}
    </div>
  );
}