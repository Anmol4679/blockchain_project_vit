import { ethers } from "ethers";
import deployedConfig from "./deployedAddresses.json";

export const FILE_REGISTRY_ABI = [
  "function registerFile(bytes32 fileId, string calldata ipfsCid, bytes calldata ownerWrappedKey) external",
  "function getFileRecord(bytes32 fileId) external view returns (string memory ipfsCid, address ownerAddress, uint256 createdAt, bytes memory callerWrappedKey)",
  "function addAuthorizedRecipient(bytes32 fileId, address recipient, bytes calldata wrappedKey) external",
  "function revokeRecipient(bytes32 fileId, address recipient) external",
  "function isAuthorized(address user, bytes32 fileId) external view returns (bool)",
  "function getFileRecipients(bytes32 fileId) external view returns (address[] memory)",
  "function getFilesByOwner(address owner) external view returns (bytes32[] memory)",
  "function getFilesSharedWithUser(address user) external view returns (bytes32[] memory)",
  "function getAccessibleFilesFromOwner(address owner, address viewer) external view returns (bytes32[] memory)",
  "event FileRegistered(bytes32 indexed fileId, address indexed owner, string ipfsCid, uint256 createdAt)",
  "event RecipientAuthorized(bytes32 indexed fileId, address indexed recipient, address indexed authorizedBy)",
  "event RecipientRevoked(bytes32 indexed fileId, address indexed recipient, address indexed revokedBy)"
];

export const ACCESS_CONTROL_ABI = [
  "function DEFAULT_ADMIN_ROLE() external view returns (bytes32)",
  "function DOCTOR_ROLE() external view returns (bytes32)",
  "function MEDICAL_STAFF_ROLE() external view returns (bytes32)",
  "function PATIENT_ROLE() external view returns (bytes32)",
  "function DATA_OWNER_ROLE() external view returns (bytes32)",
  "function DATA_CONSUMER_ROLE() external view returns (bytes32)",
  "function AUDITOR_ROLE() external view returns (bytes32)",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function grantRole(bytes32 role, address account) external",
  "function revokeRole(bytes32 role, address account) external",
  "function isVerifiedProvider(address account) external view returns (bool)",
  "function onboardDoctor(address account) external",
  "function onboardMedicalStaff(address account) external",
  "function onboardPatient(address account) external",
  "function revokeHealthcareRole(address account, bytes32 role) external",
  "function getUserAttributes(address user) external view returns (uint256)",
  "function hasRequiredAttributes(address user, uint256 requiredAttributes) external view returns (bool)",
  "event DoctorOnboarded(address indexed account, address indexed onboardedBy)",
  "event MedicalStaffOnboarded(address indexed account, address indexed onboardedBy)",
  "event PatientOnboarded(address indexed account, address indexed onboardedBy)",
  "event HealthcareRoleRevoked(address indexed account, bytes32 indexed role, address indexed revokedBy)",
  "event UserAttributesUpdated(address indexed user, uint256 attributes, address indexed updatedBy)"
];

export const FILE_REGISTRY_ADDRESS =
  deployedConfig.fileRegistryAddress ||
  import.meta.env.VITE_FILE_REGISTRY_ADDRESS ||
  "0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9";

export const ACCESS_CONTROL_ADDRESS =
  deployedConfig.accessControlAddress ||
  import.meta.env.VITE_ACCESS_CONTROL_ADDRESS ||
  "0x9E545E3C0baAB3E08CdfD552C960A1050f373042";

export const CERTIFICATE_REGISTRY_ADDRESS =
  deployedConfig.certificateRegistryAddress ||
  import.meta.env.VITE_CERTIFICATE_REGISTRY_ADDRESS ||
  "0x1613beB3B2C4f22Ee086B2b38C1476A3cE7f78E8";

export async function isLocalNodeAlive() {
  if (typeof window === "undefined") return false;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2500);
    const res = await fetch("http://127.0.0.1:8545", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "net_version", params: [], id: 1 }),
      signal: controller.signal,
    });
    clearTimeout(id);
    return res.ok;
  } catch {
    return false;
  }
}

export function getFileRegistryContract(signerOrProvider) {
  return new ethers.Contract(FILE_REGISTRY_ADDRESS, FILE_REGISTRY_ABI, signerOrProvider);
}

export function getAccessControlContract(signerOrProvider) {
  return new ethers.Contract(ACCESS_CONTROL_ADDRESS, ACCESS_CONTROL_ABI, signerOrProvider);
}

export async function checkAddressRole(account) {
  if (!account || !ethers.isAddress(account)) return "unregistered";
  try {
    let provider;
    if (typeof window !== "undefined" && window.ethereum) {
      provider = new ethers.BrowserProvider(window.ethereum);
    }
    const nodeAlive = await isLocalNodeAlive();
    if (nodeAlive) {
      provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    }
    if (!provider) return "unregistered";

    const contract = getAccessControlContract(provider);
    const [adminRole, doctorRole, staffRole, patientRole] = await Promise.all([
      contract.DEFAULT_ADMIN_ROLE(),
      contract.DOCTOR_ROLE(),
      contract.MEDICAL_STAFF_ROLE(),
      contract.PATIENT_ROLE(),
    ]);

    const [isAdmin, isDoctor, isStaff, isPatient] = await Promise.all([
      contract.hasRole(adminRole, account),
      contract.hasRole(doctorRole, account),
      contract.hasRole(staffRole, account),
      contract.hasRole(patientRole, account),
    ]);

    if (isAdmin) return "admin";
    if (isDoctor) return "doctor";
    if (isStaff) return "medicalStaff";
    if (isPatient) return "patient";
    return "unregistered";
  } catch (err) {
    console.warn("Error querying address role:", err);
    return "unregistered";
  }
}

export async function onboardDoctor(signer, account) {
  const contract = getAccessControlContract(signer);
  const tx = await contract.onboardDoctor(account);
  return await tx.wait();
}

export async function onboardMedicalStaff(signer, account) {
  const contract = getAccessControlContract(signer);
  const tx = await contract.onboardMedicalStaff(account);
  return await tx.wait();
}

export async function onboardPatient(signer, account) {
  const contract = getAccessControlContract(signer);
  const tx = await contract.onboardPatient(account);
  return await tx.wait();
}

export async function revokeHealthcareRole(signer, account, role) {
  const contract = getAccessControlContract(signer);
  let roleBytes = role;
  if (role === "doctor") {
    roleBytes = await contract.DOCTOR_ROLE();
  } else if (role === "medicalStaff") {
    roleBytes = await contract.MEDICAL_STAFF_ROLE();
  } else if (role === "patient") {
    roleBytes = await contract.PATIENT_ROLE();
  }
  const tx = await contract.revokeHealthcareRole(account, roleBytes);
  return await tx.wait();
}

export async function fundLocalAccount(address, ethAmount = "100.0") {
  if (!address || !ethers.isAddress(address)) return false;
  try {
    const weiHex = "0x" + ethers.parseEther(ethAmount.toString()).toString(16);
    const res = await fetch("http://127.0.0.1:8545", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "hardhat_setBalance",
        params: [address, weiHex],
        id: Date.now(),
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to fund local account:", err);
    return false;
  }
}

export async function getLocalBalance(address) {
  if (!address || !ethers.isAddress(address)) return "0.0";
  try {
    const res = await fetch("http://127.0.0.1:8545", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address, "latest"],
        id: Date.now(),
      }),
    });
    const data = await res.json();
    if (data && data.result) {
      return ethers.formatEther(BigInt(data.result));
    }
    return "0.0";
  } catch {
    return "0.0";
  }
}
