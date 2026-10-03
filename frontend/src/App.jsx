import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Shield, HardDrive, Key, User, LogOut, LogIn, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from './utils/supabaseClient';
import WalletConnect from './components/WalletConnect';
import UploadFile from './components/UploadFile';
import MyFiles from './components/MyFiles';
import SharedFiles from './components/SharedFiles';
import RequestAccessDecrypt from './components/RequestAccessDecrypt';
import AuthModal from './components/AuthModal';
import { CertificateVerifier, CertificateIssuer } from './features/certificate-verification';
import { RoleProvider, useRole } from './context/RoleContext';

function AppContent({
  signer,
  account,
  isConnecting,
  error,
  chainId,
  switchToLocalhostNetwork,
  connectWallet,
  connectLocalTestWallet,
  authUser,
  isAuthModalOpen,
  setIsAuthModalOpen,
  authModalView,
  setAuthModalView,
  handleSignOut,
  setAuthUser,
  userKeys,
  showKeyDetails,
  setShowKeyDetails,
  activeTab,
  setActiveTab
}) {
  const { role } = useRole();

  const TABS = [
    { id: 'upload', label: 'Upload & Encrypt' },
    { id: 'myfiles', label: 'My Files & Access' },
    { id: 'shared', label: 'Shared With Me' },
    { id: 'decrypt', label: 'Manual Decrypt' },
    { id: 'verify', label: 'Verify Document' },
    { id: 'issue', label: 'Issue Certificate' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Enterprise Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-md">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 tracking-tight">BlockDrive</span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-slate-100 text-slate-600 rounded border border-slate-200">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Decentralized Access-Controlled Storage System</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Supabase User Auth State */}
            {authUser ? (
              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="font-medium max-w-[130px] truncate">{authUser.email}</span>
                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="text-slate-400 hover:text-slate-700 transition-colors p-0.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAuthModalView('signIn');
                    setIsAuthModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthModalView('signUp');
                    setIsAuthModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition-colors"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1 w-full">
        {/* Auth Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialView={authModalView}
          onAuthSuccess={(user) => setAuthUser(user)}
        />

        {/* Web3 Wallet Connection Card with 1-Click Role Switcher */}
        <WalletConnect
          account={account}
          onConnect={connectWallet}
          isConnecting={isConnecting}
          error={error}
          chainId={chainId}
          onSwitchNetwork={switchToLocalhostNetwork}
        />

        {/* Navigation Tabs */}
        <nav className="border-b border-slate-200">
          <div className="flex space-x-1 sm:space-x-4 overflow-x-auto pb-px">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2.5 px-3 text-xs sm:text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${isActive
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Tab Content Panes */}
        <div>
          {activeTab === 'upload' && (
            <UploadFile
              signer={signer}
              account={account}
              userKeys={userKeys}
              onConnectWallet={connectLocalTestWallet}
              onFileUploaded={() => setActiveTab('myfiles')}
            />
          )}
          {activeTab === 'myfiles' && (
            <MyFiles signer={signer} account={account} userKeys={userKeys} />
          )}
          {activeTab === 'shared' && (
            <SharedFiles signer={signer} account={account} userKeys={userKeys} />
          )}
          {activeTab === 'decrypt' && (
            <RequestAccessDecrypt signer={signer} userKeys={userKeys} />
          )}
          {activeTab === 'verify' && (
            <CertificateVerifier />
          )}
          {activeTab === 'issue' && (
            <CertificateIssuer
              signer={signer}
              account={account}
              onConnectWallet={connectLocalTestWallet}
            />
          )}
        </div>

        {/* Collapsible Session ECDH Public Key Inspector */}
        {userKeys && (
          <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
            <button
              onClick={() => setShowKeyDetails(!showKeyDetails)}
              className="w-full flex items-center justify-between text-slate-700 font-medium hover:text-slate-900"
            >
              <div className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-slate-500" />
                <span>Client ECDH Public Key (P-256 JWK Session)</span>
              </div>
              {showKeyDetails ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {showKeyDetails && (
              <div className="mt-2 pt-2 border-t border-slate-100 font-mono text-[11px] text-slate-500 break-all select-all bg-slate-50 p-2 rounded">
                {JSON.stringify(userKeys.publicKeyJWK)}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Formal Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        BlockDrive Decentralized Storage Architecture • Cryptographic Access Control Layer
      </footer>
    </div>
  );
}

export default function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [userKeys, setUserKeys] = useState(null);
  const [showKeyDetails, setShowKeyDetails] = useState(false);

  // Support deep links like ?tab=verify or ?tab=issue or #verify
  const getInitialTab = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['upload', 'myfiles', 'shared', 'decrypt', 'verify', 'issue'].includes(tabParam)) {
      return tabParam;
    }
    const hash = window.location.hash.replace('#', '');
    if (['upload', 'myfiles', 'shared', 'decrypt', 'verify', 'issue'].includes(hash)) {
      return hash;
    }
    return 'upload';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  // Supabase User Auth State
  const [authUser, setAuthUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState('signIn');

  useEffect(() => {
    // Check initial Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
    });

    // Listen for Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
  };

  // Initialize client-side ECDH keypair per connected account for reliable key agreement
  useEffect(() => {
    async function initKeys() {
      const targetAddress = account ? account.toLowerCase() : 'default_session';
      const storageKey = `blockdrive_ecdh_keys_${targetAddress}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setUserKeys(parsed);
          if (account) {
            const pubRegistry = JSON.parse(localStorage.getItem('blockdrive_public_ecdh_registry') || '{}');
            pubRegistry[targetAddress] = parsed.publicKeyJWK;
            localStorage.setItem('blockdrive_public_ecdh_registry', JSON.stringify(pubRegistry));
          }
          return;
        } catch (e) {
          console.warn(e);
        }
      }

      const keyPair = await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey"]
      );
      const pubJWK = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
      const privJWK = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
      const newKeys = {
        publicKeyJWK: pubJWK,
        privateKeyJWK: privJWK,
      };
      localStorage.setItem(storageKey, JSON.stringify(newKeys));
      if (account) {
        const pubRegistry = JSON.parse(localStorage.getItem('blockdrive_public_ecdh_registry') || '{}');
        pubRegistry[targetAddress] = pubJWK;
        localStorage.setItem('blockdrive_public_ecdh_registry', JSON.stringify(pubRegistry));
      }
      setUserKeys(newKeys);
    }
    initKeys();
  }, [account]);

  const [chainId, setChainId] = useState('');

  const switchToLocalhostNetwork = async () => {
    if (!window.ethereum) return;
    const targetChainId = "0x7a69"; // 31337 in hex
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetChainId }],
      });
      setChainId(targetChainId);
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: targetChainId,
                chainName: "Hardhat Localhost",
                rpcUrls: ["http://127.0.0.1:8545/"],
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
              },
            ],
          });
          setChainId(targetChainId);
        } catch (addError) {
          console.error("Failed to add local network", addError);
        }
      }
    }
  };

  const connectLocalTestWallet = async () => {
    try {
      const localProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      const localSigner = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", localProvider);
      const address = await localSigner.getAddress();
      setProvider(localProvider);
      setSigner(localSigner);
      setAccount(address);
      setChainId("0x7a69");
    } catch (err) {
      console.error(err);
      setError("Failed to connect to local Hardhat node at http://127.0.0.1:8545.");
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      connectLocalTestWallet();
      return;
    }
    setIsConnecting(true);
    setError("");

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts || accounts.length === 0) {
        throw new Error("No Ethereum account selected in MetaMask.");
      }

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const userSigner = await browserProvider.getSigner();
      const currentNetwork = await browserProvider.getNetwork();
      const currentChainHex = "0x" + currentNetwork.chainId.toString(16);

      setProvider(browserProvider);
      setSigner(userSigner);
      setAccount(accounts[0]);
      setChainId(currentChainHex);

      if (currentChainHex !== "0x7a69" && currentChainHex !== "0xaa36a7") {
        await switchToLocalhostNetwork();
      }
    } catch (err) {
      console.error("Wallet connection error:", err);
      if (err.code === -32002) {
        setError("MetaMask is currently locked or pending confirmation. Please unlock MetaMask.");
      } else if (err.code === 4001) {
        setError("Connection request was cancelled.");
      } else {
        setError(err.message || "Failed to connect wallet.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then(async (accounts) => {
        if (accounts && accounts.length > 0) {
          try {
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            const userSigner = await browserProvider.getSigner();
            const network = await browserProvider.getNetwork();
            setProvider(browserProvider);
            setSigner(userSigner);
            setAccount(accounts[0]);
            setChainId("0x" + network.chainId.toString(16));
          } catch (e) {
            console.warn("Auto-connect initialization skipped:", e);
          }
        }
      });

      window.ethereum.request({ method: "eth_chainId" }).then((id) => setChainId(id));

      const handleAccountsChanged = async (accounts) => {
        if (accounts && accounts.length > 0) {
          try {
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            const userSigner = await browserProvider.getSigner();
            const network = await browserProvider.getNetwork();
            setProvider(browserProvider);
            setSigner(userSigner);
            setAccount(accounts[0]);
            setChainId("0x" + network.chainId.toString(16));
            setError("");
          } catch (e) {
            console.error(e);
          }
        } else {
          setAccount("");
          setSigner(null);
          setProvider(null);
        }
      };

      const handleChainChanged = (newChainId) => {
        setChainId(newChainId);
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, []);

  return (
    <RoleProvider provider={provider} account={account}>
      <AppContent
        signer={signer}
        account={account}
        isConnecting={isConnecting}
        error={error}
        chainId={chainId}
        switchToLocalhostNetwork={switchToLocalhostNetwork}
        connectWallet={connectWallet}
        connectLocalTestWallet={connectLocalTestWallet}
        authUser={authUser}
        isAuthModalOpen={isAuthModalOpen}
        setIsAuthModalOpen={setIsAuthModalOpen}
        authModalView={authModalView}
        setAuthModalView={setAuthModalView}
        handleSignOut={handleSignOut}
        setAuthUser={setAuthUser}
        userKeys={userKeys}
        showKeyDetails={showKeyDetails}
        setShowKeyDetails={setShowKeyDetails}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </RoleProvider>
  );
}
