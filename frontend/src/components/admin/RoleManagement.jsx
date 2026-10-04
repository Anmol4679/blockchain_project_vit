import React, { useState } from 'react';
import { ethers } from 'ethers';
import { ShieldCheck, UserPlus, UserMinus, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { useRole } from '../../context/RoleContext';
import {
  onboardDoctor,
  onboardMedicalStaff,
  onboardPatient,
  revokeHealthcareRole,
  getAccessControlContract,
  isLocalNodeAlive
} from '../../utils/contracts';

export default function RoleManagement({ signer, account }) {
  const { role, refreshRole } = useRole();
  const [targetAddress, setTargetAddress] = useState(account || '');
  const [selectedRole, setSelectedRole] = useState('doctor');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [isClaimingAdmin, setIsClaimingAdmin] = useState(false);

  const getAdminSigner = async () => {
    try {
      const alive = await isLocalNodeAlive();
      if (alive) {
        const localProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        return new ethers.Wallet(
          "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
          localProvider
        );
      }
      return signer;
    } catch {
      return signer;
    }
  };

  const parseContractError = (err) => {
    const errStr = String(err?.message || '') + String(err?.data || '') + JSON.stringify(err?.info || '');
    if (errStr.includes('0xe2517d3f') || errStr.includes('AccessControlUnauthorizedAccount')) {
      return "Unauthorized: Connected wallet is not an Admin. Click 'Claim Admin Permission' above or switch to an Admin wallet.";
    }
    if (errStr.includes('InvalidAddress') || errStr.includes('0xe6c4247b')) {
      return "Invalid Ethereum address provided.";
    }
    if (err?.code === 4001 || errStr.toLowerCase().includes('user rejected') || errStr.toLowerCase().includes('denied')) {
      return "Transaction was cancelled in MetaMask.";
    }
    if (errStr.includes('insufficient funds')) {
      return "Insufficient ETH balance for gas fees.";
    }
    return err?.reason || err?.message || "Transaction failed. Please check permissions and try again.";
  };

  // 1-Click Role Switcher for the connected wallet
  const handleSelfOnboardRole = async (roleName) => {
    if (!account) return;
    setIsProcessing(true);
    setError('');
    setStatus(`Changing role to ${roleName}...`);
    try {
      const activeAdmin = role === 'admin' ? signer : await getAdminSigner();

      // Revoke any previous healthcare roles first to ensure clean state
      try {
        await revokeHealthcareRole(activeAdmin, account, 'patient');
      } catch {}
      try {
        await revokeHealthcareRole(activeAdmin, account, 'doctor');
      } catch {}
      try {
        await revokeHealthcareRole(activeAdmin, account, 'medicalStaff');
      } catch {}

      // Assign the requested role
      if (roleName === 'doctor') {
        await onboardDoctor(activeAdmin, account);
      } else if (roleName === 'medicalStaff') {
        await onboardMedicalStaff(activeAdmin, account);
      } else if (roleName === 'patient') {
        await onboardPatient(activeAdmin, account);
      }

      setStatus(`✓ Successfully changed ${account} to ${roleName.toUpperCase()}`);
      if (refreshRole) await refreshRole();
    } catch (err) {
      console.error(err);
      setError(parseContractError(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Claim Admin Permission
  const handleClaimAdmin = async () => {
    if (!account) {
      setError('Please connect your wallet first.');
      return;
    }
    setIsClaimingAdmin(true);
    setStatus('Granting Admin role on blockchain...');
    setError('');
    try {
      const activeAdmin = await getAdminSigner();
      const contract = getAccessControlContract(activeAdmin);
      const adminRole = await contract.DEFAULT_ADMIN_ROLE();
      const tx = await contract.grantRole(adminRole, account);
      await tx.wait();

      setStatus(`✓ Successfully granted Admin role to ${account}`);
      if (refreshRole) await refreshRole();
    } catch (err) {
      console.error(err);
      setError(parseContractError(err));
    } finally {
      setIsClaimingAdmin(false);
    }
  };

  // Onboard any target address from form
  const handleOnboard = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    setTxHash('');

    const trimmedAddress = targetAddress.trim();
    if (!ethers.isAddress(trimmedAddress)) {
      setError('Please provide a valid Ethereum wallet address.');
      return;
    }

    setIsProcessing(true);
    setStatus(`Updating role to ${selectedRole} for ${trimmedAddress}...`);

    try {
      const activeAdmin = role === 'admin' ? signer : await getAdminSigner();

      // Revoke conflicting roles first
      try {
        await revokeHealthcareRole(activeAdmin, trimmedAddress, 'patient');
      } catch {}
      try {
        await revokeHealthcareRole(activeAdmin, trimmedAddress, 'doctor');
      } catch {}
      try {
        await revokeHealthcareRole(activeAdmin, trimmedAddress, 'medicalStaff');
      } catch {}

      let receipt;
      if (selectedRole === 'doctor') {
        receipt = await onboardDoctor(activeAdmin, trimmedAddress);
      } else if (selectedRole === 'medicalStaff') {
        receipt = await onboardMedicalStaff(activeAdmin, trimmedAddress);
      } else if (selectedRole === 'patient') {
        receipt = await onboardPatient(activeAdmin, trimmedAddress);
      }

      setTxHash(receipt?.hash || receipt?.transactionHash || '');
      setStatus(`✓ Successfully assigned ${selectedRole.toUpperCase()} role to ${trimmedAddress}`);
      if (refreshRole) await refreshRole();
    } catch (err) {
      console.error('Role onboarding error:', err);
      setError(parseContractError(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Revoke role
  const handleRevoke = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    setTxHash('');

    const trimmedAddress = targetAddress.trim();
    if (!ethers.isAddress(trimmedAddress)) {
      setError('Please provide a valid Ethereum wallet address.');
      return;
    }

    setIsProcessing(true);
    setStatus(`Revoking ${selectedRole} role from ${trimmedAddress}...`);

    try {
      const activeAdmin = role === 'admin' ? signer : await getAdminSigner();
      const receipt = await revokeHealthcareRole(activeAdmin, trimmedAddress, selectedRole);
      setTxHash(receipt?.hash || receipt?.transactionHash || '');
      setStatus(`✓ Successfully revoked ${selectedRole.toUpperCase()} role from ${trimmedAddress}`);
      if (refreshRole) await refreshRole();
    } catch (err) {
      console.error('Role revocation error:', err);
      setError(parseContractError(err));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Role Switcher Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-lg p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-semibold">Quick Role Switcher (1-Click)</h4>
            </div>
            <p className="text-xs text-slate-300">
              Instantly assign healthcare credentials to your connected wallet (<code className="font-mono text-amber-300">{account || "No wallet connected"}</code>).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelfOnboardRole('doctor')}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded text-xs font-medium transition-colors shadow-sm"
            >
              + Make Me Doctor
            </button>
            <button
              type="button"
              onClick={() => handleSelfOnboardRole('medicalStaff')}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded text-xs font-medium transition-colors shadow-sm"
            >
              + Make Me Staff
            </button>
            <button
              type="button"
              onClick={() => handleSelfOnboardRole('patient')}
              disabled={isProcessing}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded text-xs font-medium transition-colors shadow-sm"
            >
              + Make Me Patient
            </button>
            <button
              type="button"
              onClick={handleClaimAdmin}
              disabled={isClaimingAdmin}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded text-xs font-medium transition-colors shadow-sm"
            >
              {isClaimingAdmin ? "Granting Admin..." : "+ Make Me Admin"}
            </button>
          </div>
        </div>
      </div>

      {/* Main Role Management Form */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-5">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-semibold text-slate-900">Healthcare Role Management</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Administrator panel to onboard verified doctors, medical staff, and patients, or revoke healthcare permissions.
          </p>
        </div>

        {role !== "admin" && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Current wallet is not registered as Admin on the contract.</span>
            </div>
            <button
              type="button"
              onClick={handleClaimAdmin}
              disabled={isClaimingAdmin}
              className="font-semibold underline hover:text-amber-950 ml-2"
            >
              {isClaimingAdmin ? "Claiming..." : "Claim Admin Permission"}
            </button>
          </div>
        )}

        <form className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Wallet Address *
            </label>
            <input
              type="text"
              required
              placeholder="0x..."
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              disabled={isProcessing}
              className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded px-3 py-2 text-xs font-mono text-slate-900 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
              Healthcare Role *
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              disabled={isProcessing}
              className="w-full bg-white border border-slate-300 focus:border-slate-500 rounded px-3 py-2 text-xs text-slate-900 outline-none"
            >
              <option value="doctor">Doctor</option>
              <option value="medicalStaff">Medical Staff</option>
              <option value="patient">Patient</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleOnboard}
              disabled={isProcessing || !targetAddress.trim()}
              className="w-full sm:w-auto flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium rounded text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Onboard / Assign Role</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleRevoke}
              disabled={isProcessing || !targetAddress.trim()}
              className="w-full sm:w-auto py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-medium rounded text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <UserMinus className="w-4 h-4" />
              <span>Revoke Role</span>
            </button>
          </div>

          {status && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{status}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {txHash && (
            <div className="p-3 bg-slate-50 border border-slate-200 text-slate-700 rounded text-xs flex items-center gap-2 font-mono truncate">
              <span className="font-semibold text-slate-500">TX:</span>
              <span className="truncate">{txHash}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
