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
  import.meta.env.VITE_FILE_REGISTRY_ADDRESS ||
  deployedConfig.fileRegistryAddress ||
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

export const ACCESS_CONTROL_ADDRESS =
  import.meta.env.VITE_ACCESS_CONTROL_ADDRESS ||
  deployedConfig.accessControlAddress ||
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export function getFileRegistryContract(signerOrProvider) {
  return new ethers.Contract(FILE_REGISTRY_ADDRESS, FILE_REGISTRY_ABI, signerOrProvider);
}

export function getAccessControlContract(signerOrProvider) {
  return new ethers.Contract(ACCESS_CONTROL_ADDRESS, ACCESS_CONTROL_ABI, signerOrProvider);
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
