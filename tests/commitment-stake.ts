import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";

describe("commitment-stake", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CommitmentStake as Program;
  const stakeAccountClient = () =>
    program.account as Record<
      string,
      {
        fetch: (pubkey: anchor.web3.PublicKey) => Promise<any>;
        fetchNullable: (pubkey: anchor.web3.PublicKey) => Promise<any>;
      }
    >;

  const creator = provider.wallet;
  const validator = anchor.web3.Keypair.generate();
  const treasury = anchor.web3.Keypair.generate();

  const airdrop = async (pubkey: anchor.web3.PublicKey) => {
    const sig = await provider.connection.requestAirdrop(
      pubkey,
      2 * anchor.web3.LAMPORTS_PER_SOL,
    );
    await provider.connection.confirmTransaction(sig, "confirmed");
  };

  before(async () => {
    await airdrop(validator.publicKey);
    await airdrop(treasury.publicKey);
  });

  it("creates and completes a stake", async () => {
    const stakeId = new anchor.BN(Date.now());
    const goal = "Ship the MVP landing page";
    const deadline = new anchor.BN(
      Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    );
    const amount = new anchor.BN(0.25 * anchor.web3.LAMPORTS_PER_SOL);

    const [stakePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stake"),
        creator.publicKey.toBuffer(),
        stakeId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );

    await program.methods
      .createStake(
        stakeId,
        goal,
        deadline,
        validator.publicKey,
        amount,
      )
      .accounts({
        stakeAccount: stakePda,
        creator: creator.publicKey,
        treasury: treasury.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await stakeAccountClient().stakeAccount.fetch(stakePda);
    expect(account.goal).to.equal(goal);
    expect(account.amount.toString()).to.equal(amount.toString());
    expect(account.validator.toBase58()).to.equal(
      validator.publicKey.toBase58(),
    );

    await program.methods
      .completeStake()
      .accounts({
        stakeAccount: stakePda,
        creator: creator.publicKey,
        validator: validator.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([validator])
      .rpc();

    const closedAccount = await stakeAccountClient().stakeAccount.fetchNullable(
      stakePda,
    );
    expect(closedAccount).to.equal(null);
  });

  it("creates and fails a stake", async () => {
    const stakeId = new anchor.BN(Date.now() + 1);
    const amount = new anchor.BN(0.4 * anchor.web3.LAMPORTS_PER_SOL);

    const [stakePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("stake"),
        creator.publicKey.toBuffer(),
        stakeId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );

    const treasuryBefore = await provider.connection.getBalance(
      treasury.publicKey,
    );

    await program.methods
      .createStake(
        stakeId,
        "Publish audited validator docs",
        new anchor.BN(Math.floor(Date.now() / 1000) + 60 * 60 * 24),
        validator.publicKey,
        amount,
      )
      .accounts({
        stakeAccount: stakePda,
        creator: creator.publicKey,
        treasury: treasury.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .failStake()
      .accounts({
        stakeAccount: stakePda,
        creator: creator.publicKey,
        validator: validator.publicKey,
        treasury: treasury.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([validator])
      .rpc();

    const treasuryAfter = await provider.connection.getBalance(
      treasury.publicKey,
    );
    expect(treasuryAfter - treasuryBefore).to.equal(amount.toNumber());
  });
});
