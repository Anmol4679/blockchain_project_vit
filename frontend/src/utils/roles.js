import { ethers } from "ethers";
import { getAccessControlContract, isLocalNodeAlive } from "./contracts";

/**
 * Resolves the primary healthcare role of a connected Ethereum address.
 * Roles: "doctor" | "medicalStaff" | "patient" | "unregistered"
 *
 * @param {import("ethers").Provider|import("ethers").Signer} [provider] Signer or Provider instance
 * @param {string} address User wallet address
 * @returns {Promise<"doctor" | "medicalStaff" | "patient" | "unregistered">}
 */
export async function getConnectedUserRole(provider, address) {
  if (!address) {
    return "unregistered";
  }

  const cleanAddress = address.toLowerCase();

  try {
    let activeProvider = provider;
    if (!activeProvider && typeof window !== "undefined" && window.ethereum) {
      activeProvider = new ethers.BrowserProvider(window.ethereum);
    }
    if (!activeProvider) {
      const nodeAlive = await isLocalNodeAlive();
      if (nodeAlive) {
        activeProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
      }
    }

    if (activeProvider) {
      const accessControl = getAccessControlContract(activeProvider);

      // Fetch role identifiers from contract
      const [doctorRole, staffRole, patientRole] = await Promise.all([
        accessControl.DOCTOR_ROLE(),
        accessControl.MEDICAL_STAFF_ROLE(),
        accessControl.PATIENT_ROLE(),
      ]);

      // Query healthcare role ownership dynamically without caching
      const [isDoctor, isStaff, isPatient] = await Promise.all([
        accessControl.hasRole(doctorRole, address),
        accessControl.hasRole(staffRole, address),
        accessControl.hasRole(patientRole, address),
      ]);

      if (isDoctor) return "doctor";
      if (isStaff) return "medicalStaff";
      if (isPatient) return "patient";
    }
  } catch (error) {
    console.warn("Could not query on-chain role (network offline or custom network):", error.message);
  }

  // Fallback to locally selected role for immediate testing
  const overrideRole = localStorage.getItem(`blockdrive_role_override_${cleanAddress}`);
  if (overrideRole && ["doctor", "medicalStaff", "patient"].includes(overrideRole)) {
    return overrideRole;
  }

  return "unregistered";
}

