import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  UploadCloud, 
  Search, 
  Loader2, 
  Calendar, 
  User, 
  Tag, 
  ExternalLink, 
  Copy, 
  CheckCheck, 
  AlertTriangle,
  RefreshCw,
  FileQuestion,
  Fingerprint
} from 'lucide-react';
import { getReadOnlyCertificateContract, computeDocumentHash } from './certificateContracts';

export default function CertificateVerifier({ initialHash = '' }) {
  const [file, setFile] = useState(null);
  const [documentHash, setDocumentHash] = useState(initialHash);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const queryHash = urlParams.get('hash') || (window.location.hash.startsWith('#hash=') ? window.location.hash.replace('#hash=', '') : '');
    
    const targetHash = initialHash || queryHash;
    if (targetHash && targetHash.startsWith('0x') && targetHash.length === 66) {
      setDocumentHash(targetHash);
      handleVerifyHash(targetHash);
    }
  }, [initialHash]);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrorMsg('');
    setVerificationResult(null);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const hash = computeDocumentHash(arrayBuffer);
      setDocumentHash(hash);
      await handleVerifyHash(hash);
    } catch (err) {
      console.error('Failed to calculate document hash', err);
      setErrorMsg('Failed to process file for cryptographic hashing.');
    }
  };

  const handleVerifyHash = async (hashToVerify) => {
    const targetHash = (hashToVerify || documentHash).trim();
    if (!targetHash) {
      setErrorMsg('Please upload a document or enter a valid 32-byte hexadecimal hash.');
      return;
    }

    if (!targetHash.startsWith('0x') || targetHash.length !== 66) {
      setErrorMsg('Invalid hash format. Must be a 32-byte hex string starting with 0x (66 characters).');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');
    setVerificationResult(null);

    try {
      const contract = getReadOnlyCertificateContract();
      const result = await contract.verifyCertificate(targetHash);

      const exists = result[0] ?? result.exists;
      const revoked = result[1] ?? result.revoked;
      const issuer = result[2] ?? result.issuer;
      const recipient = result[3] ?? result.recipient;
      const documentType = result[4] ?? result.documentType;
      const issueDate = result[5] ?? result.issueDate;
      const metadataURI = result[6] ?? result.metadataURI;

      setVerificationResult({
        hash: targetHash,
        exists,
        revoked,
        issuer,
        recipient,
        documentType,
        issueDate: Number(issueDate) * 1000,
        metadataURI,
      });
    } catch (err) {
      console.error('Verification error:', err);
      setErrorMsg(err.message || 'Failed to communicate with the Certificate Registry smart contract.');
    } finally {
      setIsVerifying(false);
    }
  };

  const copyHash = () => {
    if (!documentHash) return;
    navigator.clipboard.writeText(documentHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetVerifier = () => {
    setFile(null);
    setDocumentHash('');
    setVerificationResult(null);
    setErrorMsg('');
  };

  return (
    <div className="space-y-6">
      {/* Formal Header Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-slate-700" />
          <h3 className="text-base font-semibold text-slate-900">Document Verification Portal</h3>
        </div>
        <p className="text-xs text-slate-500">
          Public, trustless verification of document integrity against on-chain records. No wallet required.
        </p>
      </div>

      {/* Main Verification Input Section */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-5">
        {/* Upload File Section */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
            1. Document File Verification
          </label>
          <div className="border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 rounded-lg p-6 text-center transition-colors cursor-pointer relative">
            <input
              type="file"
              id="verifyFileInput"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              disabled={isVerifying}
            />
            <div className="flex flex-col items-center">
              <UploadCloud className="w-6 h-6 text-slate-500 mb-2" />
              <span className="text-sm font-medium text-slate-800">
                {file ? file.name : 'Select or drop document to verify'}
              </span>
              <span className="text-xs text-slate-400 mt-0.5">
                The file remains in your browser; only its cryptographic hash is verified against the ledger
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase">OR</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Manual Hash Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
            2. Direct Keccak-256 Hash
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="0x... (66-character Keccak-256 hex string)"
                value={documentHash}
                onChange={(e) => {
                  setDocumentHash(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded px-3 py-2 text-xs font-mono text-slate-900 outline-none placeholder:text-slate-400"
              />
              {documentHash && (
                <button
                  type="button"
                  onClick={copyHash}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  title="Copy Hash"
                >
                  {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            <button
              onClick={() => handleVerifyHash(documentHash)}
              disabled={isVerifying || !documentHash.trim()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5 shrink-0"
            >
              {isVerifying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              {isVerifying ? 'Checking Ledger...' : 'Verify Hash'}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Verification Result Display */}
      {verificationResult && (
        <div>
          {verificationResult.exists ? (
            verificationResult.revoked ? (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-5 space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span className="font-semibold text-amber-900 text-sm">Certificate Status: Revoked</span>
                </div>
                <p className="text-amber-800">
                  This document hash exists on-chain, but was officially revoked by the issuing authority.
                </p>
                <div className="bg-white border border-amber-200 rounded p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div><strong>Document Type:</strong> {verificationResult.documentType}</div>
                  <div><strong>Recipient:</strong> {verificationResult.recipient}</div>
                  <div><strong>Issuer:</strong> <code className="font-mono text-[11px]">{verificationResult.issuer}</code></div>
                  <div><strong>Issue Date:</strong> {new Date(verificationResult.issueDate).toLocaleDateString()}</div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-emerald-300 rounded-lg p-6 shadow-sm space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
                  <div className="flex items-center gap-2">
                    <CheckCheck className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-950">Document Verified Authentic</h4>
                      <p className="text-slate-500 text-[11px]">Cryptographic fingerprint matches on-chain record.</p>
                    </div>
                  </div>
                  <button
                    onClick={resetVerifier}
                    className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded text-xs font-medium flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reset
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-500 font-medium block">Document Type</span>
                    <span className="text-slate-900 font-semibold text-sm">{verificationResult.documentType}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Recipient</span>
                    <span className="text-slate-900 font-semibold text-sm">{verificationResult.recipient}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 font-medium block">Cryptographic Fingerprint</span>
                    <code className="font-mono text-[11px] text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded block truncate">
                      {verificationResult.hash}
                    </code>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Date Issued</span>
                    <span>{new Date(verificationResult.issueDate).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium block">Issuing Authority</span>
                    <code className="font-mono text-[11px] text-slate-900 block truncate">{verificationResult.issuer}</code>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-5 space-y-2 text-xs text-rose-900">
              <div className="flex items-center gap-2">
                <FileQuestion className="w-5 h-5 text-rose-600 shrink-0" />
                <span className="font-semibold text-sm">No Record Found on Blockchain</span>
              </div>
              <p className="text-rose-800">
                This document fingerprint does not exist in the Certificate Registry. The document may not have been registered, or its contents may have been altered.
              </p>
              <code className="block bg-white border border-rose-200 p-2 rounded font-mono text-[11px] text-rose-800 break-all">
                {verificationResult.hash}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
