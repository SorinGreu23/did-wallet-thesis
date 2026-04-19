import { expect } from "chai";
import { ethers } from "hardhat";
import { EURootAuthority } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("EURootAuthority", function () {
  let rootAuthority: EURootAuthority;
  let owner: SignerWithAddress;
  let memberState1: SignerWithAddress;
  let memberState2: SignerWithAddress;
  let otherAccount: SignerWithAddress;

  const genesisHash = ethers.keccak256(ethers.toUtf8Bytes("TEST_GENESIS"));
  const officialDID = "did:web:europa.eu";

  beforeEach(async function () {
    [owner, memberState1, memberState2, otherAccount] = await ethers.getSigners();

    const EURootAuthority = await ethers.getContractFactory("EURootAuthority");
    rootAuthority = await EURootAuthority.deploy(genesisHash, officialDID);
    await rootAuthority.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct genesis block hash", async function () {
      expect(await rootAuthority.GENESIS_BLOCK_HASH()).to.equal(genesisHash);
    });

    it("Should set the correct official DID", async function () {
      expect(await rootAuthority.OFFICIAL_DID_DOCUMENT()).to.equal(officialDID);
    });

    it("Should record deployment block", async function () {
      const deploymentBlock = await rootAuthority.DEPLOYMENT_BLOCK();
      expect(deploymentBlock).to.be.gt(0);
    });

    it("Should set the deployer as owner", async function () {
      expect(await rootAuthority.owner()).to.equal(owner.address);
    });
  });

  describe("Member State Management", function () {
    it("Should allow owner to add a member state", async function () {
      await expect(rootAuthority.addMemberState(memberState1.address, "RO", "did:web:gov.ro"))
        .to.emit(rootAuthority, "MemberStateAdded")
        .withArgs(memberState1.address, "RO", "did:web:gov.ro");

      expect(await rootAuthority.isMemberState(memberState1.address)).to.be.true;
    });

    it("Should prevent non-owner from adding a member state", async function () {
      await expect(
        rootAuthority.connect(otherAccount).addMemberState(memberState1.address, "RO", "did:web:gov.ro")
      ).to.be.revertedWithCustomError(rootAuthority, "NotOwner");
    });

    it("Should prevent adding the same member state twice", async function () {
      await rootAuthority.addMemberState(memberState1.address, "RO", "did:web:gov.ro");

      await expect(
        rootAuthority.addMemberState(memberState1.address, "RO", "did:web:gov.ro")
      ).to.be.revertedWithCustomError(rootAuthority, "AlreadyMemberState");
    });

    it("Should allow owner to remove a member state", async function () {
      await rootAuthority.addMemberState(memberState1.address, "RO", "did:web:gov.ro");

      await expect(rootAuthority.removeMemberState(memberState1.address))
        .to.emit(rootAuthority, "MemberStateRemoved");

      expect(await rootAuthority.isMemberState(memberState1.address)).to.be.false;
    });

    it("Should allow owner to update a member state DID", async function () {
      await rootAuthority.addMemberState(memberState1.address, "RO", "did:web:gov.ro");

      await expect(rootAuthority.updateMemberState(memberState1.address, "did:web:new.gov.ro"))
        .to.emit(rootAuthority, "MemberStateUpdated")
        .withArgs(memberState1.address, "did:web:new.gov.ro");
    });

    it("Should get member state info", async function () {
      await rootAuthority.addMemberState(memberState1.address, "RO", "did:web:gov.ro");

      const info = await rootAuthority.getMemberStateInfo(memberState1.address);
      expect(info.countryCode).to.equal("RO");
      expect(info.didDocument).to.equal("did:web:gov.ro");
      expect(info.active).to.be.true;
    });

    it("Should get all member states", async function () {
      await rootAuthority.addMemberState(memberState1.address, "RO", "did:web:gov.ro");
      await rootAuthority.addMemberState(memberState2.address, "DE", "did:web:bund.de");

      const allStates = await rootAuthority.getAllMemberStates();
      expect(allStates).to.have.lengthOf(2);
      expect(allStates).to.include(memberState1.address);
      expect(allStates).to.include(memberState2.address);
    });

    it("Should return correct active member state count", async function () {
      await rootAuthority.addMemberState(memberState1.address, "RO", "did:web:gov.ro");
      await rootAuthority.addMemberState(memberState2.address, "DE", "did:web:bund.de");

      expect(await rootAuthority.getActiveMemberStateCount()).to.equal(2);

      await rootAuthority.removeMemberState(memberState1.address);
      expect(await rootAuthority.getActiveMemberStateCount()).to.equal(1);
    });
  });

  describe("Trust Anchors", function () {
    it("Should maintain immutable trust anchors", async function () {
      expect(await rootAuthority.GENESIS_BLOCK_HASH()).to.equal(genesisHash);
      expect(await rootAuthority.OFFICIAL_DID_DOCUMENT()).to.equal(officialDID);

      const deploymentBlock = await rootAuthority.DEPLOYMENT_BLOCK();
      expect(deploymentBlock).to.be.gt(0);
    });
  });
});

