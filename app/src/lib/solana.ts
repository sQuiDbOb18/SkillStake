import { AnchorProvider, BN, Program, web3 } from "@coral-xyz/anchor";
import { sha256 } from "@noble/hashes/sha256";
import type { Idl } from "@coral-xyz/anchor";
import idl from "../idl/commitment_stake.json";

export type StakeStatus = "Pending" | "Completed" | "Failed";

export type StakeAccount = {
  publicKey: web3.PublicKey;
  creator: web3.PublicKey;
  validator: web3.PublicKey;
  treasury: web3.PublicKey;
  stakeId: BN;
  deadline: BN;
  amount: BN;
  createdAt: BN;
  status: number;
  bump: number;
  goal: string;
};

export const PROGRAM_ID = new web3.PublicKey(
  import.meta.env.VITE_PROGRAM_ID || "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQhgwdnB6m",
);

export const TREASURY_WALLET = import.meta.env.VITE_TREASURY_WALLET;

export const createProgram = (provider: AnchorProvider) =>
  new Program(idl as unknown as Idl, provider);

export const deriveStakePda = (
  creator: web3.PublicKey,
  stakeId: BN,
): [web3.PublicKey, number] =>
  web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("stake"),
      creator.toBuffer(),
      stakeId.toArrayLike(Buffer, "le", 8),
    ],
    PROGRAM_ID,
  );

export const getStakeStatus = (status: number): StakeStatus => {
  if (status === 1) return "Completed";
  if (status === 2) return "Failed";
  return "Pending";
};

export const shortKey = (key: web3.PublicKey | string) => {
  const value = typeof key === "string" ? key : key.toBase58();
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

export const formatSol = (lamports: BN) =>
  (lamports.toNumber() / web3.LAMPORTS_PER_SOL).toFixed(3);

export const createStakeId = (
  wallet: web3.PublicKey,
  goal: string,
  deadline: number,
) => {
  const encoded = new TextEncoder().encode(
    `${wallet.toBase58()}:${goal}:${deadline}:${Date.now()}`,
  );
  const digest = sha256(encoded).slice(0, 8);
  return new BN(Buffer.from(digest), "le");
};
