// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BlockDriveAccessControl
 * @notice Role-Based Access Control (RBAC) and attribute bookkeeping for the MediChain healthcare system.
 * @dev Governs hospital administrators, verified doctors, medical staff, and registered patients.
 */
contract BlockDriveAccessControl is AccessControl {
    bytes32 public constant DOCTOR_ROLE = keccak256("DOCTOR_ROLE");
    bytes32 public constant MEDICAL_STAFF_ROLE = keccak256("MEDICAL_STAFF_ROLE");
    bytes32 public constant PATIENT_ROLE = keccak256("PATIENT_ROLE");

    // Legacy role constants preserved for backwards compatibility with frontend connectors
    bytes32 public constant DATA_OWNER_ROLE = keccak256("DATA_OWNER_ROLE");
    bytes32 public constant DATA_CONSUMER_ROLE = keccak256("DATA_CONSUMER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    // Mapping of user address to attribute bitmask for fine-grained departmental attributes
    mapping(address => uint256) private _userAttributes;

    event DoctorOnboarded(address indexed account, address indexed onboardedBy);
    event MedicalStaffOnboarded(address indexed account, address indexed onboardedBy);
    event PatientOnboarded(address indexed account, address indexed onboardedBy);
    event HealthcareRoleRevoked(address indexed account, bytes32 indexed role, address indexed revokedBy);
    event UserAttributesUpdated(address indexed user, uint256 attributes, address indexed updatedBy);

    error InvalidAddress();

    /**
     * @notice Initializes the access control contract with a default admin.
     * @param defaultAdmin Address of the hospital/system administrator.
     */
    constructor(address defaultAdmin) {
        if (defaultAdmin == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(DATA_OWNER_ROLE, defaultAdmin);
    }

    /**
     * @notice Onboard a verified doctor into the healthcare system.
     * @param account Wallet address of the doctor.
     */
    function onboardDoctor(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        _grantRole(DOCTOR_ROLE, account);
        emit DoctorOnboarded(account, msg.sender);
    }

    /**
     * @notice Onboard a verified medical staff member (nurse, lab technician, etc.).
     * @param account Wallet address of the staff member.
     */
    function onboardMedicalStaff(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        _grantRole(MEDICAL_STAFF_ROLE, account);
        emit MedicalStaffOnboarded(account, msg.sender);
    }

    /**
     * @notice Onboard a patient into the healthcare participant directory.
     * @param account Wallet address of the patient.
     */
    function onboardPatient(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        _grantRole(PATIENT_ROLE, account);
        emit PatientOnboarded(account, msg.sender);
    }

    /**
     * @notice Revoke a healthcare role from an account, immediately invalidating privileges.
     * @param account Wallet address whose role is being revoked.
     * @param role The role identifier to revoke.
     */
    function revokeHealthcareRole(address account, bytes32 role) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (account == address(0)) revert InvalidAddress();
        _revokeRole(role, account);
        emit HealthcareRoleRevoked(account, role, msg.sender);
    }

    /**
     * @notice View helper returning true if the account is an active verified doctor or medical staff.
     * @param account Wallet address to inspect.
     * @return True if account currently holds DOCTOR_ROLE or MEDICAL_STAFF_ROLE.
     */
    function isVerifiedProvider(address account) external view returns (bool) {
        return hasRole(DOCTOR_ROLE, account) || hasRole(MEDICAL_STAFF_ROLE, account);
    }

    /**
     * @notice Set user attribute flags (e.g. Department, Clearance Level).
     * @param user Target account.
     * @param attributes Bitmask representing user attributes.
     */
    function setUserAttributes(address user, uint256 attributes) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _userAttributes[user] = attributes;
        emit UserAttributesUpdated(user, attributes, msg.sender);
    }

    /**
     * @notice Get user attribute flags.
     * @param user Target account.
     */
    function getUserAttributes(address user) external view returns (uint256) {
        return _userAttributes[user];
    }

    /**
     * @notice Check if a user possesses required attribute bits.
     * @param user Target account.
     * @param requiredAttributes Bitmask of required attributes.
     */
    function hasRequiredAttributes(address user, uint256 requiredAttributes) external view returns (bool) {
        return (_userAttributes[user] & requiredAttributes) == requiredAttributes;
    }
}
