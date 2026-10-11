import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../../utils/supabaseClient';
import { useRole } from '../../context/RoleContext';
import {
  onboardDoctor,
  onboardMedicalStaff,
  onboardPatient,
  revokeHealthcareRole,
  isLocalNodeAlive,
  checkAddressRole,
  getAccessControlContract
} from '../../utils/contracts';

// Isolated provisioning client that will NOT overwrite the logged-in admin session
const provisionerAuthClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

export const DEFAULT_HEALTHCARE_PROFILES = [
  {
    id: 'prof_admin_01',
    email: 'aryanraghuwanshi1822@gmail.com',
    full_name: 'Aryan Raghuwanshi (System Admin)',
    role: 'admin',
    wallet_address: '0x341DF0D8f0304E5A74dd5dDA166FAc47BC1dC5de',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'prof_doc_01',
    email: 'arisbestiiii@gmail.com',
    full_name: 'Dr. Aris (Cardiology Lead)',
    role: 'doctor',
    wallet_address: '0x341DF0D8f0304E5A74dd5dDA166FAc47BC1dC5de',
    created_at: new Date(Date.now() - 86400000 * 1.5).toISOString(),
  },
  {
    id: 'prof_doc_02',
    email: 'dr.chen@blockdrive.health',
    full_name: 'Dr. Wei Chen (Neurology)',
    role: 'doctor',
    wallet_address: '0x945e0D2b1A54b4C107297e6e589882200fBA6AD7',
    created_at: new Date(Date.now() - 86400000 * 1.2).toISOString(),
  },
  {
    id: 'prof_staff_01',
    email: 'records.nurse@blockdrive.health',
    full_name: 'Sarah Miller (Clinical Archivist)',
    role: 'medicalStaff',
    wallet_address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    created_at: new Date(Date.now() - 86400000 * 0.8).toISOString(),
  },
  {
    id: 'prof_pat_01',
    email: 'patient.d5f@blockdrive.health',
    full_name: 'Alex Morgan (Patient)',
    role: 'patient',
    wallet_address: '0xd5F9725B66A06210547D0c9c2dF99fDd19342B97',
    created_at: new Date(Date.now() - 86400000 * 0.4).toISOString(),
  },
  {
    id: 'prof_pat_02',
    email: 'patient.eb6@blockdrive.health',
    full_name: 'Robert Taylor (Patient)',
    role: 'patient',
    wallet_address: '0xeb633150ac2E56FbA7c950C64bd388040690B85B',
    created_at: new Date(Date.now() - 86400000 * 0.2).toISOString(),
  }
];

export const saveProfilesToStorage = (updated) => {
  try {
    localStorage.setItem('blockdrive_user_profiles', JSON.stringify(updated));
    localStorage.setItem('blockdrive_admin_profiles', JSON.stringify(updated));
  } catch (e) {
    console.warn('Storage save warning:', e);
  }
};

export default function RoleManagement({ signer, account }) {
  const { role: onChainRole, refreshRole } = useRole();

  // Active Admin Sub-tab: 'directory' | 'create' | 'blockchain'
  const [activeAdminView, setActiveAdminView] = useState('directory');

  // Supabase Users Directory State
  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Editing Profile / Record in Table State
  const [editingProfile, setEditingProfile] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    role: 'doctor',
    wallet_address: '',
    syncOnChain: true
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editMessage, setEditMessage] = useState({ text: '', type: '' });

  // New User Form State
  const [newUserRole, setNewUserRole] = useState('doctor');
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserWallet, setNewUserWallet] = useState(account || '');
  const [newUserWalletRole, setNewUserWalletRole] = useState('unregistered');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createMessage, setCreateMessage] = useState({ text: '', type: '' });
  const [lastCreatedCredentials, setLastCreatedCredentials] = useState(null);

  // Blockchain Onboarding State (Tab 3 & Quick Box)
  const [targetAddress, setTargetAddress] = useState(account || '');
  const [targetAddressStatus, setTargetAddressStatus] = useState('unregistered');
  const [blockchainRole, setBlockchainRole] = useState('doctor');
  const [isContractProcessing, setIsContractProcessing] = useState(false);
  const [contractStatus, setContractStatus] = useState('');
  const [contractError, setContractError] = useState('');

  // UI helpers
  const [copiedKey, setCopiedKey] = useState('');

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  // Helper to query on-chain role of an address
  const fetchAddressRole = useCallback(async (address, setter) => {
    if (!address || !ethers.isAddress(address)) {
      setter('unregistered');
      return;
    }
    try {
      const role = await checkAddressRole(address);
      setter(role);
    } catch {
      setter('unregistered');
    }
  }, []);

  // Check role of newUserWallet when changed
  useEffect(() => {
    if (newUserWallet && ethers.isAddress(newUserWallet)) {
      fetchAddressRole(newUserWallet, setNewUserWalletRole);
    } else {
      setNewUserWalletRole('unregistered');
    }
  }, [newUserWallet, fetchAddressRole]);

  // Check role of targetAddress when changed
  useEffect(() => {
    if (targetAddress && ethers.isAddress(targetAddress)) {
      fetchAddressRole(targetAddress, setTargetAddressStatus);
    } else {
      setTargetAddressStatus('unregistered');
    }
  }, [targetAddress, fetchAddressRole]);

  // Generate a randomized, secure temporary password
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let generated = '';
    for (let i = 0; i < 12; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUserPassword(generated);
  };

  // Fetch all profiles from storage and Supabase
  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      let combined = [];
      const stored = localStorage.getItem('blockdrive_admin_profiles') || localStorage.getItem('blockdrive_user_profiles');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            combined = parsed;
          }
        } catch {}
      }

      // If empty, initialize with default system profiles
      if (!combined || combined.length === 0) {
        combined = [...DEFAULT_HEALTHCARE_PROFILES];
        saveProfilesToStorage(combined);
      }

      // Ensure connected account has a record if valid address and not yet present
      if (account && ethers.isAddress(account)) {
        const hasAccount = combined.some(p => p.wallet_address && p.wallet_address.toLowerCase() === account.toLowerCase());
        if (!hasAccount) {
          const newAdminRec = {
            id: `prof_curr_${Date.now()}`,
            email: 'admin@blockdrive.health',
            full_name: 'Administrator (Connected)',
            role: 'admin',
            wallet_address: account,
            created_at: new Date().toISOString()
          };
          combined = [newAdminRec, ...combined];
          saveProfilesToStorage(combined);
        }
      }

      // Try fetching from Supabase if online and merge
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const map = new Map();
          combined.forEach(p => map.set(p.email?.toLowerCase() || p.id, p));
          data.forEach(p => map.set(p.email?.toLowerCase() || p.id, { ...map.get(p.email?.toLowerCase() || p.id), ...p }));
          combined = Array.from(map.values());
          saveProfilesToStorage(combined);
        }
      } catch (err) {
        console.warn('Supabase profiles query note:', err);
      }

      setProfiles(combined);
    } catch (err) {
      console.warn('Profiles load error:', err);
    } finally {
      setLoadingProfiles(false);
    }
  }, [account]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleStartEdit = (profile) => {
    setEditingProfile(profile);
    setEditForm({
      full_name: profile.full_name || '',
      role: profile.role || 'doctor',
      wallet_address: profile.wallet_address || '',
      syncOnChain: true
    });
    setEditMessage({ text: '', type: '' });
  };

  const handleResetDefaults = () => {
    saveProfilesToStorage(DEFAULT_HEALTHCARE_PROFILES);
    setProfiles(DEFAULT_HEALTHCARE_PROFILES);
  };

  // Helper for admin contract signing
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

  // Low-level function to assign on-chain role via smart contract
  const executeOnChainRoleAssignment = async (roleToAssign, addr) => {
    if (!addr || !ethers.isAddress(addr)) {
      return { success: false, error: 'Please provide a valid Ethereum wallet address (0x...).' };
    }

    try {
      const activeAdmin = await getAdminSigner();
      if (!activeAdmin) {
        return { success: false, error: 'No Ethereum provider or admin signer available.' };
      }

      const contract = getAccessControlContract(activeAdmin);

      // Query current roles
      const [doctorRole, staffRole, patientRole] = await Promise.all([
        contract.DOCTOR_ROLE(),
        contract.MEDICAL_STAFF_ROLE(),
        contract.PATIENT_ROLE(),
      ]);

      const [hasDoctor, hasStaff, hasPatient] = await Promise.all([
        contract.hasRole(doctorRole, addr),
        contract.hasRole(staffRole, addr),
        contract.hasRole(patientRole, addr),
      ]);

      let tx;
      if (roleToAssign === 'doctor') {
        if (hasDoctor) {
          return { success: true, alreadyAssigned: true };
        }
        if (hasStaff) {
          try {
            const rTx = await contract.revokeHealthcareRole(addr, staffRole);
            await rTx.wait();
          } catch (rErr) {
            console.warn('Revoke staff note:', rErr);
          }
        }
        if (hasPatient) {
          try {
            const rTx = await contract.revokeHealthcareRole(addr, patientRole);
            await rTx.wait();
          } catch (rErr) {
            console.warn('Revoke patient note:', rErr);
          }
        }
        tx = await contract.onboardDoctor(addr);
      } else if (roleToAssign === 'medicalStaff') {
        if (hasStaff) {
          return { success: true, alreadyAssigned: true };
        }
        if (hasDoctor) {
          try {
            const rTx = await contract.revokeHealthcareRole(addr, doctorRole);
            await rTx.wait();
          } catch (rErr) {
            console.warn('Revoke doctor note:', rErr);
          }
        }
        if (hasPatient) {
          try {
            const rTx = await contract.revokeHealthcareRole(addr, patientRole);
            await rTx.wait();
          } catch (rErr) {
            console.warn('Revoke patient note:', rErr);
          }
        }
        tx = await contract.onboardMedicalStaff(addr);
      } else if (roleToAssign === 'patient') {
        if (hasPatient) {
          return { success: true, alreadyAssigned: true };
        }
        if (hasDoctor) {
          try {
            const rTx = await contract.revokeHealthcareRole(addr, doctorRole);
            await rTx.wait();
          } catch (rErr) {
            console.warn('Revoke doctor note:', rErr);
          }
        }
        if (hasStaff) {
          try {
            const rTx = await contract.revokeHealthcareRole(addr, staffRole);
            await rTx.wait();
          } catch (rErr) {
            console.warn('Revoke staff note:', rErr);
          }
        }
        tx = await contract.onboardPatient(addr);
      } else {
        return { success: false, error: `Unsupported role: ${roleToAssign}` };
      }

      const receipt = await tx.wait();
      if (refreshRole) await refreshRole();

      return {
        success: true,
        hash: receipt?.hash || tx?.hash || 'confirmed'
      };
    } catch (err) {
      console.error('On-chain role assignment error:', err);
      return {
        success: false,
        error: err?.reason || err?.message || 'Smart contract transaction reverted.'
      };
    }
  };

  // Update existing record in table
  const handleSaveEdit = async (e) => {
    if (e) e.preventDefault();
    if (!editingProfile) return;
    setIsSavingEdit(true);
    setEditMessage({ text: '', type: '' });

    const cleanedName = editForm.full_name.trim() || editingProfile.email.split('@')[0];
    const cleanedWallet = editForm.wallet_address.trim();
    const newRole = editForm.role;

    if (cleanedWallet && !ethers.isAddress(cleanedWallet)) {
      setEditMessage({ text: 'Invalid Ethereum address format (must start with 0x...).', type: 'error' });
      setIsSavingEdit(false);
      return;
    }

    try {
      let onChainNote = '';
      if (editForm.syncOnChain && cleanedWallet && newRole !== 'admin') {
        const onChainRes = await executeOnChainRoleAssignment(newRole, cleanedWallet);
        if (onChainRes.success) {
          onChainNote = ` & verified on-chain (${newRole.toUpperCase()})`;
        } else {
          onChainNote = ` (Blockchain note: ${onChainRes.error})`;
        }
      }

      const updated = profiles.map(p => {
        if (p.id === editingProfile.id) {
          return {
            ...p,
            full_name: cleanedName,
            role: newRole,
            wallet_address: cleanedWallet || null,
            updated_at: new Date().toISOString()
          };
        }
        return p;
      });

      saveProfilesToStorage(updated);
      setProfiles(updated);

      try {
        await supabase.from('profiles').update({
          full_name: cleanedName,
          role: newRole,
          wallet_address: cleanedWallet || null,
          updated_at: new Date().toISOString()
        }).eq('id', editingProfile.id);
      } catch (remoteErr) {
        console.warn('Remote profile update note:', remoteErr);
      }

      setEditMessage({ text: `✓ Record updated successfully${onChainNote}!`, type: 'success' });
      setTimeout(() => {
        setEditingProfile(null);
      }, 700);
    } catch (err) {
      setEditMessage({ text: err.message || 'Failed to update record.', type: 'error' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Create User Handler (Email + Password + Optional Blockchain Onboarding)
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateMessage({ text: '', type: '' });
    setLastCreatedCredentials(null);

    const emailClean = newUserEmail.trim().toLowerCase();
    const nameClean = newUserName.trim() || emailClean.split('@')[0];
    const passwordClean = newUserPassword.trim();
    const walletClean = newUserWallet.trim();

    if (!emailClean || !passwordClean) {
      setCreateMessage({ text: 'Please provide both Email and Password.', type: 'error' });
      return;
    }

    if (passwordClean.length < 6) {
      setCreateMessage({ text: 'Password must be at least 6 characters long.', type: 'error' });
      return;
    }

    if (walletClean && !ethers.isAddress(walletClean)) {
      setCreateMessage({ text: 'The Ethereum wallet address is invalid. Please enter a valid 0x... address.', type: 'error' });
      return;
    }

    setIsCreatingUser(true);
    try {
      // 1. Get current admin user ID
      const { data: { user: currentAdmin } } = await supabase.auth.getUser();
      const adminId = currentAdmin?.id || null;

      let isExistingUser = false;
      let userId = null;

      // 2. Register new user with isolated client
      const { data, error } = await provisionerAuthClient.auth.signUp({
        email: emailClean,
        password: passwordClean,
        options: {
          data: {
            role: newUserRole,
            full_name: nameClean,
            created_by: adminId,
            wallet_address: walletClean || null
          }
        }
      });

      if (error) {
        if (error.message?.toLowerCase().includes('already registered')) {
          isExistingUser = true;
          const existing = profiles.find(p => p.email?.toLowerCase() === emailClean);
          if (existing) userId = existing.id;
        } else {
          throw error;
        }
      } else if (data?.user) {
        userId = data.user.id;
      }

      // 3. Upsert into profiles table & local storage
      const newProf = {
        id: userId || `prof_${Date.now()}`,
        email: emailClean,
        full_name: nameClean,
        role: newUserRole,
        wallet_address: walletClean || null,
        created_at: new Date().toISOString()
      };

      const existingIdx = profiles.findIndex(p => p.email?.toLowerCase() === emailClean);
      let updatedProfiles;
      if (existingIdx >= 0) {
        updatedProfiles = profiles.map((p, idx) => idx === existingIdx ? { ...p, ...newProf } : p);
      } else {
        updatedProfiles = [newProf, ...profiles];
      }
      saveProfilesToStorage(updatedProfiles);
      setProfiles(updatedProfiles);

      try {
        if (userId) {
          await supabase.from('profiles').upsert({
            id: userId,
            email: emailClean,
            full_name: nameClean,
            role: newUserRole,
            wallet_address: walletClean || null,
            created_by: adminId,
            updated_at: new Date().toISOString()
          });
        } else {
          await supabase.from('profiles').update({
            full_name: nameClean,
            role: newUserRole,
            wallet_address: walletClean || null,
            updated_at: new Date().toISOString()
          }).eq('email', emailClean);
        }
      } catch (upsertErr) {
        console.warn('Profile sync notice:', upsertErr);
      }

      // 4. If a wallet address was entered, EXECUTE ON-CHAIN TRANSACTION!
      let onChainSummary = '';
      if (walletClean) {
        const onChainRes = await executeOnChainRoleAssignment(newUserRole, walletClean);
        if (onChainRes.success) {
          onChainSummary = ` and granted on-chain ${newUserRole.toUpperCase()} role to ${walletClean.slice(0, 6)}...${walletClean.slice(-4)}`;
          if (onChainRes.hash && onChainRes.hash !== 'confirmed') {
            onChainSummary += ` (Tx: ${onChainRes.hash.slice(0, 10)}...)`;
          }
          fetchAddressRole(walletClean, setNewUserWalletRole);
        } else {
          onChainSummary = ` (Note: Blockchain error: ${onChainRes.error})`;
        }
      }

      setLastCreatedCredentials({
        role: newUserRole,
        name: nameClean,
        email: emailClean,
        password: passwordClean,
        wallet: walletClean
      });

      setCreateMessage({
        text: isExistingUser
          ? `✓ Updated existing profile for ${emailClean}${onChainSummary}!`
          : `✓ Successfully created account for ${nameClean} (${newUserRole.toUpperCase()})${onChainSummary}!`,
        type: onChainSummary.includes('error') ? 'error' : 'success'
      });

      // Reset form
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');

      // Refresh directory
      await loadProfiles();
    } catch (err) {
      setCreateMessage({ text: err.message || 'Failed to create account.', type: 'error' });
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Delete / Revoke User Profile
  const handleDeleteProfile = async (profileId, profileEmail) => {
    if (!window.confirm(`Are you sure you want to remove user ${profileEmail} from the directory?`)) {
      return;
    }

    try {
      const updated = profiles.filter(p => p.id !== profileId && p.email !== profileEmail);
      saveProfilesToStorage(updated);
      setProfiles(updated);
      await supabase.from('profiles').delete().eq('id', profileId);
    } catch (err) {
      console.warn(`Error deleting user from remote: ${err.message}`);
    }
  };

  // Onboard on Blockchain directly (from Tab 3 or Directory)
  const handleBlockchainOnboard = async (overrideRole, overrideAddress) => {
    const roleToAssign = overrideRole || blockchainRole;
    const addr = overrideAddress || targetAddress;

    if (!addr || !ethers.isAddress(addr)) {
      setContractError('Please provide a valid Ethereum wallet address.');
      return;
    }

    setIsContractProcessing(true);
    setContractError('');
    setContractStatus(`Submitting on-chain transaction to register ${roleToAssign.toUpperCase()} on BlockDriveAccessControl...`);

    const result = await executeOnChainRoleAssignment(roleToAssign, addr);
    setIsContractProcessing(false);

    if (result.success) {
      setContractStatus(`✓ On-chain permission granted! ${addr.slice(0, 8)}... is now registered as ${roleToAssign.toUpperCase()}.${result.hash ? ` (Tx: ${result.hash.slice(0, 10)}...)` : ''}`);
      fetchAddressRole(addr, setTargetAddressStatus);
      // Sync to profiles if matching wallet exists
      const updated = profiles.map(p => {
        if (p.wallet_address && p.wallet_address.toLowerCase() === addr.toLowerCase()) {
          return { ...p, role: roleToAssign };
        }
        return p;
      });
      saveProfilesToStorage(updated);
      setProfiles(updated);
      try {
        await supabase.from('profiles').update({ role: roleToAssign }).eq('wallet_address', addr);
      } catch {}
    } else {
      setContractError(result.error);
    }
  };

  // Statistics calculation
  const totalUsers = profiles.length;
  const totalDoctors = profiles.filter(p => p.role === 'doctor').length;
  const totalStaff = profiles.filter(p => p.role === 'medicalStaff').length;
  const totalPatients = profiles.filter(p => p.role === 'patient').length;

  // Filtered profiles for table
  const filteredProfiles = profiles.filter(p => {
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    const matchesSearch =
      (p.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.wallet_address || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  return (
    <div className="space-y-6 text-black">
      {/* Top Banner & Header */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-black">Hospital Administration Dashboard</h2>
            <span className="text-[11px] font-medium bg-gray-100 text-black border border-gray-200 px-2 py-0.5 rounded-full">
              Admin Control
            </span>
          </div>
          <p className="text-xs font-normal text-black mt-0.5 opacity-75">
            Provision healthcare practitioner IDs, assign on-chain roles on Ethereum, and supervise smart contract access.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs font-medium self-start sm:self-center">
          <button
            type="button"
            onClick={() => setActiveAdminView('directory')}
            className={`px-3 py-1.5 rounded-md cursor-pointer flex items-center ${
              activeAdminView === 'directory'
                ? 'bg-white text-black font-semibold shadow-xs'
                : 'text-black hover:bg-gray-200/50'
            }`}
          >
            <span>User Directory ({totalUsers})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveAdminView('create')}
            className={`px-3 py-1.5 rounded-md cursor-pointer flex items-center ${
              activeAdminView === 'create'
                ? 'bg-white text-black font-semibold shadow-xs'
                : 'text-black hover:bg-gray-200/50'
            }`}
          >
            <span>Create Account</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveAdminView('blockchain')}
            className={`px-3 py-1.5 rounded-md cursor-pointer flex items-center ${
              activeAdminView === 'blockchain'
                ? 'bg-white text-black font-semibold shadow-xs'
                : 'text-black hover:bg-gray-200/50'
            }`}
          >
            <span>Blockchain RBAC</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-3.5 text-black">
          <span className="text-xs font-normal text-black">Total System Users</span>
          <div className="text-xl font-semibold text-black mt-1.5">{totalUsers}</div>
          <span className="text-[11px] font-normal text-black mt-0.5 block opacity-60">Active across all roles</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3.5 text-black">
          <span className="text-xs font-normal text-black">Doctors</span>
          <div className="text-xl font-semibold text-black mt-1.5">{totalDoctors}</div>
          <span className="text-[11px] font-normal text-black mt-0.5 block opacity-60">Clinical practitioners</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3.5 text-black">
          <span className="text-xs font-normal text-black">Medical Staff</span>
          <div className="text-xl font-semibold text-black mt-1.5">{totalStaff}</div>
          <span className="text-[11px] font-normal text-black mt-0.5 block opacity-60">Hospital archive staff</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-3.5 text-black">
          <span className="text-xs font-normal text-black">Patients</span>
          <div className="text-xl font-semibold text-black mt-1.5">{totalPatients}</div>
          <span className="text-[11px] font-normal text-black mt-0.5 block opacity-60">Secure record holders</span>
        </div>
      </div>

      {/* VIEW 1: USER DIRECTORY */}
      {activeAdminView === 'directory' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 space-y-4 text-black">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-semibold text-black">Provisioned Healthcare Directory</h3>
              <p className="text-xs font-normal text-black mt-0.5 opacity-75">
                All accounts created by the administrator. Doctors, staff, and patients use these credentials to log in.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-xs font-medium text-black bg-white hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg cursor-pointer"
                title="Populate or restore sample healthcare practitioner records"
              >
                <span>Seed Records</span>
              </button>
              <button
                type="button"
                onClick={loadProfiles}
                disabled={loadingProfiles}
                className="text-xs font-medium text-black bg-white hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                <span>{loadingProfiles ? 'Refreshing...' : 'Refresh'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveAdminView('create')}
                className="text-xs font-medium text-white bg-black hover:bg-gray-900 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                <span>Add User</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Strip */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <input
                type="text"
                placeholder="Search by name, email, or wallet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-300 focus:border-black rounded-lg px-3 py-1.5 text-xs text-black outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
              {['all', 'doctor', 'medicalStaff', 'patient', 'admin'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer capitalize ${
                    roleFilter === r
                      ? 'bg-white text-black font-semibold border border-gray-300 shadow-xs'
                      : 'bg-gray-100 text-black hover:bg-gray-200'
                  }`}
                >
                  {r === 'medicalStaff' ? 'Staff' : r}
                </button>
              ))}
            </div>
          </div>

          {/* User Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-black font-medium border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3.5">Practitioner / User</th>
                  <th className="py-2.5 px-3.5">Email (Login ID)</th>
                  <th className="py-2.5 px-3.5">Assigned Role</th>
                  <th className="py-2.5 px-3.5">Linked Wallet</th>
                  <th className="py-2.5 px-3.5">Created At</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-black">
                {filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-black">
                      {loadingProfiles ? (
                        <span>Loading users...</span>
                      ) : (
                        <div>
                          <p className="font-medium text-black">No users found.</p>
                          <p className="text-[11px] font-normal text-black mt-1 opacity-60">
                            Click "Add User" above to create credentials for a Doctor, Patient, or Staff member.
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredProfiles.map((p) => {
                    const roleLabel = {
                      doctor: 'Doctor',
                      medicalStaff: 'Medical Staff',
                      patient: 'Patient',
                      admin: 'Administrator'
                    }[p.role] || p.role;

                    return (
                      <tr key={p.id} className="hover:bg-gray-50/70">
                        <td className="py-2.5 px-3.5 font-medium text-black">
                          <span>{p.full_name || 'Healthcare User'}</span>
                        </td>
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-black">{p.email}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(p.email, `email_${p.id}`)}
                              className="text-black hover:underline text-[11px] px-1 cursor-pointer"
                              title="Copy Email ID"
                            >
                              {copiedKey === `email_${p.id}` ? '[Copied]' : '[Copy]'}
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border border-gray-200 bg-gray-50 text-black">
                            <span>{roleLabel}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5">
                          {p.wallet_address ? (
                            <div className="flex items-center gap-1 font-mono text-[11px] text-black">
                              <span>{p.wallet_address.slice(0, 6)}...{p.wallet_address.slice(-4)}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(p.wallet_address, `wallet_${p.id}`)}
                                className="text-black hover:underline text-[11px] px-1 cursor-pointer"
                              >
                                {copiedKey === `wallet_${p.id}` ? '[Copied]' : '[Copy]'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-black opacity-50 italic font-normal">Not linked</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-black text-[11px] font-normal">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2.5 px-3.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(p)}
                              className="text-black hover:underline text-xs cursor-pointer font-medium"
                              title="Update Practitioner Record"
                            >
                              [Edit]
                            </button>
                            {p.wallet_address ? (
                              <button
                                type="button"
                                onClick={() => handleBlockchainOnboard(p.role, p.wallet_address)}
                                className="text-black hover:underline text-xs cursor-pointer font-medium"
                                title="Authorize Role on Blockchain"
                              >
                                [Authorize On-Chain]
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const addr = prompt(`Enter Ethereum wallet address for ${p.email}:`);
                                  if (addr && ethers.isAddress(addr.trim())) {
                                    handleBlockchainOnboard(p.role, addr.trim());
                                  } else if (addr) {
                                    alert('Invalid Ethereum wallet address format (0x...).');
                                  }
                                }}
                                className="text-black hover:underline text-xs cursor-pointer"
                                title="Link wallet and authorize"
                              >
                                [+ Link Wallet]
                              </button>
                            )}
                            {p.role !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteProfile(p.id, p.email)}
                                className="text-black hover:underline text-xs cursor-pointer opacity-70"
                                title="Remove User Profile"
                              >
                                [Delete]
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Edit / Update Record Modal */}
          {editingProfile && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-gray-300 rounded-lg shadow-xl max-w-lg w-full p-5 space-y-4 text-black">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-black">Update Healthcare Record</h4>
                    <p className="text-xs text-black opacity-70 mt-0.5">
                      Edit user profile details and synchronize roles with the smart contract.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingProfile(null)}
                    className="text-black text-xs hover:underline cursor-pointer font-semibold"
                  >
                    ✕ Close
                  </button>
                </div>

                <form onSubmit={handleSaveEdit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-black mb-1">
                      Email (Login ID - Read Only)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={editingProfile.email}
                      className="w-full bg-gray-100 border border-gray-200 rounded px-3 py-1.5 text-xs font-mono text-black cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-black mb-1">
                      Practitioner / User Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.full_name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                      placeholder="e.g. Dr. Jane Smith"
                      className="w-full bg-white border border-gray-300 focus:border-black rounded px-3 py-1.5 text-xs text-black outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-black mb-1">
                      Assigned Healthcare Role *
                    </label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full bg-white border border-gray-300 focus:border-black rounded px-3 py-1.5 text-xs text-black outline-none cursor-pointer"
                    >
                      <option value="doctor">Doctor (Clinical Practitioner)</option>
                      <option value="medicalStaff">Medical Staff (Hospital Archivist)</option>
                      <option value="patient">Patient (Medical Record Holder)</option>
                      <option value="admin">Administrator (Hospital Control)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-black mb-1">
                      Linked Ethereum Wallet Address
                    </label>
                    <input
                      type="text"
                      value={editForm.wallet_address}
                      onChange={(e) => setEditForm(prev => ({ ...prev, wallet_address: e.target.value }))}
                      placeholder="0x... (42-character Ethereum address)"
                      className="w-full bg-white border border-gray-300 focus:border-black rounded px-3 py-1.5 text-xs font-mono text-black outline-none"
                    />
                  </div>

                  {editForm.wallet_address && editForm.role !== 'admin' && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="syncOnChainCheck"
                        checked={editForm.syncOnChain}
                        onChange={(e) => setEditForm(prev => ({ ...prev, syncOnChain: e.target.checked }))}
                        className="rounded border-gray-300 text-black cursor-pointer"
                      />
                      <label htmlFor="syncOnChainCheck" className="text-xs text-black cursor-pointer select-none">
                        Synchronize updated role to Ethereum Smart Contract on save
                      </label>
                    </div>
                  )}

                  {editMessage.text && (
                    <div className={`p-2 rounded text-xs ${editMessage.type === 'error' ? 'bg-red-50 text-red-900 border border-red-200' : 'bg-green-50 text-green-900 border border-green-200'}`}>
                      {editMessage.text}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setEditingProfile(null)}
                      className="px-3 py-1.5 bg-white hover:bg-gray-100 text-black border border-gray-300 rounded text-xs font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingEdit}
                      className="px-4 py-1.5 bg-black hover:bg-gray-900 text-white rounded text-xs font-medium cursor-pointer disabled:bg-gray-400"
                    >
                      {isSavingEdit ? 'Saving Updates...' : 'Update Record'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: CREATE USER CREDENTIALS (ID + PASSWORD GENERATOR + ON-CHAIN AUTHORIZATION) */}
      {activeAdminView === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-black">
          {/* Create Form */}
          <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-4 sm:p-5 space-y-5 text-black">
            <div>
              <h3 className="text-sm font-semibold text-black">Create & Authorize Healthcare Practitioner</h3>
              <p className="text-xs font-normal text-black mt-0.5 opacity-75">
                Generate login credentials and authorize the practitioner's Ethereum wallet directly on the smart contract.
              </p>
            </div>

            {createMessage.text && (
              <div className={`p-3 rounded-lg text-xs border ${
                createMessage.type === 'error'
                  ? 'bg-red-50 border-red-200 text-black'
                  : createMessage.type === 'info'
                  ? 'bg-blue-50 border-blue-200 text-black'
                  : 'bg-gray-50 border-gray-300 text-black'
              }`}>
                <span>{createMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              {/* Role Selection */}
              <div>
                <label className="block text-xs font-medium text-black mb-1.5">
                  Select User Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'doctor', title: 'Doctor' },
                    { id: 'medicalStaff', title: 'Medical Staff' },
                    { id: 'patient', title: 'Patient' }
                  ].map((r) => {
                    const isSelected = newUserRole === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setNewUserRole(r.id)}
                        className={`p-3 rounded-lg border text-left cursor-pointer flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? 'border-black bg-gray-50 text-black font-semibold'
                            : 'bg-white border-gray-200 text-black hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-xs font-medium">{r.title}</div>
                        <span className="text-[10px] font-normal text-black opacity-60">
                          {r.id === 'doctor' ? 'Clinical & Certificates' : r.id === 'medicalStaff' ? 'Hospital Archives' : 'Health Records'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Full Name / Practitioner Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Jane Smith / John Doe"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full bg-white border border-gray-300 focus:border-black rounded-lg px-3 py-2 text-xs text-black outline-none"
                />
              </div>

              {/* Email (Login ID) */}
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Healthcare Email (Login ID)
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. doctor.smith@hospital.org"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-white border border-gray-300 focus:border-black rounded-lg px-3 py-2 text-xs text-black outline-none"
                />
              </div>

              {/* Password & Generator */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-black">
                    Account Password
                  </label>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-[11px] font-medium text-black underline cursor-pointer"
                  >
                    Generate Secure Password
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter or generate temporary password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full bg-white border border-gray-300 focus:border-black rounded-lg px-3 py-2 text-xs text-black outline-none pr-14 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-black text-xs px-1 hover:underline cursor-pointer"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Optional Wallet Address + Live Role Status */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-black">
                    Ethereum Wallet Address (0x...)
                  </label>
                  {account && (
                    <button
                      type="button"
                      onClick={() => setNewUserWallet(account)}
                      className="text-[11px] font-medium text-black underline cursor-pointer"
                    >
                      Use Connected Wallet ({account.slice(0, 6)}...{account.slice(-4)})
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="0x... (Will be granted on-chain role immediately)"
                  value={newUserWallet}
                  onChange={(e) => setNewUserWallet(e.target.value)}
                  className="w-full bg-white border border-gray-300 focus:border-black rounded-lg px-3 py-2 text-xs text-black outline-none font-mono"
                />
                {newUserWallet && ethers.isAddress(newUserWallet) && (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-black">
                    <span className="opacity-60">Current On-Chain Status:</span>
                    <span className={`font-semibold capitalize ${
                      newUserWalletRole === 'unregistered' ? 'opacity-60' : 'text-black'
                    }`}>
                      {newUserWalletRole}
                    </span>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isCreatingUser}
                className="w-full py-2.5 px-4 bg-black hover:bg-gray-900 disabled:bg-gray-300 text-white font-medium rounded-lg text-xs flex items-center justify-center cursor-pointer transition-colors"
              >
                <span>
                  {isCreatingUser
                    ? 'Provisioning & Submitting Blockchain Transaction...'
                    : `Create & Authorize ${newUserRole.charAt(0).toUpperCase() + newUserRole.slice(1)} Account`}
                </span>
              </button>
            </form>
          </div>

          {/* Right Column: Direct On-Chain Role Box & Generated Credentials */}
          <div className="space-y-4 text-black">
            {/* Quick Instant On-Chain Role Grant Box */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 space-y-3 text-black">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-black">
                  Instant On-Chain Role Grant
                </h4>
                <span className="text-[10px] bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded font-mono text-black">
                  Direct Blockchain
                </span>
              </div>
              <p className="text-[11px] font-normal text-black opacity-75">
                Already have a wallet? Assign <code className="font-mono bg-gray-100 px-1 py-0.5 rounded">DOCTOR_ROLE</code> directly on Ethereum without creating a new email.
              </p>

              <div className="space-y-2.5 pt-1">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-black">Wallet Address</span>
                    {account && (
                      <button
                        type="button"
                        onClick={() => setTargetAddress(account)}
                        className="text-[10px] underline text-black cursor-pointer"
                      >
                        Paste Connected ({account.slice(0, 6)}...)
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={targetAddress}
                    onChange={(e) => setTargetAddress(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs font-mono outline-none text-black"
                  />
                  {targetAddress && ethers.isAddress(targetAddress) && (
                    <div className="text-[10px] mt-1 text-black opacity-70">
                      On-Chain Role: <strong className="capitalize">{targetAddressStatus}</strong>
                    </div>
                  )}
                </div>

                <div className="flex gap-1.5">
                  {['doctor', 'medicalStaff', 'patient'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setBlockchainRole(r)}
                      className={`flex-1 py-1 rounded text-[11px] capitalize border cursor-pointer ${
                        blockchainRole === r
                          ? 'border-black bg-black text-white font-medium'
                          : 'border-gray-200 bg-white text-black hover:bg-gray-50'
                      }`}
                    >
                      {r === 'medicalStaff' ? 'Staff' : r}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleBlockchainOnboard()}
                  disabled={isContractProcessing || !targetAddress || !ethers.isAddress(targetAddress)}
                  className="w-full py-1.5 bg-black hover:bg-gray-900 disabled:bg-gray-300 text-white text-xs font-medium rounded cursor-pointer"
                >
                  <span>{isContractProcessing ? 'Submitting Transaction...' : `Grant ${blockchainRole.toUpperCase()} On-Chain`}</span>
                </button>

                {contractStatus && (
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded text-[11px] text-black">
                    <span>{contractStatus}</span>
                  </div>
                )}
                {contractError && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded text-[11px] text-black">
                    <span>{contractError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Credentials Handout Slip */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5 space-y-3 text-black">
              <h4 className="text-xs font-semibold text-black">
                Credentials Handout Slip
              </h4>
              <p className="text-xs font-normal text-black opacity-75">
                When you create an account, copy the credentials below to provide to the practitioner.
              </p>

              {lastCreatedCredentials ? (
                <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="text-[11px] font-medium text-black">Ready for Use</span>
                    <span className="text-[10px] bg-gray-100 font-mono px-2 py-0.5 rounded text-black capitalize">
                      {lastCreatedCredentials.role}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] font-medium text-black opacity-60 block">Name</span>
                      <span className="font-medium text-black">{lastCreatedCredentials.name}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-medium text-black opacity-60 block">Login Email ID</span>
                      <div className="flex items-center justify-between bg-gray-50 p-1.5 rounded border border-gray-200 font-mono text-[11px] mt-0.5">
                        <span>{lastCreatedCredentials.email}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(lastCreatedCredentials.email, 'last_email')}
                          className="text-black hover:underline text-[11px] px-1 cursor-pointer"
                        >
                          {copiedKey === 'last_email' ? '[Copied]' : '[Copy]'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-medium text-black opacity-60 block">Password</span>
                      <div className="flex items-center justify-between bg-gray-50 p-1.5 rounded border border-gray-200 font-mono text-[11px] mt-0.5">
                        <span>{lastCreatedCredentials.password}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(lastCreatedCredentials.password, 'last_pwd')}
                          className="text-black hover:underline text-[11px] px-1 cursor-pointer"
                        >
                          {copiedKey === 'last_pwd' ? '[Copied]' : '[Copy]'}
                        </button>
                      </div>
                    </div>

                    {lastCreatedCredentials.wallet && (
                      <div>
                        <span className="text-[10px] font-medium text-black opacity-60 block">Authorized Wallet</span>
                        <div className="flex items-center justify-between bg-gray-50 p-1.5 rounded border border-gray-200 font-mono text-[11px] mt-0.5">
                          <span>{lastCreatedCredentials.wallet.slice(0, 10)}...{lastCreatedCredentials.wallet.slice(-6)}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(lastCreatedCredentials.wallet, 'last_wallet')}
                            className="text-black hover:underline text-[11px] px-1 cursor-pointer"
                          >
                            {copiedKey === 'last_wallet' ? '[Copied]' : '[Copy]'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const text = `Healthcare Account Credentials\nName: ${lastCreatedCredentials.name}\nRole: ${lastCreatedCredentials.role}\nEmail: ${lastCreatedCredentials.email}\nPassword: ${lastCreatedCredentials.password}${lastCreatedCredentials.wallet ? `\nWallet: ${lastCreatedCredentials.wallet}` : ''}`;
                      copyToClipboard(text, 'copy_all');
                    }}
                    className="w-full py-2 bg-black hover:bg-gray-900 text-white rounded-lg text-xs font-medium flex items-center justify-center cursor-pointer"
                  >
                    <span>{copiedKey === 'copy_all' ? 'Copied Slip' : 'Copy Credentials Slip'}</span>
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-dashed border-gray-200 rounded-lg p-6 text-center text-black opacity-60 text-xs font-normal">
                  Fill out the form on the left to generate active login credentials.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: BLOCKCHAIN RBAC ON-CHAIN PERMISSIONS */}
      {activeAdminView === 'blockchain' && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 space-y-5 text-black">
          <div>
            <h3 className="text-sm font-semibold text-black">Smart Contract Role-Based Access Control (RBAC)</h3>
            <p className="text-xs font-normal text-black mt-0.5 opacity-75">
              Directly grant cryptographic roles on the <code className="font-mono text-black bg-gray-100 px-1 py-0.5 rounded">BlockDriveAccessControl.sol</code> Ethereum contract.
            </p>
          </div>

          {contractStatus && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-black">
              <span>{contractStatus}</span>
            </div>
          )}

          {contractError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-black">
              <span>{contractError}</span>
            </div>
          )}

          <div className="space-y-4 max-w-xl text-black">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-black">
                  Target Ethereum Wallet Address
                </label>
                {account && (
                  <button
                    type="button"
                    onClick={() => setTargetAddress(account)}
                    className="text-[11px] underline text-black cursor-pointer"
                  >
                    Use Connected Wallet ({account.slice(0, 6)}...{account.slice(-4)})
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="0x..."
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                className="w-full bg-white border border-gray-300 focus:border-black rounded-lg px-3 py-2 text-xs text-black font-mono outline-none"
              />
              {targetAddress && ethers.isAddress(targetAddress) && (
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-black">
                  <span className="opacity-60">Current On-Chain Status:</span>
                  <span className="font-semibold capitalize">
                    {targetAddressStatus}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-black mb-1.5">
                Select On-Chain Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['doctor', 'medicalStaff', 'patient'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setBlockchainRole(r)}
                    className={`py-2 px-3 rounded border text-xs font-medium capitalize cursor-pointer ${
                      blockchainRole === r
                        ? 'bg-black text-white border-black font-semibold'
                        : 'bg-white text-black border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {r === 'medicalStaff' ? 'Staff' : r}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleBlockchainOnboard()}
                disabled={isContractProcessing || !targetAddress || !ethers.isAddress(targetAddress)}
                className="py-2.5 px-4 bg-black hover:bg-gray-900 disabled:bg-gray-300 text-white font-medium rounded-lg text-xs flex items-center justify-center cursor-pointer transition-colors"
              >
                <span>
                  {isContractProcessing
                    ? 'Executing On-Chain RBAC Transaction...'
                    : `Assign On-Chain ${blockchainRole.toUpperCase()} Role`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
