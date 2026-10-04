import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  Shield,
  HardDrive,
  Key,
  User,
  LogOut,
  LogIn,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  Upload,
  FileText,
  Share2,
  CheckCircle2,
  Award,
  ChevronRight,
  Copy,
  Check
} from 'lucide-react';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copiedJWK, setCopiedJWK] = useState(false);

  // Close sidebar on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCopyJWK = () => {
    if (!userKeys?.publicKeyJWK) return;
    navigator.clipboard.writeText(JSON.stringify(userKeys.publicKeyJWK));
    setCopiedJWK(true);
    setTimeout(() => setCopiedJWK(false), 2000);
  };

  const NAV_GROUPS = [
    {
      title: 'WORKSPACE',
      items: [
        {
          id: 'upload',
          label: 'Upload & Encrypt',
          desc: 'Securely upload records',
          icon: Upload,
        },
        {
          id: 'myfiles',
          label: 'My Files & Access',
          desc: 'Manage your documents',
          icon: FileText,
        },
        {
          id: 'shared',
          label: 'Shared With Me',
          desc: 'Records shared with you',
          icon: Share2,
        },
      ],
    },
    {
      title: 'SECURITY',
      items: [
        {
          id: 'decrypt',
          label: 'Manual Decrypt',
          desc: 'Decrypt a document',
          icon: Key,
        },
        {
          id: 'verify',
          label: 'Verify Document',
          desc: 'Validate document integrity',
          icon: CheckCircle2,
        },
        {
          id: 'issue',
          label: 'Issue Certificate',
          desc: 'Create a digital certificate',
          icon: Award,
        },
      ],
    },
  ];

  const allTabs = NAV_GROUPS.flatMap((g) => g.items);
  const currentActiveTab = allTabs.find((t) => t.id === activeTab) || allTabs[0];
  const CurrentIcon = currentActiveTab.icon;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Backdrop Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px] z-40 transition-opacity duration-200"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Collapsible Vertical Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-white border-r border-slate-200 z-50 shadow-lg flex flex-col transform transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navigation Sidebar"
      >
        {/* Sidebar Header */}
        <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-slate-900 text-white rounded transition-transform duration-150 hover:scale-105">
              <HardDrive className="w-4 h-4" />
            </div>
            <span className="text-base font-bold text-slate-900 tracking-tight">BlockDrive</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-all duration-150 active:scale-90"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Grouped Navigation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
              {group.items.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-md text-left transition-all duration-150 relative cursor-pointer active:scale-[0.98] ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {/* Subtle left accent line for active item */}
                    {isActive && (
                      <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-slate-900 rounded-r transition-all duration-150" />
                    )}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-0.5 text-slate-500 group-hover:text-slate-900 transition-colors shrink-0 mt-0.5">
                        <Icon className={`w-4 h-4 transition-transform duration-150 group-hover:scale-110 ${isActive ? 'text-slate-900' : 'text-slate-500'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold leading-snug">
                          {tab.label}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight mt-0.5 font-normal">
                          {tab.desc}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-all duration-150 shrink-0 ml-1.5 ${
                      isActive ? 'opacity-100 translate-x-0 text-slate-800' : 'opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0'
                    }`} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-4 border-t border-slate-200 text-xs text-slate-600 bg-white flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Status</span>
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <span className={`w-2 h-2 rounded-full transition-colors duration-200 ${account ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span>{account ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
      </aside>

      {/* Enterprise Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Hamburger / Menu Button */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation sidebar"
              className="p-2 -ml-2 mr-1 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-all duration-150 active:scale-95 flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <Menu className="w-5 h-5 transition-transform duration-150 hover:rotate-6" />
              <span className="text-xs font-medium text-slate-600 hidden md:inline">Menu</span>
            </button>

            <div className="p-2 bg-slate-900 text-white rounded-md transition-transform duration-150 hover:scale-105">
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
                  className="text-slate-400 hover:text-slate-700 transition-colors p-0.5 active:scale-90"
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
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 hover:border-slate-300 active:scale-95 border border-slate-200 text-slate-700 rounded text-xs font-medium transition-all duration-150"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthModalView('signUp');
                    setIsAuthModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded text-xs font-medium transition-all duration-150"
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

        {/* Web3 Wallet Connection Card */}
        <WalletConnect
          account={account}
          onConnect={connectWallet}
          isConnecting={isConnecting}
          error={error}
          chainId={chainId}
          onSwitchNetwork={switchToLocalhostNetwork}
        />

        {/* Clean Page Breadcrumb / View Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-400">BlockDrive</span>
            <span>/</span>
            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
              <CurrentIcon className="w-3.5 h-3.5 text-slate-600" />
              {currentActiveTab.label}
            </span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200 font-medium px-2.5 py-1 rounded bg-slate-100 transition-all duration-150 active:scale-95 cursor-pointer shadow-2xs"
          >
            <Menu className="w-3.5 h-3.5" />
            <span>Switch Tab</span>
          </button>
        </div>

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
          <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-600 shadow-xs hover:border-slate-300 transition-colors">
            <button
              onClick={() => setShowKeyDetails(!showKeyDetails)}
              className="w-full flex items-center justify-between text-slate-700 font-medium hover:text-slate-900 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-slate-500" />
                <span>Client ECDH Public Key (P-256 JWK Session)</span>
              </div>
              {showKeyDetails ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>
            {showKeyDetails && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-semibold text-slate-400">P-256 JWK Parameters</span>
                  <button
                    onClick={handleCopyJWK}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded hover:bg-slate-100 transition-all duration-150 active:scale-95"
                  >
                    {copiedJWK ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedJWK ? 'Copied' : 'Copy JWK'}</span>
                  </button>
                </div>
                <div className="font-mono text-[11px] text-slate-600 break-all select-all bg-slate-50 p-2.5 rounded border border-slate-100">
                  {JSON.stringify(userKeys.publicKeyJWK)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Subtle Security Status Footer Strip */}
        <div className="border border-slate-200 bg-white rounded-lg p-3.5 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="font-semibold text-slate-800 uppercase tracking-wider text-[10px]">Security Status</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${account ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span>{account ? 'Wallet connected' : 'Wallet not connected'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${userKeys ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span>{userKeys ? 'Encryption available' : 'Session keys pending'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${account ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              <span>Access control active</span>
            </span>
          </div>
        </div>
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
