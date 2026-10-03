import React, { useState } from 'react';
import { ethers } from 'ethers';
import { UploadCloud, CheckCircle2, Loader2, FileText, Lock, ShieldCheck } from 'lucide-react';
import { generateAESKey, encryptFile, wrapKeyForRecipient } from '../utils/crypto';
import { uploadToIPFS } from '../utils/ipfs';
import { getFileRegistryContract } from '../utils/contracts';
import { useRole } from '../context/RoleContext';

export default function UploadFile({ signer, userKeys, onFileUploaded, onConnectWallet, account }) {
  const { role, loading: roleLoading } = useRole();
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState('');

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setTxHash('');
      setStatus('');
    }
  };

  const handleUpload = async () => {
    if (!signer) {
      if (onConnectWallet) onConnectWallet();
      return;
    }
    if (!file || !userKeys) return;
    setIsProcessing(true);
    setStatus('Encrypting file binary client-side (AES-256-GCM)...');

    try {
      // 1. Read file buffer
      const fileBuffer = await file.arrayBuffer();

      // 2. Generate AES key and encrypt file
      const aesKey = await generateAESKey();
      const { ciphertext, iv } = await encryptFile(fileBuffer, aesKey);

      // Pack IV (12 bytes) + Ciphertext into single payload for storage
      const packedBuffer = new Uint8Array(iv.byteLength + ciphertext.byteLength);
      packedBuffer.set(iv, 0);
      packedBuffer.set(new Uint8Array(ciphertext), iv.byteLength);

      // 3. Upload ciphertext to IPFS
      setStatus('Pinning encrypted payload to IPFS (Pinata Cloud)...');
      const ipfsCid = await uploadToIPFS(packedBuffer, file.name);

      // 4. Wrap AES Key for Owner using client ECDH key
      setStatus('Wrapping AES encryption key with owner ECDH public key...');
      const wrappedKeyBytes = await wrapKeyForRecipient(aesKey, userKeys.publicKeyJWK);

      // 5. Generate FileId (SHA-256 of file name + timestamp)
      const fileId = ethers.keccak256(
        ethers.toUtf8Bytes(`${file.name}-${Date.now()}-${file.size}`)
      );

      // 6. Submit registration transaction to FileRegistry.sol
      setStatus('Submitting registerFile transaction on-chain...');
      const contract = getFileRegistryContract(signer);
      const nonce = await signer.getNonce("pending");
      const tx = await contract.registerFile(
        fileId,
        ipfsCid,
        ethers.hexlify(wrappedKeyBytes),
        { nonce }
      );

      setStatus('Awaiting block confirmation...');
      await tx.wait();

      // Store local file metadata (name, size, type, timestamp)
      try {
        const metadata = {
          fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          ipfsCid,
          createdAt: Date.now(),
        };
        const existing = JSON.parse(localStorage.getItem('blockdrive_files_metadata') || '{}');
        existing[fileId.toLowerCase()] = metadata;
        localStorage.setItem('blockdrive_files_metadata', JSON.stringify(existing));

        // Save raw AES key in local keystore
        const rawKey = await window.crypto.subtle.exportKey("raw", aesKey);
        const rawHex = ethers.hexlify(new Uint8Array(rawKey));
        const fileKeys = JSON.parse(localStorage.getItem('blockdrive_file_aes_keys') || '{}');
        fileKeys[fileId.toLowerCase()] = rawHex;
        localStorage.setItem('blockdrive_file_aes_keys', JSON.stringify(fileKeys));
      } catch (metaErr) {
        console.warn('Failed to cache file metadata locally', metaErr);
      }

      setTxHash(tx.hash);
      setStatus('File encrypted, pinned, and registered on-chain.');
      if (onFileUploaded) onFileUploaded();
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message || 'Operation failed'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400 mr-2" />
        <span className="text-sm text-slate-500">Verifying healthcare credentials...</span>
      </div>
    );
  }

  // Strict Healthcare RBAC: Only doctor and medicalStaff can upload files
  if (role !== "doctor" && role !== "medicalStaff") {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm text-center space-y-3">
        <div className="mx-auto w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-1">
          <Lock className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">Access Restricted</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Only verified doctors and medical staff can upload medical records.
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            Patients can access records shared with them in the "Shared With Me" tab.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4 mb-5">
        <h3 className="text-base font-semibold text-slate-900">Encrypted Document Upload</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Files are encrypted locally via AES-256-GCM before transmission. The raw file never leaves your browser unencrypted.
        </p>
      </div>

      <div className="space-y-4">
        {/* Upload Drop Zone */}
        <div className="border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 rounded-lg p-8 text-center transition-colors">
          <input
            type="file"
            id="fileInput"
            className="hidden"
            onChange={handleFileChange}
            disabled={isProcessing}
          />
          <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center">
            <div className="p-3 bg-white rounded-md border border-slate-200 mb-3 text-slate-600 shadow-sm">
              <Lock className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-800">
              {file ? file.name : "Select a document to encrypt and store"}
            </span>
            <span className="text-xs text-slate-500 mt-1">
              Client-side zero-knowledge encryption • IPFS decentralized storage
            </span>
          </label>
        </div>

        {!signer && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center justify-between">
            <span>Ethereum wallet is not connected.</span>
            <button
              onClick={onConnectWallet}
              className="font-semibold underline hover:text-amber-950 ml-2"
            >
              Connect Wallet
            </button>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={isProcessing || (!signer && !onConnectWallet)}
          className={`w-full py-2.5 px-4 font-medium text-xs rounded transition-colors flex items-center justify-center gap-2 ${!signer
              ? 'bg-slate-800 hover:bg-slate-900 text-white'
              : !file
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
            }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing Transaction...</span>
            </>
          ) : !signer ? (
            <>
              <UploadCloud className="w-4 h-4" />
              <span>Connect Wallet to Upload</span>
            </>
          ) : !file ? (
            <span>Select a Document First</span>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>Encrypt & Register on Blockchain</span>
            </>
          )}
        </button>

        {status && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-700">
            {status}
          </div>
        )}

        {txHash && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-mono truncate">Transaction Confirmed: {txHash}</span>
          </div>
        )}
      </div>
    </div>
  );
}
