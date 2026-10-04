import React, { useState } from 'react';
import { ethers } from 'ethers';
import { Wallet, ShieldCheck, AlertCircle, RefreshCw, Loader2, UserCheck, Copy, Check } from 'lucide-react';
import { useRole } from '../context/RoleContext';
import {
  onboardDoctor,
  onboardMedicalStaff,
  onboardPatient,
  revokeHealthcareRole,
  isLocalNodeAlive
} from '../utils/contracts';

export default function WalletConnect({
  account,
  onConnect,
  isConnecting,
  error,
  chainId,
  onSwitchNetwork
}) {
  const isLocalOrSepolia = chainId === "0x7a69" || chainId === "0xaa36a7" || chainId === "31337" || chainId === "11155111";
  const { role, refreshRole } = useRole();
  const [isSwitching, setIsSwitching] = useState(false);
  const [copied, setCopied] = useState(false);

  const getRoleBadge = (roleName) => {
    switch (roleName) {
      case 'doctor':
        return {
          label: 'Doctor',
          classes: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      case 'medicalStaff':
        return {
          label: 'Medical Staff',
          classes: 'bg-teal-50 text-teal-700 border-teal-200',
        };
      case 'patient':
        return {
          label: 'Patient',
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'unregistered':
      default:
        return {
          label: 'Unregistered',
          classes: 'bg-slate-100 text-slate-600 border-slate-200',
        };
    }
  };

  const roleBadge = getRoleBadge(role);

  const handleCopy = () => {
    if (!account) return;
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  const handleSwitchRole = async (targetRole) => {
    if (!account) return;
    setIsSwitching(true);
    const cleanAccount = account.toLowerCase();

    // 1. Immediately persist chosen role override locally so role changes immediately in UI
    localStorage.setItem(`blockdrive_role_override_${cleanAccount}`, targetRole);

    // 2. Refresh role context state immediately
    if (refreshRole) {
      await refreshRole();
    }

    // 3. Attempt on-chain registration in background if local test node is active
    try {
      const isAlive = await isLocalNodeAlive();
      if (isAlive) {
        const localProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        const adminSigner = new ethers.Wallet(
          "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
          localProvider
        );
      
      // Ensure test account has ETH
      try {
        await adminSigner.sendTransaction({
          to: account,
          value: ethers.parseEther("2.0")
        });
      } catch {}

      // Clean conflicting roles to maintain role exclusivity
      try { await revokeHealthcareRole(adminSigner, account, 'patient'); } catch {}
      try { await revokeHealthcareRole(adminSigner, account, 'doctor'); } catch {}
      try { await revokeHealthcareRole(adminSigner, account, 'medicalStaff'); } catch {}

      if (targetRole === 'doctor') {
        await onboardDoctor(adminSigner, account);
      } else if (targetRole === 'medicalStaff') {
        await onboardMedicalStaff(adminSigner, account);
      } else if (targetRole === 'patient') {
        await onboardPatient(adminSigner, account);
      }
    }
  } catch (err) {
    console.warn("On-chain role registration skipped (node offline or custom network), role set active in UI:", err.message);
  } finally {
    if (refreshRole) await refreshRole();
    setIsSwitching(false);
  }
};

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="p-2.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200 shrink-0 transition-transform duration-150 hover:scale-105">
          <Wallet className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-slate-900 uppercase tracking-wide">Web3 Wallet Interface</h2>
            {account && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Connected
              </span>
            )}
          </div>
          <div className="text-xs text-slate-600 mt-1">
            {account ? (
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-slate-400 font-medium">Account:</span>
                <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 hover:border-slate-300 transition-colors">
                  <span className="font-mono font-medium text-slate-800 text-xs select-all">
                    {formatAddress(account)}
                  </span>
                  <button
                    onClick={handleCopy}
                    title="Copy full wallet address"
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all duration-150 active:scale-90 cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600 transition-transform duration-150 scale-110" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 hover:scale-110 transition-transform" />
                    )}
                  </button>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${roleBadge.classes}`}>
                  {roleBadge.label}
                </span>
              </div>
            ) : (
              "Connect an authorized Ethereum wallet to sign and verify records."
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
        {/* 1-Click Role Switcher for Testing */}
        {account && (
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded p-1">
            <span className="text-[10px] uppercase font-semibold text-slate-400 px-1.5 hidden sm:inline">Role:</span>
            <button
              onClick={() => handleSwitchRole('doctor')}
              disabled={isSwitching || role === 'doctor'}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all duration-150 cursor-pointer active:scale-95 ${
                role === 'doctor'
                  ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Doctor
            </button>
            <button
              onClick={() => handleSwitchRole('medicalStaff')}
              disabled={isSwitching || role === 'medicalStaff'}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all duration-150 cursor-pointer active:scale-95 ${
                role === 'medicalStaff'
                  ? 'bg-teal-600 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Medical Staff
            </button>
            <button
              onClick={() => handleSwitchRole('patient')}
              disabled={isSwitching || role === 'patient'}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all duration-150 cursor-pointer active:scale-95 ${
                role === 'patient'
                  ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              Patient
            </button>
          </div>
        )}

        {account && !isLocalOrSepolia && (
          <button
            onClick={onSwitchNetwork}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-medium rounded transition-all duration-150 shadow-2xs cursor-pointer"
          >
            Switch to Localhost
          </button>
        )}

        {account ? (
          <button
            onClick={onConnect}
            title="Request account switch in MetaMask"
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 hover:border-slate-300 active:scale-95 text-slate-700 border border-slate-200 rounded text-xs font-medium transition-all duration-150 flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500 transition-transform duration-200 group-hover:rotate-180" />
            Switch Account
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 disabled:bg-slate-300 text-white text-xs font-medium rounded shadow-xs transition-all duration-150 flex items-center gap-2 cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5" />
            {isConnecting ? "Connecting..." : "Connect MetaMask"}
          </button>
        )}
      </div>

      {error && (
        <div className="w-full mt-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
