import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { getConnectedUserRole } from "../utils/roles";
import { isLocalNodeAlive } from "../utils/contracts";

const RoleContext = createContext({
  role: "unregistered",
  loading: false,
  refreshRole: async () => {},
});

export function RoleProvider({ children, provider: propProvider, account: propAccount, activeRole }) {
  const [role, setRole] = useState(() => activeRole || localStorage.getItem('blockdrive_active_role') || "doctor");
  const [loading, setLoading] = useState(false);
  const [internalAccount, setInternalAccount] = useState("");

  const activeAccount = propAccount !== undefined ? propAccount : internalAccount;

  useEffect(() => {
    if (activeRole) {
      setRole(activeRole);
    }
  }, [activeRole]);

  // Listen for accountsChanged event if propAccount is not explicitly passed
  useEffect(() => {
    if (propAccount !== undefined) return;

    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        if (accounts && accounts.length > 0) {
          setInternalAccount(accounts[0]);
        } else {
          setInternalAccount("");
        }
      };

      window.ethereum
        .request({ method: "eth_accounts" })
        .then(handleAccountsChanged)
        .catch(() => {});

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      return () => {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      };
    }
  }, [propAccount]);

  const refreshRole = useCallback(async () => {
    if (!activeAccount) {
      setRole(activeRole || localStorage.getItem('blockdrive_active_role') || "doctor");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let activeProvider = propProvider;
      if (!activeProvider && typeof window !== "undefined" && window.ethereum) {
        activeProvider = new ethers.BrowserProvider(window.ethereum);
      }
      if (!activeProvider) {
        const nodeAlive = await isLocalNodeAlive();
        if (nodeAlive) {
          activeProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        }
      }
      const userRole = await getConnectedUserRole(activeProvider, activeAccount);
      if (userRole && userRole !== "unregistered") {
        setRole(userRole);
      } else if (activeRole) {
        setRole(activeRole);
      } else {
        const stored = localStorage.getItem('blockdrive_active_role');
        setRole(stored || "doctor");
      }
    } catch (err) {
      console.error("Failed to refresh role:", err);
      setRole(activeRole || localStorage.getItem('blockdrive_active_role') || "doctor");
    } finally {
      setLoading(false);
    }
  }, [propProvider, activeAccount, activeRole]);

  useEffect(() => {
    refreshRole();
  }, [refreshRole]);

  return (
    <RoleContext.Provider value={{ role, loading, refreshRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}
