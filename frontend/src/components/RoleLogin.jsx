import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { supabase } from '../utils/supabaseClient';
import { checkAddressRole, fundLocalAccount, getLocalBalance } from '../utils/contracts';

export default function RoleLogin({
  role,
  onBackToRoles,
  onLoginSuccess,
  account,
  onConnectWallet,
  isConnectingWallet,
  onEnterDashboard,
  onSetAccount
}) {
  const [authMethod, setAuthMethod] = useState('wallet'); // 'wallet' | 'email'
  const [emailMode, setEmailMode] = useState('signIn'); // 'signIn' | 'signUp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Wallet address state - editable so the user can type or paste any address
  const [inputWallet, setInputWallet] = useState(account || '');
  const [walletRoleStatus, setWalletRoleStatus] = useState('unregistered');
  const [isCheckingRole, setIsCheckingRole] = useState(false);

  // Sync inputWallet when external account connects or changes if not manually edited
  useEffect(() => {
    if (account && !inputWallet) {
      setInputWallet(account);
    }
  }, [account, inputWallet]);

  // Query on-chain role of the entered wallet in real-time
  const verifyWalletOnChain = useCallback(async (addr) => {
    if (!addr || !ethers.isAddress(addr)) {
      setWalletRoleStatus('unregistered');
      return;
    }
    setIsCheckingRole(true);
    try {
      const onChain = await checkAddressRole(addr);
      setWalletRoleStatus(onChain);
    } catch {
      setWalletRoleStatus('unregistered');
    } finally {
      setIsCheckingRole(false);
    }
  }, []);

  useEffect(() => {
    if (inputWallet && ethers.isAddress(inputWallet)) {
      verifyWalletOnChain(inputWallet);
    } else {
      setWalletRoleStatus('unregistered');
    }
  }, [inputWallet, verifyWalletOnChain]);

  const [faucetLoading, setFaucetLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);

  useEffect(() => {
    const target = inputWallet || account;
    if (target && ethers.isAddress(target)) {
      getLocalBalance(target).then((b) => setWalletBalance(b));
    } else {
      setWalletBalance(null);
    }
  }, [inputWallet, account]);

  const handleRequestFaucet = async () => {
    const target = inputWallet || account;
    if (!target || !ethers.isAddress(target)) {
      setMessage({ text: 'Please enter or connect a valid wallet address first.', type: 'error' });
      return;
    }
    setFaucetLoading(true);
    try {
      const ok = await fundLocalAccount(target, "100.0");
      if (ok) {
        const bal = await getLocalBalance(target);
        setWalletBalance(bal);
        setMessage({ text: `✓ Added 100 Test ETH to ${target.slice(0, 6)}...${target.slice(-4)}! Balance: ${parseFloat(bal).toFixed(2)} ETH`, type: 'success' });
      } else {
        setMessage({ text: 'Could not contact local Hardhat node on port 8545.', type: 'error' });
      }
    } catch (e) {
      setMessage({ text: e.message || 'Faucet request failed', type: 'error' });
    } finally {
      setFaucetLoading(false);
    }
  };

  const roleMeta = {
    patient: {
      title: 'Patient Login',
      description: 'Access and decrypt medical records shared with you.'
    },
    doctor: {
      title: 'Doctor Login',
      description: 'Encrypt patient diagnostics, manage access, and issue certificates.'
    },
    medicalStaff: {
      title: 'Medical Staff Login',
      description: 'Upload documents and maintain hospital records.'
    },
    admin: {
      title: 'Administrator Login',
      description: 'Manage users, roles, and smart contract permissions.'
    }
  }[role] || {
    title: 'BlockDrive Login',
    description: 'Sign in to access your dashboard.'
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputWallet(text.trim());
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  const handleSwitchMetaMaskAccount = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts[0]) {
          setInputWallet(accounts[0]);
          if (onSetAccount) onSetAccount(accounts[0]);
        }
      } catch (err) {
        console.warn('MetaMask account switch note:', err);
      }
    } else if (onConnectWallet) {
      onConnectWallet();
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setMessage({ text: 'Please enter your email address.', type: 'error' });
      return;
    }
    if (!password) {
      setMessage({ text: 'Please enter your password.', type: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      if (emailMode === 'signIn') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password
        });
        if (error) throw error;

        // Strict Role Verification
        let userRole = data.user?.user_metadata?.role;

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profile && profile.role) {
            userRole = profile.role;
          }
        } catch (profileLookupErr) {
          console.warn('Profile table check failed:', profileLookupErr);
        }

        if (!userRole) {
          userRole = 'patient';
        }

        if (userRole !== role) {
          await supabase.auth.signOut();
          const formatRole = (r) => {
            if (r === 'doctor') return 'Doctor';
            if (r === 'medicalStaff') return 'Medical Staff';
            if (r === 'patient') return 'Patient';
            if (r === 'admin') return 'Administrator';
            return r;
          };
          throw new Error(`Access Denied: This account is registered as ${formatRole(userRole)}. Please use the ${formatRole(userRole)} login.`);
        }

        setMessage({ text: 'Signed in successfully.', type: 'success' });
        setTimeout(() => {
          if (onLoginSuccess) onLoginSuccess(data.user);
          if (onEnterDashboard) onEnterDashboard(role, inputWallet);
        }, 400);
      } else {
        if (role !== 'patient') {
          throw new Error(`Registration is only available for Patients. ${role === 'doctor' ? 'Doctor' : role === 'medicalStaff' ? 'Staff' : 'Admin'} accounts must be created by the Administrator.`);
        }

        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }
        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              role: 'patient',
              full_name: trimmedEmail.split('@')[0]
            }
          }
        });
        if (error) throw error;
        setMessage({ text: 'Account registered. You can now sign in.', type: 'success' });
        setEmailMode('signIn');
      }
    } catch (err) {
      setMessage({ text: err.message || 'Authentication error', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWalletEnter = () => {
    setMessage({ text: '', type: '' });
    const targetAddr = inputWallet.trim() || account;

    if (targetAddr && !ethers.isAddress(targetAddr)) {
      setMessage({ text: 'Please enter a valid Ethereum wallet address (0x...).', type: 'error' });
      return;
    }

    if (onSetAccount && targetAddr) {
      onSetAccount(targetAddr);
    }
    if (onEnterDashboard) {
      onEnterDashboard(role, targetAddr);
    }
  };

  const handleQuickEnter = () => {
    if (onEnterDashboard) {
      onEnterDashboard(role, inputWallet.trim() || account);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between text-black font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 py-3 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBackToRoles}
            className="inline-flex items-center text-xs font-medium text-black hover:underline px-2 py-1 rounded hover:bg-gray-100 cursor-pointer"
          >
            <span>&larr; Back to roles</span>
          </button>
          <span className="text-xs font-medium text-black uppercase">{role}</span>
        </div>
      </header>

      {/* Main Authentication Box */}
      <main className="max-w-md mx-auto px-4 py-12 w-full flex-1 flex flex-col justify-center">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-5">
          {/* Header */}
          <div className="text-center space-y-1">
            <h1 className="text-lg font-semibold text-black">{roleMeta.title}</h1>
            <p className="text-xs text-black">{roleMeta.description}</p>
          </div>

          {/* Auth Method Tabs */}
          <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('wallet');
                setMessage({ text: '', type: '' });
              }}
              className={`py-1.5 px-3 rounded transition-colors cursor-pointer flex items-center justify-center ${
                authMethod === 'wallet'
                  ? 'bg-white text-black shadow-sm font-semibold'
                  : 'text-black hover:bg-gray-200/60'
              }`}
            >
              <span>Connect Wallet</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod('email');
                setMessage({ text: '', type: '' });
              }}
              className={`py-1.5 px-3 rounded transition-colors cursor-pointer flex items-center justify-center ${
                authMethod === 'email'
                  ? 'bg-white text-black shadow-sm font-semibold'
                  : 'text-black hover:bg-gray-200/60'
              }`}
            >
              <span>Email Sign In</span>
            </button>
          </div>

          {/* Feedback Message */}
          {message.text && (
            <div className={`p-3 rounded text-xs border ${
              message.type === 'error'
                ? 'bg-red-50 border-red-200 text-black'
                : 'bg-gray-50 border-gray-300 text-black'
            }`}>
              <span>{message.text}</span>
            </div>
          )}

          {/* Tab 1: Web3 Wallet Connect (Editable & Pastable) */}
          {authMethod === 'wallet' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-medium text-black">
                    Ethereum Wallet Address
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    className="text-[11px] underline text-black cursor-pointer"
                  >
                    Paste from Clipboard
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={inputWallet}
                    onChange={(e) => setInputWallet(e.target.value.trim())}
                    placeholder="0x... (paste or type your wallet address)"
                    className="w-full bg-white border border-gray-300 focus:border-black rounded px-3 py-2 text-xs font-mono text-black outline-none"
                  />
                </div>

                {/* Status Badges & Quick Fill Links */}
                <div className="flex flex-col gap-1.5 pt-1 text-[11px]">
                  {inputWallet && ethers.isAddress(inputWallet) ? (
                    <div className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200">
                      <span className="text-black opacity-75">
                        {isCheckingRole ? 'Checking smart contract...' : 'On-Chain Status:'}
                      </span>
                      <span className="font-semibold text-black uppercase">
                        {walletRoleStatus === role
                          ? `✓ Verified ${role}`
                          : walletRoleStatus === 'unregistered'
                          ? 'Unregistered'
                          : `${walletRoleStatus} (Different Role)`}
                      </span>
                    </div>
                  ) : inputWallet ? (
                    <span className="text-red-600 text-[11px]">
                      Invalid address format. Address must begin with 0x.
                    </span>
                  ) : null}

                  <div className="flex items-center justify-between pt-1">
                    {account ? (
                      <button
                        type="button"
                        onClick={() => setInputWallet(account)}
                        className="text-black hover:underline cursor-pointer"
                      >
                        Use Connected ({account.slice(0, 6)}...{account.slice(-4)})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onConnectWallet}
                        disabled={isConnectingWallet}
                        className="text-black hover:underline cursor-pointer font-medium"
                      >
                        {isConnectingWallet ? 'Connecting...' : 'Connect MetaMask'}
                      </button>
                    )}

                    {typeof window !== 'undefined' && window.ethereum && (
                      <button
                        type="button"
                        onClick={handleSwitchMetaMaskAccount}
                        className="text-black hover:underline cursor-pointer"
                      >
                        Switch Account in MetaMask
                      </button>
                    )}
                  </div>

                  {(inputWallet || account) && (
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <span className="text-black font-mono text-[11px]">
                        {walletBalance !== null ? `Balance: ${parseFloat(walletBalance).toFixed(2)} ETH` : 'Checking balance...'}
                      </span>
                      <button
                        type="button"
                        onClick={handleRequestFaucet}
                        disabled={faucetLoading}
                        className="text-black hover:underline cursor-pointer font-medium text-[11px]"
                      >
                        {faucetLoading ? 'Adding test ETH...' : '+ Claim 100 Test ETH'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Enter Dashboard Button */}
              <button
                type="button"
                onClick={handleWalletEnter}
                disabled={!inputWallet && !account}
                className="w-full py-2.5 px-4 bg-black hover:bg-gray-900 disabled:bg-gray-300 text-white font-medium rounded text-xs transition-colors flex items-center justify-center cursor-pointer"
              >
                <span>Open Dashboard</span>
              </button>
            </div>
          )}

          {/* Tab 2: Healthcare Email / Password Form */}
          {authMethod === 'email' && (
            <form onSubmit={handleEmailAuth} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@hospital.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-gray-300 focus:border-black rounded px-3 py-1.5 text-xs text-black outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-black mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-gray-300 focus:border-black rounded px-3 py-1.5 text-xs text-black outline-none pr-12"
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

              {emailMode === 'signUp' && (
                <div>
                  <label className="block text-xs font-medium text-black mb-1">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white border border-gray-300 focus:border-black rounded px-3 py-1.5 text-xs text-black outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2 px-4 bg-black hover:bg-gray-900 disabled:bg-gray-400 text-white font-medium rounded text-xs transition-colors flex items-center justify-center cursor-pointer"
              >
                <span>{isLoading ? 'Signing in...' : emailMode === 'signIn' ? 'Sign In' : 'Create Account'}</span>
              </button>

              {role !== 'patient' ? (
                <div className="text-center pt-1">
                  <p className="text-[11px] text-black opacity-75">
                    {role === 'doctor' ? 'Doctor' : role === 'medicalStaff' ? 'Staff' : 'Administrator'} accounts are created by the Hospital Admin.
                  </p>
                </div>
              ) : (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => setEmailMode(emailMode === 'signIn' ? 'signUp' : 'signIn')}
                    className="text-xs text-black hover:underline cursor-pointer"
                  >
                    {emailMode === 'signIn' ? "New patient? Register here" : "Already have an account? Sign In"}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Quick Direct Enter */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end text-xs text-black">
            <button
              type="button"
              onClick={handleQuickEnter}
              className="text-black font-medium hover:underline cursor-pointer"
            >
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="bg-white border-t border-gray-200 py-3 text-center text-xs text-black">
        BlockDrive • Decentralized Storage
      </footer>
    </div>
  );
}
