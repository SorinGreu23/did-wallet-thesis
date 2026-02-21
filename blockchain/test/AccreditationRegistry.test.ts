import { expect } from "chai";
import { ethers } from "hardhat";
import { EURootAuthority, AccreditationRegistry } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("AccreditationRegistry", function () {
  let rootAuthority: EURootAuthority;
  let accreditationRegistry: AccreditationRegistry;
  let memberState: SignerWithAddress;
  let ministry: SignerWithAddress;
  let institution: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  const genesisHash = ethers.keccak256(ethers.toUtf8Bytes("TEST_GENESIS"));
  const officialDID = "did:web:europa.eu";

  beforeEach(async function () {
    [memberState, ministry, institution, otherAccount] = await ethers.getSigners();

    // Deploy Root Authority
    const EURootAuthority = await ethers.getContractFactory("EURootAuthority");
    rootAuthority = await EURootAuthority.deploy(genesisHash, officialDID);
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
  });

  describe("Deployment", function () {
    it("Should link to root authority", async function () {
      expect(await accreditationRegistry.rootAuthority()).to.equal(
        await rootAuthority.getAddress()
      );
    });
  });

  describe("Ministry Accreditation", function () {
    it("Should allow member state to accredit ministry", async function () {
      const permissionsHash = ethers.keccak256(ethers.toUtf8Bytes("MINISTRY_PERMISSIONS"));

      await expect(
        accreditationRegistry
          .connect(memberState)
          .issueAccreditation(
            ministry.address,
            2, // AccreditationScope.Ministry
            ethers.ZeroHash, // No parent for ministry (member state is root)
            permissionsHash,
            0 // No expiration
          )
      ).to.emit(accreditationRegistry, "AccreditationIssued");
    });

    it("Should prevent non-member state from issuing ministry accreditation", async function () {
      const permissionsHash = ethers.keccak256(ethers.toUtf8Bytes("MINISTRY_PERMISSIONS"));

      await expect(
        accreditationRegistry
          .connect(otherAccount)
          .issueAccreditation(
            ministry.address,
            2, // AccreditationScope.Ministry
            ethers.ZeroHash,
            permissionsHash,
            0
          )
      ).to.be.revertedWithCustomError(accreditationRegistry, "UnauthorizedIssuer");
    });
  });

  describe("Institution Accreditation", function () {
    let ministryAccreditationId: string;

    beforeEach(async function () {
      // First, member state accredits ministry
      const permissionsHash = ethers.keccak256(ethers.toUtf8Bytes("MINISTRY_PERMISSIONS"));

      const tx = await accreditationRegistry
        .connect(memberState)
        .issueAccreditation(
          ministry.address,
          2, // Ministry
          ethers.ZeroHash,
          permissionsHash,
          0
        );

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "AccreditationIssued"
      );

      if (event && "args" in event) {
        ministryAccreditationId = event.args[0];
      }
    });

    it("Should allow ministry to accredit institution", async function () {
      const permissionsHash = ethers.keccak256(ethers.toUtf8Bytes("INSTITUTION_PERMISSIONS"));

      await expect(
        accreditationRegistry
          .connect(ministry)
          .issueAccreditation(
            institution.address,
            3, // AccreditationScope.Institution
            ministryAccreditationId,
            permissionsHash,
            0
          )
      ).to.emit(accreditationRegistry, "AccreditationIssued");
    });

    it("Should prevent institution accreditation without valid parent", async function () {
      const permissionsHash = ethers.keccak256(ethers.toUtf8Bytes("INSTITUTION_PERMISSIONS"));

      await expect(
        accreditationRegistry
          .connect(ministry)
          .issueAccreditation(
            institution.address,
            3, // Institution
            ethers.ZeroHash, // Invalid: no parent
            permissionsHash,
            0
          )
      ).to.be.revertedWithCustomError(accreditationRegistry, "InvalidParentAccreditation");
    });
  });

  describe("Trust Chain Validation", function () {
    let ministryAccreditationId: string;
    let institutionAccreditationId: string;

    beforeEach(async function () {
      // Set up complete chain: Member State -> Ministry -> Institution
      const ministryPermissions = ethers.keccak256(ethers.toUtf8Bytes("MINISTRY_PERMISSIONS"));

      let tx = await accreditationRegistry
        .connect(memberState)
        .issueAccreditation(
          ministry.address,
          2, // Ministry
          ethers.ZeroHash,
          ministryPermissions,
          0
        );

      let receipt = await tx.wait();
      let event = receipt?.logs.find((log: any) => log.fragment?.name === "AccreditationIssued");
      if (event && "args" in event) {
        ministryAccreditationId = event.args[0];
      }

      const institutionPermissions = ethers.keccak256(ethers.toUtf8Bytes("INSTITUTION_PERMISSIONS"));

      tx = await accreditationRegistry
        .connect(ministry)
        .issueAccreditation(
          institution.address,
          3, // Institution
          ministryAccreditationId,
          institutionPermissions,
          0
        );

      receipt = await tx.wait();
      event = receipt?.logs.find((log: any) => log.fragment?.name === "AccreditationIssued");
      if (event && "args" in event) {
        institutionAccreditationId = event.args[0];
      }
    });

    it("Should validate complete trust chain", async function () {
      const isValid = await accreditationRegistry.validateTrustChain(institutionAccreditationId);
      expect(isValid).to.be.true;
    });

    it("Should retrieve complete trust chain", async function () {
      const chain = await accreditationRegistry.getTrustChain(institutionAccreditationId);
      expect(chain.length).to.be.gte(1);
      expect(chain[chain.length - 1]).to.equal(institutionAccreditationId);
    });

    it("Should verify accreditation scope", async function () {
      const hasValid = await accreditationRegistry.hasValidAccreditation(
        institution.address,
        3 // AccreditationScope.Institution
      );
      expect(hasValid).to.be.true;
    });
  });

  describe("Revocation", function () {
    let accreditationId: string;

    beforeEach(async function () {
      const permissionsHash = ethers.keccak256(ethers.toUtf8Bytes("MINISTRY_PERMISSIONS"));

      const tx = await accreditationRegistry
        .connect(memberState)
        .issueAccreditation(
          ministry.address,
          2, // Ministry
          ethers.ZeroHash,
          permissionsHash,
          0
        );

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => log.fragment?.name === "AccreditationIssued");
      if (event && "args" in event) {
        accreditationId = event.args[0];
      }
    });

    it("Should allow issuer to revoke accreditation", async function () {
      await expect(accreditationRegistry.connect(memberState).revokeAccreditation(accreditationId))
        .to.emit(accreditationRegistry, "AccreditationRevoked")
        .withArgs(accreditationId, memberState.address, await ethers.provider.getBlockNumber() + 1);
    });

    it("Should invalidate trust chain after revocation", async function () {
      await accreditationRegistry.connect(memberState).revokeAccreditation(accreditationId);

      const isValid = await accreditationRegistry.validateTrustChain(accreditationId);
      expect(isValid).to.be.false;
    });
  });

  describe("Query Functions", function () {
    it("Should get accreditations by subject", async function () {
      const permissionsHash = ethers.keccak256(ethers.toUtf8Bytes("MINISTRY_PERMISSIONS"));

      await accreditationRegistry
        .connect(memberState)
        .issueAccreditation(ministry.address, 2, ethers.ZeroHash, permissionsHash, 0);

      const accreds = await accreditationRegistry.getAccreditationsBySubject(ministry.address);
      expect(accreds.length).to.equal(1);
    });

    it("Should get accreditations by issuer", async function () {
      const permissionsHash = ethers.keccak256(ethers.toUtf8Bytes("MINISTRY_PERMISSIONS"));

      await accreditationRegistry
        .connect(memberState)
        .issueAccreditation(ministry.address, 2, ethers.ZeroHash, permissionsHash, 0);

      const accreds = await accreditationRegistry.getAccreditationsByIssuer(memberState.address);
      expect(accreds.length).to.equal(1);
    });
  });
});
