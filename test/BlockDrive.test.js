const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MediChain / BlockDrive Contracts", function () {
  let accessControl;
  let fileRegistry;
  let certificateRegistry;
  let admin, doctor, medicalStaff, patient, nonProvider, unauthorizedUser, publicVerifier;

  const mockFileId = ethers.keccak256(ethers.toUtf8Bytes("medical-record-test-001.pdf"));
  const mockFileId2 = ethers.keccak256(ethers.toUtf8Bytes("medical-record-test-002.pdf"));
  const mockCid = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
  const mockOwnerWrappedKey = ethers.hexlify(ethers.toUtf8Bytes("mock-wrapped-key-doctor"));
  const mockPatientWrappedKey = ethers.hexlify(ethers.toUtf8Bytes("mock-wrapped-key-patient"));

  const sampleCertHash = ethers.keccak256(ethers.toUtf8Bytes("Medical Certificate: Jane Doe, Fit to Work"));
  const sampleCertHash2 = ethers.keccak256(ethers.toUtf8Bytes("Vaccination Record: Jane Doe, COVID-19"));

  beforeEach(async function () {
    [admin, doctor, medicalStaff, patient, nonProvider, unauthorizedUser, publicVerifier] = await ethers.getSigners();

    // 1. Deploy AccessControl
    const AccessControlFactory = await ethers.getContractFactory("BlockDriveAccessControl");
    accessControl = await AccessControlFactory.deploy(admin.address);
    await accessControl.waitForDeployment();

    const accessControlAddress = await accessControl.getAddress();

    // 2. Deploy FileRegistry
    const FileRegistryFactory = await ethers.getContractFactory("FileRegistry");
    fileRegistry = await FileRegistryFactory.deploy(accessControlAddress);
    await fileRegistry.waitForDeployment();

    // 3. Deploy CertificateRegistry
    const CertificateRegistryFactory = await ethers.getContractFactory("CertificateRegistry");
    certificateRegistry = await CertificateRegistryFactory.deploy(admin.address, accessControlAddress);
    await certificateRegistry.waitForDeployment();

    // Onboard default actors
    await accessControl.connect(admin).onboardDoctor(doctor.address);
    await accessControl.connect(admin).onboardMedicalStaff(medicalStaff.address);
    await accessControl.connect(admin).onboardPatient(patient.address);

    // Grant ISSUER_ROLE to doctor for certificate testing
    const ISSUER_ROLE = await certificateRegistry.ISSUER_ROLE();
    await certificateRegistry.connect(admin).grantRole(ISSUER_ROLE, doctor.address);
  });

  describe("BlockDriveAccessControl - Healthcare RBAC", function () {
    it("should set and verify user attributes", async function () {
      const attributes = 0x05; // 00000101 binary flags
      await expect(accessControl.connect(admin).setUserAttributes(doctor.address, attributes))
        .to.emit(accessControl, "UserAttributesUpdated")
        .withArgs(doctor.address, attributes, admin.address);

      expect(await accessControl.getUserAttributes(doctor.address)).to.equal(attributes);
      expect(await accessControl.hasRequiredAttributes(doctor.address, 0x01)).to.be.true;
      expect(await accessControl.hasRequiredAttributes(doctor.address, 0x02)).to.be.false;
    });

    it("should reject non-admin attribute update", async function () {
      await expect(
        accessControl.connect(unauthorizedUser).setUserAttributes(doctor.address, 0x01)
      ).to.be.revertedWithCustomError(accessControl, "AccessControlUnauthorizedAccount");
    });

    it("should onboard a doctor and emit DoctorOnboarded", async function () {
      const newDoctor = unauthorizedUser;
      const DOCTOR_ROLE = await accessControl.DOCTOR_ROLE();

      await expect(accessControl.connect(admin).onboardDoctor(newDoctor.address))
        .to.emit(accessControl, "DoctorOnboarded")
        .withArgs(newDoctor.address, admin.address);

      expect(await accessControl.hasRole(DOCTOR_ROLE, newDoctor.address)).to.be.true;
      expect(await accessControl.isVerifiedProvider(newDoctor.address)).to.be.true;
    });

    it("should onboard medical staff and emit MedicalStaffOnboarded", async function () {
      const newStaff = unauthorizedUser;
      const STAFF_ROLE = await accessControl.MEDICAL_STAFF_ROLE();

      await expect(accessControl.connect(admin).onboardMedicalStaff(newStaff.address))
        .to.emit(accessControl, "MedicalStaffOnboarded")
        .withArgs(newStaff.address, admin.address);

      expect(await accessControl.hasRole(STAFF_ROLE, newStaff.address)).to.be.true;
      expect(await accessControl.isVerifiedProvider(newStaff.address)).to.be.true;
    });

    it("should onboard a patient and emit PatientOnboarded", async function () {
      const newPatient = unauthorizedUser;
      const PATIENT_ROLE = await accessControl.PATIENT_ROLE();

      await expect(accessControl.connect(admin).onboardPatient(newPatient.address))
        .to.emit(accessControl, "PatientOnboarded")
        .withArgs(newPatient.address, admin.address);

      expect(await accessControl.hasRole(PATIENT_ROLE, newPatient.address)).to.be.true;
      expect(await accessControl.isVerifiedProvider(newPatient.address)).to.be.false;
    });

    it("should reject onboarding when called by non-admin", async function () {
      await expect(
        accessControl.connect(doctor).onboardDoctor(nonProvider.address)
      ).to.be.revertedWithCustomError(accessControl, "AccessControlUnauthorizedAccount");

      await expect(
        accessControl.connect(doctor).onboardMedicalStaff(nonProvider.address)
      ).to.be.revertedWithCustomError(accessControl, "AccessControlUnauthorizedAccount");

      await expect(
        accessControl.connect(doctor).onboardPatient(nonProvider.address)
      ).to.be.revertedWithCustomError(accessControl, "AccessControlUnauthorizedAccount");
    });

    it("should accurately report isVerifiedProvider status", async function () {
      expect(await accessControl.isVerifiedProvider(doctor.address)).to.be.true;
      expect(await accessControl.isVerifiedProvider(medicalStaff.address)).to.be.true;
      expect(await accessControl.isVerifiedProvider(patient.address)).to.be.false;
      expect(await accessControl.isVerifiedProvider(nonProvider.address)).to.be.false;
    });

    it("should allow admin to revoke a healthcare role", async function () {
      const DOCTOR_ROLE = await accessControl.DOCTOR_ROLE();

      await expect(accessControl.connect(admin).revokeHealthcareRole(doctor.address, DOCTOR_ROLE))
        .to.emit(accessControl, "HealthcareRoleRevoked")
        .withArgs(doctor.address, DOCTOR_ROLE, admin.address);

      expect(await accessControl.hasRole(DOCTOR_ROLE, doctor.address)).to.be.false;
      expect(await accessControl.isVerifiedProvider(doctor.address)).to.be.false;
    });

    it("should reject non-admin trying to revoke healthcare role", async function () {
      const DOCTOR_ROLE = await accessControl.DOCTOR_ROLE();
      await expect(
        accessControl.connect(unauthorizedUser).revokeHealthcareRole(doctor.address, DOCTOR_ROLE)
      ).to.be.revertedWithCustomError(accessControl, "AccessControlUnauthorizedAccount");
    });
  });

  describe("FileRegistry - Healthcare Records Access Control", function () {
    it("should register a file and emit FileRegistered event when caller is a verified provider", async function () {
      const tx = await fileRegistry
        .connect(doctor)
        .registerFile(mockFileId, mockCid, mockOwnerWrappedKey);

      await expect(tx)
        .to.emit(fileRegistry, "FileRegistered")
        .withArgs(mockFileId, doctor.address, mockCid, (await ethers.provider.getBlock("latest")).timestamp);

      expect(await fileRegistry.isAuthorized(doctor.address, mockFileId)).to.be.true;
    });

    it("should reject upload for non-provider with exact error message", async function () {
      await expect(
        fileRegistry.connect(nonProvider).registerFile(mockFileId, mockCid, mockOwnerWrappedKey)
      ).to.be.revertedWith("FileRegistry: caller is not a verified healthcare provider");
    });

    it("should reject upload for patient", async function () {
      await expect(
        fileRegistry.connect(patient).registerFile(mockFileId, mockCid, mockOwnerWrappedKey)
      ).to.be.revertedWith("FileRegistry: caller is not a verified healthcare provider");
    });

    it("should accept upload for onboarded doctor", async function () {
      await expect(
        fileRegistry.connect(doctor).registerFile(mockFileId, mockCid, mockOwnerWrappedKey)
      ).to.emit(fileRegistry, "FileRegistered");
    });

    it("should accept upload for onboarded medical staff", async function () {
      await expect(
        fileRegistry.connect(medicalStaff).registerFile(mockFileId2, mockCid, mockOwnerWrappedKey)
      ).to.emit(fileRegistry, "FileRegistered");
    });

    it("should reject duplicate file registration", async function () {
      await fileRegistry.connect(doctor).registerFile(mockFileId, mockCid, mockOwnerWrappedKey);
      await expect(
        fileRegistry.connect(doctor).registerFile(mockFileId, mockCid, mockOwnerWrappedKey)
      ).to.be.revertedWithCustomError(fileRegistry, "FileAlreadyExists");
    });

    it("should allow authorized owner to retrieve file record and wrapped key", async function () {
      await fileRegistry.connect(doctor).registerFile(mockFileId, mockCid, mockOwnerWrappedKey);

      const record = await fileRegistry.connect(doctor).getFileRecord(mockFileId);
      expect(record.ipfsCid).to.equal(mockCid);
      expect(record.ownerAddress).to.equal(doctor.address);
      expect(record.callerWrappedKey).to.equal(mockOwnerWrappedKey);
    });

    it("should reject addAuthorizedRecipient for an address with no healthcare role", async function () {
      await fileRegistry.connect(doctor).registerFile(mockFileId, mockCid, mockOwnerWrappedKey);

      await expect(
        fileRegistry.connect(doctor).addAuthorizedRecipient(mockFileId, nonProvider.address, mockPatientWrappedKey)
      ).to.be.revertedWith("FileRegistry: recipient is not an authorized healthcare participant");
    });

    it("should accept addAuthorizedRecipient for an onboarded patient", async function () {
      await fileRegistry.connect(doctor).registerFile(mockFileId, mockCid, mockOwnerWrappedKey);

      await expect(
        fileRegistry
          .connect(doctor)
          .addAuthorizedRecipient(mockFileId, patient.address, mockPatientWrappedKey)
      )
        .to.emit(fileRegistry, "RecipientAuthorized")
        .withArgs(mockFileId, patient.address, doctor.address);

      expect(await fileRegistry.isAuthorized(patient.address, mockFileId)).to.be.true;

      const record = await fileRegistry.connect(patient).getFileRecord(mockFileId);
      expect(record.ipfsCid).to.equal(mockCid);
      expect(record.callerWrappedKey).to.equal(mockPatientWrappedKey);
    });

    it("should reject unauthorized caller attempting to retrieve file record", async function () {
      await fileRegistry.connect(doctor).registerFile(mockFileId, mockCid, mockOwnerWrappedKey);

      await expect(
        fileRegistry.connect(unauthorizedUser).getFileRecord(mockFileId)
      ).to.be.revertedWithCustomError(fileRegistry, "UnauthorizedCaller");
    });

    it("should reject non-owner attempting to add authorized recipient", async function () {
      await fileRegistry.connect(doctor).registerFile(mockFileId, mockCid, mockOwnerWrappedKey);

      await expect(
        fileRegistry
          .connect(unauthorizedUser)
          .addAuthorizedRecipient(mockFileId, patient.address, mockPatientWrappedKey)
      ).to.be.revertedWithCustomError(fileRegistry, "NotFileOwner");
    });

    it("should allow owner to revoke recipient authorization", async function () {
      await fileRegistry.connect(doctor).registerFile(mockFileId, mockCid, mockOwnerWrappedKey);
      await fileRegistry
        .connect(doctor)
        .addAuthorizedRecipient(mockFileId, patient.address, mockPatientWrappedKey);

      await expect(
        fileRegistry.connect(doctor).revokeRecipient(mockFileId, patient.address)
      )
        .to.emit(fileRegistry, "RecipientRevoked")
        .withArgs(mockFileId, patient.address, doctor.address);

      expect(await fileRegistry.isAuthorized(patient.address, mockFileId)).to.be.false;
    });

    it("should immediately block further uploads from an address once role is revoked", async function () {
      const DOCTOR_ROLE = await accessControl.DOCTOR_ROLE();
      await accessControl.connect(admin).revokeHealthcareRole(doctor.address, DOCTOR_ROLE);

      await expect(
        fileRegistry.connect(doctor).registerFile(mockFileId, mockCid, mockOwnerWrappedKey)
      ).to.be.revertedWith("FileRegistry: caller is not a verified healthcare provider");
    });

    it("should enumerate file recipients, owner files, and shared files correctly", async function () {
      await fileRegistry.connect(doctor).registerFile(mockFileId, mockCid, mockOwnerWrappedKey);
      await fileRegistry.connect(doctor).addAuthorizedRecipient(mockFileId, patient.address, mockPatientWrappedKey);

      const recipients = await fileRegistry.connect(doctor).getFileRecipients(mockFileId);
      expect(recipients).to.include(doctor.address);
      expect(recipients).to.include(patient.address);

      const ownerFiles = await fileRegistry.getFilesByOwner(doctor.address);
      expect(ownerFiles).to.include(mockFileId);

      const sharedFiles = await fileRegistry.getFilesSharedWithUser(patient.address);
      expect(sharedFiles).to.include(mockFileId);

      const accessible = await fileRegistry.getAccessibleFilesFromOwner(doctor.address, patient.address);
      expect(accessible).to.include(mockFileId);
    });
  });

  describe("CertificateRegistry - Medical Certificate Verification", function () {
    it("should assign DEFAULT_ADMIN_ROLE and ISSUER_ROLE to deployer/admin", async function () {
      const DEFAULT_ADMIN_ROLE = await certificateRegistry.DEFAULT_ADMIN_ROLE();
      const ISSUER_ROLE = await certificateRegistry.ISSUER_ROLE();

      expect(await certificateRegistry.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await certificateRegistry.hasRole(ISSUER_ROLE, admin.address)).to.be.true;
    });

    it("should allow admin to grant and revoke ISSUER_ROLE", async function () {
      const ISSUER_ROLE = await certificateRegistry.ISSUER_ROLE();
      
      expect(await certificateRegistry.hasRole(ISSUER_ROLE, unauthorizedUser.address)).to.be.false;
      await certificateRegistry.connect(admin).grantRole(ISSUER_ROLE, unauthorizedUser.address);
      expect(await certificateRegistry.hasRole(ISSUER_ROLE, unauthorizedUser.address)).to.be.true;

      await certificateRegistry.connect(admin).revokeRole(ISSUER_ROLE, unauthorizedUser.address);
      expect(await certificateRegistry.hasRole(ISSUER_ROLE, unauthorizedUser.address)).to.be.false;
    });

    it("should reject certificate issuance for medical staff (not doctor)", async function () {
      const ISSUER_ROLE = await certificateRegistry.ISSUER_ROLE();
      // Even if medical staff is granted ISSUER_ROLE, they must be rejected because they lack DOCTOR_ROLE
      await certificateRegistry.connect(admin).grantRole(ISSUER_ROLE, medicalStaff.address);

      await expect(
        certificateRegistry
          .connect(medicalStaff)
          .issueCertificate(sampleCertHash, "Jane Doe", "Medical Certificate", "ipfs://QmMeta")
      ).to.be.revertedWith("CertificateRegistry: caller is not a verified doctor");
    });

    it("should reject certificate issuance for non-issuer doctor (missing ISSUER_ROLE)", async function () {
      const [anotherDoctor] = await ethers.getSigners();
      // admin has DOCTOR_ROLE onboarded? Let's onboard a new doctor without ISSUER_ROLE
      const newDoctor = unauthorizedUser;
      await accessControl.connect(admin).onboardDoctor(newDoctor.address);

      await expect(
        certificateRegistry
          .connect(newDoctor)
          .issueCertificate(sampleCertHash, "Jane Doe", "Medical Certificate", "ipfs://QmMeta")
      ).to.be.revertedWithCustomError(certificateRegistry, "AccessControlUnauthorizedAccount");
    });

    it("should accept certificate issuance for verified doctor holding both ISSUER_ROLE and DOCTOR_ROLE", async function () {
      const tx = await certificateRegistry
        .connect(doctor)
        .issueCertificate(sampleCertHash, "Jane Doe", "Medical Certificate", "ipfs://QmMeta");

      await expect(tx)
        .to.emit(certificateRegistry, "CertificateIssued")
        .withArgs(
          sampleCertHash,
          doctor.address,
          "Jane Doe",
          "Medical Certificate",
          (await ethers.provider.getBlock("latest")).timestamp,
          "ipfs://QmMeta"
        );

      const record = await certificateRegistry.getCertificate(sampleCertHash);
      expect(record.issuerAddress).to.equal(doctor.address);
      expect(record.recipientName).to.equal("Jane Doe");
      expect(record.exists).to.be.true;
      expect(record.revoked).to.be.false;
    });

    it("should reject duplicate certificate hash registration", async function () {
      await certificateRegistry
        .connect(doctor)
        .issueCertificate(sampleCertHash, "Jane Doe", "Medical Certificate", "ipfs://QmMeta");

      await expect(
        certificateRegistry
          .connect(doctor)
          .issueCertificate(sampleCertHash, "Jane Doe", "Medical Certificate", "ipfs://QmMeta")
      ).to.be.revertedWithCustomError(certificateRegistry, "CertificateAlreadyExists");
    });

    it("should reject certificate issuance with empty parameters", async function () {
      await expect(
        certificateRegistry.connect(doctor).issueCertificate(ethers.ZeroHash, "Jane Doe", "Medical Certificate", "")
      ).to.be.revertedWithCustomError(certificateRegistry, "EmptyHash");

      await expect(
        certificateRegistry.connect(doctor).issueCertificate(sampleCertHash, "", "Medical Certificate", "")
      ).to.be.revertedWithCustomError(certificateRegistry, "EmptyRecipient");

      await expect(
        certificateRegistry.connect(doctor).issueCertificate(sampleCertHash, "Jane Doe", "", "")
      ).to.be.revertedWithCustomError(certificateRegistry, "EmptyDocumentType");
    });

    it("should return valid verification details for an existing certificate (public & read-only)", async function () {
      await certificateRegistry
        .connect(doctor)
        .issueCertificate(sampleCertHash, "Jane Doe", "Medical Certificate", "ipfs://QmMeta");

      const res = await certificateRegistry.connect(publicVerifier).verifyCertificate(sampleCertHash);
      expect(res.exists).to.be.true;
      expect(res.revoked).to.be.false;
      expect(res.issuer).to.equal(doctor.address);
      expect(res.recipient).to.equal("Jane Doe");
      expect(res.documentType).to.equal("Medical Certificate");
    });

    it("should return exists=false for non-existent document hash", async function () {
      const nonExistent = ethers.keccak256(ethers.toUtf8Bytes("random-hash"));
      const res = await certificateRegistry.connect(publicVerifier).verifyCertificate(nonExistent);
      expect(res.exists).to.be.false;
    });

    it("should allow doctor to revoke their certificate and admin to revoke any certificate", async function () {
      await certificateRegistry
        .connect(doctor)
        .issueCertificate(sampleCertHash, "Jane Doe", "Medical Certificate", "ipfs://QmMeta");

      await expect(certificateRegistry.connect(doctor).revokeCertificate(sampleCertHash))
        .to.emit(certificateRegistry, "CertificateRevoked");

      const res = await certificateRegistry.verifyCertificate(sampleCertHash);
      expect(res.revoked).to.be.true;

      // Issue another certificate and revoke as admin
      await certificateRegistry
        .connect(doctor)
        .issueCertificate(sampleCertHash2, "John Doe", "Fitness Certificate", "ipfs://QmMeta2");

      await expect(certificateRegistry.connect(admin).revokeCertificate(sampleCertHash2))
        .to.emit(certificateRegistry, "CertificateRevoked");

      const res2 = await certificateRegistry.verifyCertificate(sampleCertHash2);
      expect(res2.revoked).to.be.true;
    });

    it("should immediately block further certificate issuance once DOCTOR_ROLE is revoked", async function () {
      const DOCTOR_ROLE = await accessControl.DOCTOR_ROLE();
      await accessControl.connect(admin).revokeHealthcareRole(doctor.address, DOCTOR_ROLE);

      await expect(
        certificateRegistry
          .connect(doctor)
          .issueCertificate(sampleCertHash, "Jane Doe", "Medical Certificate", "ipfs://QmMeta")
      ).to.be.revertedWith("CertificateRegistry: caller is not a verified doctor");
    });

    it("should enumerate certificates and support updating access control contract", async function () {
      await certificateRegistry
        .connect(doctor)
        .issueCertificate(sampleCertHash, "Jane Doe", "Medical Certificate", "ipfs://QmMeta");

      expect(await certificateRegistry.getTotalCertificates()).to.be.greaterThan(0);
      const allHashes = await certificateRegistry.getAllCertificateHashes();
      expect(allHashes).to.include(sampleCertHash);

      await expect(
        certificateRegistry.connect(admin).setAccessControlContract(await accessControl.getAddress())
      ).to.not.be.reverted;
    });
  });
});
