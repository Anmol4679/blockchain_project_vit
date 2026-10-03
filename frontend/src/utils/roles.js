import { ethers } from "ethers";
import { getAccessControlContract } from "./contracts";

/**
 * Resolves the primary healthcare role of a connected Ethereum address.
 * Queries BlockDriveAccessControl contract without caching.
 *
 * @param {import("ethers").Provider|import("ethers").Signer} [provider] Signer or Provider instance
 * @param {string} address User wallet address
 * @returns {Promise<"admin" | "doctor" | "medicalStaff" | "patient" | "unregistered">}
 */
export async function getConnectedUserRole(provider, address) {
  if (!address) {
    return "unregistered";
  }

  try {
    let activeProvider = provider;
    if (!activeProvider && typeof window !== "undefined" && window.ethereum) {
      activeProvider = new ethers.BrowserProvider(window.ethereum);
    }
    if (!activeProvider) {
      activeProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    }

    const accessControl = getAccessControlContract(activeProvider);

    // Fetch role identifiers from contract
    const [adminRole, doctorRole, staffRole, patientRole] = await Promise.all([
      accessControl.DEFAULT_ADMIN_ROLE(),
      accessControl.DOCTOR_ROLE(),
      accessControl.MEDICAL_STAFF_ROLE(),
      accessControl.PATIENT_ROLE(),
    ]);

    // Query role ownership dynamically without caching
    const [isAdmin, isDoctor, isStaff, isPatient] = await Promise.all([
      accessControl.hasRole(adminRole, address),
      accessControl.hasRole(doctorRole, address),
      accessControl.hasRole(staffRole, address),
      accessControl.hasRole(patientRole, address),
    ]);

    if (isAdmin) return "admin";
    if (isDoctor) return "doctor";
    if (isStaff) return "medicalStaff";
    if (isPatient) return "patient";

    return "unregistered";
  } catch (error) {
    console.error("Error checking user healthcare role:", error);
    return "unregistered";
  }
}
