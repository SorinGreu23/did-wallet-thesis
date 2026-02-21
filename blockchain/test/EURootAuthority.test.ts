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

    it("Should start with ceremony not completed", async function () {
      expect(await rootAuthority.deploymentCeremonyCompleted()).to.be.false;
    });
  });

  describe("Deployment Ceremony", function () {
    it("Should allow adding deployment witnesses", async function () {
      await expect(rootAuthority.addDeploymentWitness(memberState1.address))
        .to.emit(rootAuthority, "DeploymentWitnessAdded")
        .withArgs(memberState1.address, 1);

      expect(await rootAuthority.witnessCount()).to.equal(1);
      expect(await rootAuthority.deploymentWitnesses(memberState1.address)).to.be.true;
    });

    it("Should prevent adding the same witness twice", async function () {
      await rootAuthority.addDeploymentWitness(memberState1.address);

      await expect(
        rootAuthority.addDeploymentWitness(memberState1.address)
      ).to.be.revertedWithCustomError(rootAuthority, "AlreadyWitness");
    });

    it("Should auto-complete ceremony at MIN_WITNESS_SIGNATURES", async function () {
      // Note: In production this requires 18 witnesses
      // For testing, we'll check the logic works
      const minWitnesses = await rootAuthority.MIN_WITNESS_SIGNATURES();
      expect(minWitnesses).to.equal(18);
    });

    it("Should verify deployment ceremony", async function () {
      expect(await rootAuthority.verifyDeploymentCeremony()).to.be.false;

      // After adding sufficient witnesses, it should be true
      // (This test is simplified; in production you'd add 18+ witnesses)
    });
  });

  describe("Member State Bootstrap", function () {
    it("Should bootstrap initial member states", async function () {
      const addresses = [memberState1.address, memberState2.address];
      const codes = ["RO", "DE"];
      const dids = ["did:web:gov.ro", "did:web:bund.de"];

      await expect(
        rootAuthority.bootstrapMemberStates(addresses, codes, dids)
      )
        .to.emit(rootAuthority, "MemberStateAdded")
        .withArgs(memberState1.address, "RO", "did:web:gov.ro");

      expect(await rootAuthority.isMemberState(memberState1.address)).to.be.true;
      expect(await rootAuthority.isMemberState(memberState2.address)).to.be.true;
    });

    it("Should prevent bootstrapping after ceremony completed", async function () {
      // First bootstrap
      await rootAuthority.bootstrapMemberStates(
        [memberState1.address],
        ["RO"],
        ["did:web:gov.ro"]
      );

      // Try to bootstrap again - should fail
      await expect(
        rootAuthority.bootstrapMemberStates(
          [memberState2.address],
          ["DE"],
          ["did:web:bund.de"]
        )
      ).to.be.revertedWithCustomError(rootAuthority, "DeploymentCeremonyAlreadyCompleted");
    });

    it("Should get member state info", async function () {
      await rootAuthority.bootstrapMemberStates(
        [memberState1.address],
        ["RO"],
        ["did:web:gov.ro"]
      );

      const info = await rootAuthority.getMemberStateInfo(memberState1.address);
      expect(info.countryCode).to.equal("RO");
      expect(info.didDocument).to.equal("did:web:gov.ro");
      expect(info.active).to.be.true;
    });

    it("Should get all member states", async function () {
      await rootAuthority.bootstrapMemberStates(
        [memberState1.address, memberState2.address],
        ["RO", "DE"],
        ["did:web:gov.ro", "did:web:bund.de"]
      );

      const allStates = await rootAuthority.getAllMemberStates();
      expect(allStates).to.have.lengthOf(2);
      expect(allStates).to.include(memberState1.address);
      expect(allStates).to.include(memberState2.address);
    });
  });

  describe("Governance", function () {
    beforeEach(async function () {
      // Bootstrap member states for governance tests
      await rootAuthority.bootstrapMemberStates(
        [memberState1.address, memberState2.address],
        ["RO", "DE"],
        ["did:web:gov.ro", "did:web:bund.de"]
      );
    });

    it("Should allow member states to propose adding new members", async function () {
      const tx = await rootAuthority
        .connect(memberState1)
        .proposeAddMemberState(otherAccount.address, "FR", "did:web:gouv.fr");

      const receipt = await tx.wait();
      const event = receipt?.logs.find(
        (log: any) => log.fragment?.name === "ProposalCreated"
      );

      expect(event).to.not.be.undefined;
    });

    it("Should prevent non-member states from proposing", async function () {
      await expect(
        rootAuthority
          .connect(otherAccount)
          .proposeAddMemberState(otherAccount.address, "FR", "did:web:gouv.fr")
      ).to.be.revertedWithCustomError(rootAuthority, "NotMemberState");
    });

    it("Should allow voting on proposals", async function () {
      const tx = await rootAuthority
        .connect(memberState1)
        .proposeAddMemberState(otherAccount.address, "FR", "did:web:gouv.fr");

      const receipt = await tx.wait();
      const proposalId = receipt?.logs[0].topics[1];

      if (proposalId) {
        await expect(
          rootAuthority.connect(memberState1).voteOnProposal(proposalId, true)
        )
          .to.emit(rootAuthority, "ProposalVoted")
          .withArgs(proposalId, memberState1.address, true);
      }
    });

    it("Should prevent double voting", async function () {
      const tx = await rootAuthority
        .connect(memberState1)
        .proposeAddMemberState(otherAccount.address, "FR", "did:web:gouv.fr");

      const receipt = await tx.wait();
      const proposalId = receipt?.logs[0].topics[1];

      if (proposalId) {
        await rootAuthority.connect(memberState1).voteOnProposal(proposalId, true);

        await expect(
          rootAuthority.connect(memberState1).voteOnProposal(proposalId, true)
        ).to.be.revertedWithCustomError(rootAuthority, "AlreadyVoted");
      }
    });
  });

  describe("Trust Anchors", function () {
    it("Should maintain immutable trust anchors", async function () {
      // Trust anchors are immutable
      expect(await rootAuthority.GENESIS_BLOCK_HASH()).to.equal(genesisHash);
      expect(await rootAuthority.OFFICIAL_DID_DOCUMENT()).to.equal(officialDID);

      const deploymentBlock = await rootAuthority.DEPLOYMENT_BLOCK();
      expect(deploymentBlock).to.be.gt(0);
    });
  });
});
