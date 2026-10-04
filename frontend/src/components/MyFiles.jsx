import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  Folder,
  UserPlus,
  Check,
  Loader2,
  FileText,
  Copy,
  CheckCheck,
  Calendar,
  HardDrive,
  Edit2,
  Check as CheckIcon,
  X as XIcon,
  Users,
  UserMinus,
  ShieldCheck,
  KeyRound,
  AlertCircle
} from 'lucide-react';
import { getFileRegistryContract } from '../utils/contracts';
import { wrapKeyForRecipient, unwrapKeyForRecipient, importRawKey } from '../utils/crypto';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function MyFiles({ signer, account, userKeys }) {
  const [files, setFiles] = useState([]);
  const [fileDetails, setFileDetails] = useState({});
  const [loading, setLoading] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientPubKeyJWK, setRecipientPubKeyJWK] = useState('');
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [authStatus, setAuthStatus] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editNameValue, setEditNameValue] = useState('');

  // Authorized recipients per selected file
  const [activeRecipients, setActiveRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [revokingAddress, setRevokingAddress] = useState(null);

  const loadFiles = async () => {
    if (!signer || !account) return;
    setLoading(true);
    try {
      const contract = getFileRegistryContract(signer);
      const rawFileIds = await contract.getFilesByOwner(account);
      const fileIds = Array.from(rawFileIds || []);
      setFiles(fileIds);

      // Load cached metadata from localStorage
      const cachedMeta = JSON.parse(localStorage.getItem('blockdrive_files_metadata') || '{}');

      // Load on-chain record for each file
      const details = {};
      for (const id of fileIds) {
        const idLower = id.toLowerCase();
        let meta = cachedMeta[idLower] || cachedMeta[id] || null;

        try {
          const record = await contract.getFileRecord(id);
          const createdAtTimestamp = Number(record.createdAt) * 1000;

          if (!meta) {
            meta = {
              name: `Document_${id.substring(2, 8)}.enc`,
              size: 245000,
              ipfsCid: record.ipfsCid,
              createdAt: createdAtTimestamp || Date.now(),
            };
          } else {
            meta.ipfsCid = record.ipfsCid;
            meta.createdAt = meta.createdAt || createdAtTimestamp;
          }
        } catch (recordErr) {
          console.warn(`Could not load record for ${id}`, recordErr);
        }

        details[id] = meta || {
          name: `Document_${id.substring(2, 8)}.enc`,
          size: 150000,
          createdAt: Date.now(),
        };
      }
      setFileDetails(details);
    } catch (err) {
      console.error('Failed to load owned files', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [signer, account]);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartRename = (fileId, currentName) => {
    setEditingId(fileId);
    setEditNameValue(currentName);
  };

  const handleSaveRename = (fileId) => {
    if (!editNameValue.trim()) {
      setEditingId(null);
      return;
    }
    const updatedName = editNameValue.trim();
    const updatedDetails = { ...fileDetails };
    if (!updatedDetails[fileId]) updatedDetails[fileId] = {};
    updatedDetails[fileId].name = updatedName;
    setFileDetails(updatedDetails);

    try {
      const cachedMeta = JSON.parse(localStorage.getItem('blockdrive_files_metadata') || '{}');
      const idLower = fileId.toLowerCase();
      cachedMeta[idLower] = {
        ...(cachedMeta[idLower] || {}),
        name: updatedName,
        fileId: fileId,
      };
      localStorage.setItem('blockdrive_files_metadata', JSON.stringify(cachedMeta));
    } catch (err) {
      console.error('Error saving renamed file to localStorage', err);
    }

    setEditingId(null);
  };

  const handleOpenAccessModal = async (fileId) => {
    setSelectedFileId(fileId);
    setAuthStatus('');
    setRecipientAddress('');
    setRecipientPubKeyJWK('');
    setLoadingRecipients(true);

    try {
      const contract = getFileRegistryContract(signer);
      let recipients = [];
      try {
        recipients = await contract.getFileRecipients(fileId);
      } catch (e) {
        console.warn('getFileRecipients helper failed:', e);
      }

      const activeList = [];
      for (const rec of recipients) {
        if (rec.toLowerCase() === account.toLowerCase()) continue;
        const isAuth = await contract.isAuthorized(rec, fileId);
        if (isAuth) {
          activeList.push(rec);
        }
      }
      setActiveRecipients(activeList);
    } catch (err) {
      console.error('Failed to load file recipients', err);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const handleGrantAccess = async (fileId) => {
    if (!recipientAddress || !signer) return;
    setIsSubmittingAuth(true);
    setAuthStatus('Locating file AES key...');

    try {
      const contract = getFileRegistryContract(signer);
      const cleanRecipient = recipientAddress.trim().toLowerCase();

      let fileAesKey = null;
      const cachedFileKeys = JSON.parse(localStorage.getItem('blockdrive_file_aes_keys') || '{}');
      const rawHex = cachedFileKeys[fileId.toLowerCase()];

      if (rawHex) {
        const rawBytes = ethers.getBytes(rawHex);
        fileAesKey = await importRawKey(rawBytes);
      } else {
        const record = await contract.getFileRecord(fileId);
        if (record.callerWrappedKey && record.callerWrappedKey !== '0x' && userKeys?.privateKeyJWK) {
          const wrappedBytes = ethers.getBytes(record.callerWrappedKey);
          fileAesKey = await unwrapKeyForRecipient(wrappedBytes, userKeys.privateKeyJWK);
        }
      }

      if (!fileAesKey) {
        fileAesKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
      }

      let targetJWK = null;
      if (recipientPubKeyJWK.trim()) {
        try {
          targetJWK = JSON.parse(recipientPubKeyJWK.trim());
        } catch {
          throw new Error('Invalid JSON format for Recipient Public Key JWK.');
        }
      } else {
        const pubRegistry = JSON.parse(localStorage.getItem('blockdrive_public_ecdh_registry') || '{}');
        if (pubRegistry[cleanRecipient]) {
          targetJWK = pubRegistry[cleanRecipient];
        } else {
          const savedRecipientKeys = localStorage.getItem(`blockdrive_ecdh_keys_${cleanRecipient}`);
          if (savedRecipientKeys) {
            const parsed = JSON.parse(savedRecipientKeys);
            targetJWK = parsed.publicKeyJWK;
          } else {
            const genKeyPair = await window.crypto.subtle.generateKey(
              { name: "ECDH", namedCurve: "P-256" },
              true,
              ["deriveKey"]
            );
            const pub = await window.crypto.subtle.exportKey("jwk", genKeyPair.publicKey);
            const priv = await window.crypto.subtle.exportKey("jwk", genKeyPair.privateKey);
            const newKeys = { publicKeyJWK: pub, privateKeyJWK: priv };
            localStorage.setItem(`blockdrive_ecdh_keys_${cleanRecipient}`, JSON.stringify(newKeys));
            pubRegistry[cleanRecipient] = pub;
            localStorage.setItem('blockdrive_public_ecdh_registry', JSON.stringify(pubRegistry));
            targetJWK = pub;
          }
        }
      }

      setAuthStatus('Re-wrapping AES key for recipient...');
      const wrappedBytes = await wrapKeyForRecipient(fileAesKey, targetJWK);

      setAuthStatus('Submitting addAuthorizedRecipient on-chain...');
      const nonce = await signer.getNonce("pending");
      const tx = await contract.addAuthorizedRecipient(
        fileId,
        recipientAddress.trim(),
        ethers.hexlify(wrappedBytes),
        { nonce }
      );
      await tx.wait();

      try {
        const rawKey = await window.crypto.subtle.exportKey("raw", fileAesKey);
        const hex = ethers.hexlify(new Uint8Array(rawKey));
        cachedFileKeys[fileId.toLowerCase()] = hex;
        localStorage.setItem('blockdrive_file_aes_keys', JSON.stringify(cachedFileKeys));
      } catch (cacheErr) {
        console.warn('Cache key warning:', cacheErr);
      }

      setAuthStatus('✓ Recipient authorization confirmed on-chain.');

      if (!activeRecipients.includes(recipientAddress.trim())) {
        setActiveRecipients(prev => [...prev, recipientAddress.trim()]);
      }
      setRecipientAddress('');
      setRecipientPubKeyJWK('');
    } catch (err) {
      console.error(err);
      setAuthStatus(`Error: ${err.message || 'Authorization failed'}`);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleRevokeAccess = async (fileId, targetAddress) => {
    if (!signer || !fileId || !targetAddress) return;
    setRevokingAddress(targetAddress);
    setAuthStatus(`Submitting revocation on-chain...`);

    try {
      const contract = getFileRegistryContract(signer);
      const nonce = await signer.getNonce("pending");
      const tx = await contract.revokeRecipient(fileId, targetAddress, { nonce });
      await tx.wait();
      setAuthStatus(`✓ Access revoked for ${targetAddress.substring(0, 8)}...`);
      setActiveRecipients(prev => prev.filter(a => a.toLowerCase() !== targetAddress.toLowerCase()));
    } catch (err) {
      console.error('Revocation failed', err);
      setAuthStatus(`Revocation error: ${err.message}`);
    } finally {
      setRevokingAddress(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Registered Documents</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Documents registered on-chain by your active wallet address.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 font-medium rounded border border-slate-200">
            {files.length} {files.length === 1 ? 'Record' : 'Records'}
          </span>
          <button
            onClick={loadFiles}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-200 font-medium transition-colors flex items-center gap-1.5"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/50 rounded border border-dashed border-slate-200 p-6">
          <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-800">No Registered Files Found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Your connected wallet (<code className="font-mono text-slate-700">{account ? `${account.substring(0, 6)}...${account.substring(account.length - 4)}` : '0x...'}</code>) has not registered any documents yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((fileId) => {
            const meta = fileDetails[fileId] || {};
            const fileName = meta.name || `Document_${fileId.substring(2, 8)}.enc`;
            const fileSize = meta.size ? formatBytes(meta.size) : 'Encrypted Blob';
            const uploadDate = meta.createdAt ? new Date(meta.createdAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : 'Just now';

            const isEditing = editingId === fileId;

            return (
              <div
                key={fileId}
                className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all duration-150 shadow-2xs hover:shadow-xs"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="p-2 bg-white text-slate-700 rounded-md border border-slate-200 shrink-0 mt-0.5 transition-transform duration-150 hover:scale-105">
                    <FileText className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="text"
                          value={editNameValue}
                          onChange={(e) => setEditNameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(fileId);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 rounded-md text-slate-900 outline-none transition-all"
                        />
                        <button
                          onClick={() => handleSaveRename(fileId)}
                          className="p-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs cursor-pointer active:scale-90 transition-all"
                          title="Save Name"
                        >
                          <CheckIcon className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-xs cursor-pointer active:scale-90 transition-all"
                          title="Cancel"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <h4 className="text-sm font-semibold text-slate-900 truncate" title={fileName}>
                          {fileName}
                        </h4>
                        <button
                          onClick={() => handleStartRename(fileId, fileName)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition-all cursor-pointer active:scale-90"
                          title="Rename label"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1 font-medium text-slate-600">
                        <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                        {fileSize}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {uploadDate}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase">File ID:</span>
                      <code className="text-xs font-mono text-slate-800 bg-white border border-slate-200 px-1.5 py-0.5 rounded select-all">
                        {fileId.substring(0, 10)}...{fileId.substring(fileId.length - 8)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(fileId, fileId)}
                        title="Copy full File ID"
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all cursor-pointer active:scale-90"
                      >
                        {copiedId === fileId ? (
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 self-end md:self-center">
                  <button
                    onClick={() => handleOpenAccessModal(fileId)}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-50 hover:border-slate-400 text-slate-700 border border-slate-300 rounded-md text-xs font-medium transition-all duration-150 flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs hover:shadow-xs"
                  >
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>Manage Access</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Share & Manage Access Drawer / Modal */}
      {selectedFileId && (
        <div className="mt-6 p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">
                Access Authorization: <span className="font-normal text-slate-600">{fileDetails[selectedFileId]?.name || selectedFileId}</span>
              </h4>
            </div>
            <button
              onClick={() => setSelectedFileId(null)}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              ✕ Close
            </button>
          </div>

          <div>
            <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Authorized Recipients ({activeRecipients.length})
            </h5>

            {loadingRecipients ? (
              <div className="p-3 bg-white border border-slate-200 rounded text-xs text-slate-500 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading authorized addresses...
              </div>
            ) : activeRecipients.length === 0 ? (
              <div className="p-3 bg-white border border-slate-200 rounded text-xs text-slate-500">
                No external recipients authorized. Only the owner wallet can decrypt this file.
              </div>
            ) : (
              <div className="space-y-2">
                {activeRecipients.map((recAddress) => (
                  <div
                    key={recAddress}
                    className="p-2.5 bg-white border border-slate-200 rounded flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-slate-800">{recAddress}</span>
                    </div>
                    <button
                      onClick={() => handleRevokeAccess(selectedFileId, recAddress)}
                      disabled={revokingAddress === recAddress}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-sans font-medium flex items-center gap-1 transition-colors"
                    >
                      {revokingAddress === recAddress ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <UserMinus className="w-3 h-3" />
                      )}
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-3">
            <h5 className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-slate-600" /> Authorize New Recipient
            </h5>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Recipient Wallet Address
              </label>
              <input
                type="text"
                placeholder="0x..."
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded px-3 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Recipient Public Key JWK (Optional — auto-generated if left blank)
              </label>
              <textarea
                placeholder='{"crv":"P-256","ext":true,"key_ops":[],"kty":"EC","x":"...","y":"..."}'
                rows={2}
                value={recipientPubKeyJWK}
                onChange={(e) => setRecipientPubKeyJWK(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded px-3 py-2 text-xs font-mono text-slate-800 placeholder:text-slate-400 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleGrantAccess(selectedFileId)}
                disabled={isSubmittingAuth || !recipientAddress.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                {isSubmittingAuth ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {isSubmittingAuth ? 'Authorizing On-Chain...' : 'Grant Access'}
              </button>
              <button
                onClick={() => setSelectedFileId(null)}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

          {authStatus && (
            <div className="p-2.5 bg-white border border-slate-200 rounded text-xs font-mono text-slate-800">
              {authStatus}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
