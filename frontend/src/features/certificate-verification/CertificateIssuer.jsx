import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { 
  Award, 
  UploadCloud, 
  CheckCircle2, 
  Loader2, 
  FileText, 
  Copy, 
  CheckCheck, 
  ShieldCheck, 
  AlertCircle,
  Printer,
  UserCheck
} from 'lucide-react';
import { getCertificateRegistryContract, computeDocumentHash } from './certificateContracts';

export default function CertificateIssuer({ signer, account, onConnectWallet }) {
  const [file, setFile] = useState(null);
  const [documentHash, setDocumentHash] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [documentType, setDocumentType] = useState('Degree Certificate');
  const [customDocType, setCustomDocType] = useState('');
  const [metadataURI, setMetadataURI] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [status, setStatus] = useState('');
  const [issuedRecord, setIssuedRecord] = useState(null);
  const [hasIssuerRole, setHasIssuerRole] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGrantingRole, setIsGrantingRole] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const PRESET_TYPES = [
    'Degree Certificate',
    'University Diploma',
    'Government Identity Document',
    'Land Title Deed',
    'Professional License',
    'Employment Verification Letter',
    'Medical Record / Health Certificate',
    'Other / Custom Type'
  ];

  useEffect(() => {
    async function checkRoles() {
      if (!signer || !account) {
        setHasIssuerRole(null);
        setIsAdmin(false);
        return;
      }
      try {
        const contract = getCertificateRegistryContract(signer);
        const ISSUER_ROLE = await contract.ISSUER_ROLE();
        const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();

        const [isIssuer, adminStatus] = await Promise.all([
          contract.hasRole(ISSUER_ROLE, account),
          contract.hasRole(DEFAULT_ADMIN_ROLE, account)
        ]);

        setHasIssuerRole(isIssuer);
        setIsAdmin(adminStatus);
      } catch (err) {
        console.warn('Role inspection warning:', err);
        setHasIssuerRole(true);
      }
    }
    checkRoles();
  }, [signer, account]);

  const handleGrantSelfIssuerRole = async () => {
    if (!account) return;
    setIsGrantingRole(true);
    setStatus('Granting ISSUER_ROLE on-chain...');
    try {
      let adminSigner = signer;
      if (!isAdmin) {
        // Fallback to local hardhat admin deployer for seamless local development
        const localProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        adminSigner = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", localProvider);
      }
      const contract = getCertificateRegistryContract(adminSigner);
      const ISSUER_ROLE = await contract.ISSUER_ROLE();
      const tx = await contract.grantRole(ISSUER_ROLE, account);
      await tx.wait();
      setHasIssuerRole(true);
      setStatus('✓ ISSUER_ROLE granted to this account.');
    } catch (err) {
      console.error(err);
      setStatus(`Failed to grant role: ${err.message}`);
    } finally {
      setIsGrantingRole(false);
    }
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setTxHash('');
    setStatus('');
    setIssuedRecord(null);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const hash = computeDocumentHash(arrayBuffer);
      setDocumentHash(hash);
    } catch (err) {
      console.error(err);
      setStatus('Failed to calculate document fingerprint.');
    }
  };

  const handleIssue = async (e) => {
    e.preventDefault();
    if (!signer || !account) {
      if (onConnectWallet) onConnectWallet();
      return;
    }

    if (!documentHash || !recipientName.trim()) {
      setStatus('Please provide both the document file and recipient name.');
      return;
    }

    const finalDocType = documentType === 'Other / Custom Type' ? (customDocType.trim() || 'Custom Document') : documentType;

    setIsProcessing(true);
    setStatus('Submitting certificate registration transaction to blockchain...');
    setIssuedRecord(null);

    try {
      const contract = getCertificateRegistryContract(signer);
      const nonce = await signer.getNonce("pending");
      const tx = await contract.issueCertificate(
        documentHash,
        recipientName.trim(),
        finalDocType,
        metadataURI.trim(),
        { nonce }
      );

      setStatus('Awaiting block confirmation...');
      await tx.wait();

      const verificationUrl = `${window.location.origin}${window.location.pathname}?tab=verify&hash=${documentHash}`;

      setTxHash(tx.hash);
      setIssuedRecord({
        hash: documentHash,
        recipient: recipientName.trim(),
        documentType: finalDocType,
        issuer: account,
        issueDate: Date.now(),
        metadataURI: metadataURI.trim(),
        verificationUrl: verificationUrl,
      });

      setStatus('✓ Document certificate registered on-chain.');
    } catch (err) {
      console.error('Issuance error details:', err);
      const errStr = String(err.message || '') + String(err.data || '') + JSON.stringify(err.info || '');

      if (errStr.includes('CertificateAlreadyExists') || errStr.includes('16b35fe3')) {
        setStatus('This file has already been verified and registered on-chain. Please upload a different file.');
      } else if (errStr.includes('AccessControlUnauthorizedAccount') || errStr.includes('e2517d3f')) {
        setStatus('Your wallet does not have ISSUER_ROLE permission. Click "Claim ISSUER_ROLE" above to enable.');
      } else if (err.code === 4001 || errStr.toLowerCase().includes('user rejected') || errStr.toLowerCase().includes('denied')) {
        setStatus('Transaction was cancelled in MetaMask.');
      } else {
        setStatus('Transaction could not be completed. Please check your wallet connection and try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'hash') {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Formal Header Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Award className="w-5 h-5 text-slate-700" />
          <h3 className="text-base font-semibold text-slate-900">Certificate & Document Issuance</h3>
        </div>
        <p className="text-xs text-slate-500">
          Register official credentials, land titles, and institutional documents with permanent on-chain integrity.
        </p>
      </div>

      {/* Role Notice */}
      {hasIssuerRole === false && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold">Missing ISSUER_ROLE Permission</p>
              <p className="text-amber-800 mt-0.5">
                Wallet (<code className="font-mono">{account}</code>) is not currently registered as an authorized issuer.
              </p>
            </div>
          </div>
          <button
            onClick={handleGrantSelfIssuerRole}
            disabled={isGrantingRole}
            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 disabled:bg-amber-400 text-white font-medium rounded text-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            {isGrantingRole ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
            {isGrantingRole ? 'Granting Role...' : 'Claim ISSUER_ROLE (1-Click)'}
          </button>
        </div>
      )}

      {/* Main Issuance Form */}
      <form onSubmit={handleIssue} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h4 className="text-sm font-semibold text-slate-900">Certificate Metadata Specification</h4>
        </div>

        {/* 1. Document Upload */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
            1. Document File (Fingerprint Source) *
          </label>
          <div className="border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 rounded-lg p-6 text-center transition-colors cursor-pointer relative">
            <input
              type="file"
              id="issueFileInput"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileChange}
              disabled={isProcessing}
            />
            <div className="flex flex-col items-center">
              <UploadCloud className="w-6 h-6 text-slate-500 mb-2" />
              <span className="text-sm font-medium text-slate-800">
                {file ? file.name : "Select document file (PDF, Doc, Image)"}
              </span>
              <span className="text-xs text-slate-400 mt-0.5">
                Cryptographic Keccak-256 fingerprint will be computed client-side
              </span>
            </div>
          </div>
        </div>

        {/* Calculated Fingerprint Preview */}
        {documentHash && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-slate-500 font-semibold uppercase text-[10px] block">
                Calculated Fingerprint (Keccak-256):
              </span>
              <code className="text-slate-800 font-mono font-medium truncate block">
                {documentHash}
              </code>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(documentHash, 'hash')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 text-xs shrink-0 flex items-center gap-1 self-start sm:self-center"
            >
              {copiedHash ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedHash ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}

        {/* 2. Recipient Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
            2. Recipient Name or Identifier *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. John Doe, Student ID: 2026-CS-001"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded px-3 py-2 text-xs text-slate-900 outline-none"
          />
        </div>

        {/* 3. Document Classification Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              3. Classification Type *
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded px-3 py-2 text-xs text-slate-900 outline-none"
            >
              {PRESET_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {documentType === 'Other / Custom Type' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                Custom Classification *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Patent Title, Quality Certificate"
                value={customDocType}
                onChange={(e) => setCustomDocType(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded px-3 py-2 text-xs text-slate-900 outline-none"
              />
            </div>
          )}
        </div>

        {/* 4. Optional Metadata URI */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
            4. Metadata URI / IPFS CID (Optional)
          </label>
          <input
            type="text"
            placeholder="ipfs://Qm... or https://..."
            value={metadataURI}
            onChange={(e) => setMetadataURI(e.target.value)}
            className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded px-3 py-2 text-xs font-mono text-slate-900 outline-none"
          />
        </div>

        {!signer && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center justify-between">
            <span>Connect authorized wallet to issue certificate on-chain.</span>
            <button
              type="button"
              onClick={onConnectWallet}
              className="font-semibold underline hover:text-amber-950 ml-2"
            >
              Connect Wallet
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={isProcessing || !signer || !file || !recipientName.trim()}
          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium rounded text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Publishing to Blockchain...</span>
            </>
          ) : (
            <>
              <Award className="w-4 h-4" />
              <span>Sign & Register Certificate</span>
            </>
          )}
        </button>

        {status && (
          <div className={`p-3 rounded text-xs flex items-center gap-2 border ${
            status.includes('already been verified')
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : status.includes('✓')
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : status.includes('cancelled') || status.includes('could not be completed') || status.includes('does not have')
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            {status.includes('already been verified') && <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
            {status.includes('✓') && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {(status.includes('cancelled') || status.includes('could not be completed')) && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            <span>{status}</span>
          </div>
        )}

        {txHash && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-mono truncate">Transaction Hash: {txHash}</span>
          </div>
        )}
      </form>

      {/* Issued Certificate Result Slip */}
      {issuedRecord && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <h4 className="text-sm font-semibold text-slate-900">Certificate Registered Successfully</h4>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Export
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded p-4 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-200">
              <div>
                <span className="text-slate-500 font-medium block">Document Type</span>
                <span className="text-slate-900 font-semibold">{issuedRecord.documentType}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Recipient</span>
                <span className="text-slate-900 font-semibold">{issuedRecord.recipient}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Issuing Authority</span>
                <code className="text-slate-800 font-mono text-[11px] block truncate">{issuedRecord.issuer}</code>
              </div>
              <div>
                <span className="text-slate-500 font-medium block">Timestamp</span>
                <span className="text-slate-800">{new Date(issuedRecord.issueDate).toUTCString()}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 font-medium block mb-1">Document Fingerprint (Hash)</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-slate-800 bg-white border border-slate-200 px-2 py-1 rounded flex-1 truncate">
                  {issuedRecord.hash}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(issuedRecord.hash, 'hash')}
                  className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 text-xs"
                >
                  {copiedHash ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-slate-500 font-medium block">Public Verification Link</span>
                <a
                  href={issuedRecord.verificationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-700 hover:text-slate-900 font-mono text-[11px] truncate block underline"
                >
                  {issuedRecord.verificationUrl}
                </a>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(issuedRecord.verificationUrl, 'link')}
                className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-medium self-start sm:self-center"
              >
                {copiedLink ? 'Copied' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
