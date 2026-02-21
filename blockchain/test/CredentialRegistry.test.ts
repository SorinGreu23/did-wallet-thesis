import { expect } from "chai";
import { ethers } from "hardhat";
import { EURootAuthority, AccreditationRegistry, CredentialRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CredentialRegistry", function () {
  let rootAuthority: EURootAuthority;
  let accreditationRegistry: AccreditationRegistry;
  let credentialRegistry: CredentialRegistry;
  let memberState: SignerWithAddress;
  let ministry: SignerWithAddress;
  let institution: SignerWithAddress;
  let student: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  let institutionAccreditationId: string;

  beforeEach(async function () {
    [memberState, ministry, institution, student, otherAccount] = await ethers.getSigners();

    // Deploy Root Authority
    const EURootAuthority = await ethers.getContractFactory("EURootAuthority");
    rootAuthority = await EURootAuthority.deploy(
      ethers.keccak256(ethers.toUtf8Bytes("TEST_GENESIS")),
      "did:web:europa.eu"
    );
    await rootAuthority.waitForDeployment();

    // Bootstrap member state
    await rootAuthority.bootstrapMemberStates(
      [memberState.address],
      ["RO"],
      ["did:web:gov.ro"]
    );

    // Deploy Accreditation Registry
    const AccreditationRegistry = await ethers.getContractFactory("AccreditationRegistry");
    accreditationRegistry = await AccreditationRegistry.deploy(
      await rootAuthority.getAddress()
    );
    await accreditationRegistry.waitForDeployment();

    // Deploy Credential Registry
    const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
    credentialRegistry = await CredentialRegistry.deploy(
      await accreditationRegistry.getAddress()
    );
    await credentialRegistry.waitForDeployment();

    // Set up accreditation chain: Member State -> Ministry -> Institution
    const ministryPermissions = ethers.keccak256(ethers.toUtf8Bytes("MINISTRY_PERMISSIONS"));
    let tx = await accreditationRegistry
      .connect(memberState)
      .issueAccreditation(ministry.address, 2, ethers.ZeroHash, ministryPermissions, 0);

    let receipt = await tx.wait();
    let event = receipt?.logs.find((log: any) => log.fragment?.name === "AccreditationIssued");
    const ministryAccreditationId = event && "args" in event ? event.args[0] : ethers.ZeroHash;

    const institutionPermissions = ethers.keccak256(ethers.toUtf8Bytes("INSTITUTION_PERMISSIONS"));
    tx = await accreditationRegistry
      .connect(ministry)
      .issueAccreditation(institution.address, 3, ministryAccreditationId, institutionPermissions, 0);

    receipt = await tx.wait();
    event = receipt?.logs.find((log: any) => log.fragment?.name === "AccreditationIssued");
    institutionAccreditationId = event && "args" in event ? event.args[0] : ethers.ZeroHash;
  });

  describe("Deployment", function () {
    it("Should link to accreditation registry", async function () {
      expect(await credentialRegistry.accreditationRegistry()).to.equal(
        await accreditationRegistry.getAddress()
      );
    });

    it("Should set correct required issuer scope", async function () {
      expect(await credentialRegistry.REQUIRED_ISSUER_SCOPE()).to.equal(3); // Institution
    });
  });

  describe("Credential Recording", function () {
    it("Should allow institution to record credential", async function () {
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("DIPLOMA_CONTENT"));

      await expect(
        credentialRegistry
          .connect(institution)
          .recordCredential(
            student.address,
            credentialHash,
            "UniversityDegree",
            institutionAccreditationId,
            0
          )
      ).to.emit(credentialRegistry, "CredentialIssued");
    });

    it("Should prevent non-accredited entity from recording credential", async function () {
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("FAKE_DIPLOMA"));
      const fakeAccreditationId = ethers.keccak256(ethers.toUtf8Bytes("FAKE"));

      await expect(
        credentialRegistry
          .connect(otherAccount)
          .recordCredential(
            student.address,
            credentialHash,
            "UniversityDegree",
            fakeAccreditationId,
            0
          )
      ).to.be.reverted; // Will revert when trying to get non-existent accreditation
    });

    it("Should prevent credential recording with wrong scope accreditation", async function () {
      // Try to use ministry accreditation (wrong scope)
      const ministryPermissions = ethers.keccak256(ethers.toUtf8Bytes("MINISTRY_PERMISSIONS"));
      const tx = await accreditationRegistry
        .connect(memberState)
        .issueAccreditation(otherAccount.address, 2, ethers.ZeroHash, ministryPermissions, 0);

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => log.fragment?.name === "AccreditationIssued");
      const wrongScopeAccredId = event && "args" in event ? event.args[0] : ethers.ZeroHash;

      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("DIPLOMA"));

      await expect(
        credentialRegistry
          .connect(otherAccount)
          .recordCredential(
            student.address,
            credentialHash,
            "UniversityDegree",
            wrongScopeAccredId,
            0
          )
      ).to.be.revertedWithCustomError(credentialRegistry, "InvalidAccreditation");
    });
  });

  describe("Credential Status", function () {
    let credentialId: string;

    beforeEach(async function () {
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("DIPLOMA_CONTENT"));

      const tx = await credentialRegistry
        .connect(institution)
        .recordCredential(
          student.address,
          credentialHash,
          "UniversityDegree",
          institutionAccreditationId,
          0
        );

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => log.fragment?.name === "CredentialIssued");
      credentialId = event && "args" in event ? event.args[0] : ethers.ZeroHash;
    });

    it("Should return active status for new credential", async function () {
      const status = await credentialRegistry.getCredentialStatus(credentialId);
      expect(status).to.equal(0); // CredentialStatus.Active
    });

    it("Should confirm credential is active", async function () {
      const isActive = await credentialRegistry.isActive(credentialId);
      expect(isActive).to.be.true;
    });

    it("Should verify credential completely", async function () {
      const [isValid, status, trustChainValid] = await credentialRegistry.verifyCredential(
        credentialId
      );

      expect(isValid).to.be.true;
      expect(status).to.equal(0); // Active
      expect(trustChainValid).to.be.true;
    });
  });

  describe("Credential Revocation", function () {
    let credentialId: string;

    beforeEach(async function () {
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("DIPLOMA_CONTENT"));

      const tx = await credentialRegistry
        .connect(institution)
        .recordCredential(
          student.address,
          credentialHash,
          "UniversityDegree",
          institutionAccreditationId,
          0
        );

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => log.fragment?.name === "CredentialIssued");
      credentialId = event && "args" in event ? event.args[0] : ethers.ZeroHash;
    });

    it("Should allow issuer to revoke credential", async function () {
      await expect(
        credentialRegistry.connect(institution).revokeCredential(credentialId, "Academic fraud")
      )
        .to.emit(credentialRegistry, "CredentialRevoked")
        .withArgs(credentialId, institution.address, await ethers.provider.getBlockNumber() + 1, "Academic fraud");
    });

    it("Should prevent non-issuer from revoking", async function () {
      await expect(
        credentialRegistry.connect(otherAccount).revokeCredential(credentialId, "Unauthorized")
      ).to.be.revertedWithCustomError(credentialRegistry, "Unauthorized");
    });

    it("Should mark revoked credential as inactive", async function () {
      await credentialRegistry.connect(institution).revokeCredential(credentialId, "Test");

      const isActive = await credentialRegistry.isActive(credentialId);
      expect(isActive).to.be.false;

      const status = await credentialRegistry.getCredentialStatus(credentialId);
      expect(status).to.equal(1); // CredentialStatus.Revoked
    });
  });

  describe("Credential Suspension", function () {
    let credentialId: string;

    beforeEach(async function () {
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("DIPLOMA_CONTENT"));

      const tx = await credentialRegistry
        .connect(institution)
        .recordCredential(
          student.address,
          credentialHash,
          "UniversityDegree",
          institutionAccreditationId,
          0
        );

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => log.fragment?.name === "CredentialIssued");
      credentialId = event && "args" in event ? event.args[0] : ethers.ZeroHash;
    });

    it("Should allow issuer to suspend credential", async function () {
      await expect(
        credentialRegistry.connect(institution).suspendCredential(credentialId, "Under investigation")
      ).to.emit(credentialRegistry, "CredentialSuspended");
    });

    it("Should allow reactivation of suspended credential", async function () {
      await credentialRegistry.connect(institution).suspendCredential(credentialId, "Test");

      await expect(credentialRegistry.connect(institution).reactivateCredential(credentialId))
        .to.emit(credentialRegistry, "CredentialReactivated");

      const status = await credentialRegistry.getCredentialStatus(credentialId);
      expect(status).to.equal(0); // Active
    });
  });

  describe("Query Functions", function () {
    it("Should get credentials by holder", async function () {
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("DIPLOMA_CONTENT"));

      await credentialRegistry
        .connect(institution)
        .recordCredential(
          student.address,
          credentialHash,
          "UniversityDegree",
          institutionAccreditationId,
          0
        );

      const creds = await credentialRegistry.getCredentialsByHolder(student.address);
      expect(creds.length).to.equal(1);
    });

    it("Should get credentials by issuer", async function () {
      const credentialHash = ethers.keccak256(ethers.toUtf8Bytes("DIPLOMA_CONTENT"));

      await credentialRegistry
        .connect(institution)
        .recordCredential(
          student.address,
          credentialHash,
          "UniversityDegree",
          institutionAccreditationId,
          0
        );

      const creds = await credentialRegistry.getCredentialsByIssuer(institution.address);
      expect(creds.length).to.equal(1);
    });
  });

  describe("Batch Verification", function () {
    it("Should batch verify multiple credentials", async function () {
      const hash1 = ethers.keccak256(ethers.toUtf8Bytes("DIPLOMA_1"));
      const hash2 = ethers.keccak256(ethers.toUtf8Bytes("DIPLOMA_2"));

      const tx1 = await credentialRegistry
        .connect(institution)
        .recordCredential(student.address, hash1, "UniversityDegree", institutionAccreditationId, 0);

      const receipt1 = await tx1.wait();
      const event1 = receipt1?.logs.find((log: any) => log.fragment?.name === "CredentialIssued");
      const credId1 = event1 && "args" in event1 ? event1.args[0] : ethers.ZeroHash;

      const tx2 = await credentialRegistry
        .connect(institution)
        .recordCredential(student.address, hash2, "UniversityDegree", institutionAccreditationId, 0);

      const receipt2 = await tx2.wait();
      const event2 = receipt2?.logs.find((log: any) => log.fragment?.name === "CredentialIssued");
      const credId2 = event2 && "args" in event2 ? event2.args[0] : ethers.ZeroHash;

      const results = await credentialRegistry.batchVerifyCredentials([credId1, credId2]);
      expect(results[0]).to.be.true;
      expect(results[1]).to.be.true;
    });
  });
});
