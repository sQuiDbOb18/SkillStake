import { useEffect, useState } from "react";
import { AnchorProvider, BN, web3 } from "@coral-xyz/anchor";
import {
  PROGRAM_ID,
  TREASURY_WALLET,
  createProgram,
  createStakeId,
  deriveStakePda,
  formatSol,
  getStakeStatus,
  shortKey,
  type StakeAccount,
} from "./lib/solana";

const DEFAULT_RPC =
  import.meta.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com";

const connection = new web3.Connection(DEFAULT_RPC, "confirmed");

type Notice = { type: "success" | "error"; message: string } | null;

type BrowserWallet = {
  publicKey: web3.PublicKey | null;
  isConnected?: boolean;
  connect: () => Promise<{ publicKey: web3.PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: AnchorProvider["wallet"]["signTransaction"];
  signAllTransactions: AnchorProvider["wallet"]["signAllTransactions"];
};

type WalletOption = {
  label: string;
  wallet: BrowserWallet | null;
};

declare global {
  interface Window {
    solana?: BrowserWallet & { isPhantom?: boolean };
    solflare?: BrowserWallet;
  }
}

const emptyForm = {
  goal: "",
  validator: "",
  deadline: "",
  amount: "0.1",
};

const getWalletOptions = (): WalletOption[] => [
  {
    label: "Phantom",
    wallet: window.solana?.isPhantom ? window.solana : null,
  },
  {
    label: "Solflare",
    wallet: window.solflare ?? null,
  },
];

export default function App() {
  const [stakes, setStakes] = useState<StakeAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState<Notice>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [wallet, setWallet] = useState<BrowserWallet | null>(null);
  const [connectedKey, setConnectedKey] = useState<string | null>(null);
  const [walletOptions, setWalletOptions] = useState<WalletOption[]>([]);

  useEffect(() => {
    setWalletOptions(getWalletOptions());
  }, []);

  const provider =
    wallet && wallet.publicKey
      ? new AnchorProvider(
          connection,
          {
            publicKey: wallet.publicKey,
            signTransaction: wallet.signTransaction,
            signAllTransactions: wallet.signAllTransactions,
          },
          { commitment: "confirmed" },
        )
      : null;

  const program = provider ? createProgram(provider) : null;

  const loadStakes = async () => {
    if (!program) {
      setStakes([]);
      return;
    }

    setLoading(true);
    try {
      const stakeAccountClient = (program.account as Record<
        string,
        { all: () => Promise<any[]> }
      >).stakeAccount;
      const accounts = await stakeAccountClient.all();
      const mapped = accounts
        .map((account: any) => ({
          publicKey: account.publicKey,
          ...account.account,
        }))
        .sort((a: any, b: any) => b.createdAt.toNumber() - a.createdAt.toNumber()) as StakeAccount[];

      setStakes(mapped);
    } catch (error) {
      console.error(error);
      setNotice({
        type: "error",
        message: "Unable to load stakes. Double-check the RPC URL and program ID.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStakes();
  }, [program]);

  const connectWallet = async (option: WalletOption) => {
    if (!option.wallet) {
      setNotice({
        type: "error",
        message: `${option.label} is not installed in this browser.`,
      });
      return;
    }

    try {
      setNotice(null);
      const response = await option.wallet.connect();
      setWallet(option.wallet);
      setWalletName(option.label);
      setConnectedKey(response.publicKey.toBase58());
      setWalletOptions(getWalletOptions());
    } catch (error) {
      console.error(error);
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Wallet connection failed.",
      });
    }
  };

  const disconnectWallet = async () => {
    if (!wallet) return;

    await wallet.disconnect();
    setWallet(null);
    setWalletName(null);
    setConnectedKey(null);
  };

  const createStake = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!program || !wallet?.publicKey) {
      setNotice({ type: "error", message: "Connect a wallet first." });
      return;
    }

    if (!TREASURY_WALLET) {
      setNotice({
        type: "error",
        message: "Set VITE_TREASURY_WALLET before creating stakes.",
      });
      return;
    }

    try {
      setSubmitting(true);
      setNotice(null);

      const validator = new web3.PublicKey(form.validator);
      const treasury = new web3.PublicKey(TREASURY_WALLET);
      const deadlineUnix = Math.floor(new Date(form.deadline).getTime() / 1000);
      const lamports = Math.round(Number(form.amount) * web3.LAMPORTS_PER_SOL);

      const stakeId = createStakeId(wallet.publicKey, form.goal, deadlineUnix);
      const [stakePda] = deriveStakePda(wallet.publicKey, stakeId);

      await program.methods
        .createStake(
          stakeId,
          form.goal,
          new BN(deadlineUnix),
          validator,
          new BN(lamports),
        )
        .accounts({
          stakeAccount: stakePda,
          creator: wallet.publicKey,
          treasury,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      setNotice({
        type: "success",
        message: "Stake created successfully.",
      });
      setForm(emptyForm);
      await loadStakes();
    } catch (error) {
      console.error(error);
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Stake creation failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resolveStake = async (stake: StakeAccount, action: "complete" | "fail") => {
    if (!program || !wallet?.publicKey) {
      setNotice({ type: "error", message: "Connect the validator wallet first." });
      return;
    }

    try {
      setSubmitting(true);
      setNotice(null);

      if (action === "complete") {
        await program.methods
          .completeStake()
          .accounts({
            stakeAccount: stake.publicKey,
            creator: stake.creator,
            validator: wallet.publicKey,
            systemProgram: web3.SystemProgram.programId,
          })
          .rpc();
      } else {
        await program.methods
          .failStake()
          .accounts({
            stakeAccount: stake.publicKey,
            creator: stake.creator,
            validator: wallet.publicKey,
            treasury: stake.treasury,
            systemProgram: web3.SystemProgram.programId,
          })
          .rpc();
      }

      setNotice({
        type: "success",
        message:
          action === "complete"
            ? "Stake marked complete."
            : "Stake marked failed and funds sent to treasury.",
      });
      await loadStakes();
    } catch (error) {
      console.error(error);
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Resolution failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const visibleStakes = !connectedKey
    ? stakes
    : stakes.filter((stake) => {
        const creator = stake.creator.toBase58();
        const validator = stake.validator.toBase58();
        return creator === connectedKey || validator === connectedKey;
      });

  return (
    <div className="shell">
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />

      <header className="hero">
        <div>
          <p className="eyebrow">Solana commitment staking</p>
          <h1>Lock funds behind a promise and let a validator decide the outcome.</h1>
          <p className="lede">
            SkillStake is a lightweight accountability dApp: creators escrow SOL,
            validators resolve the commitment before deadline, and failed goals route
            funds to treasury.
          </p>
        </div>
        <div className="hero-panel">
          {wallet?.publicKey ? (
            <div className="wallet-box">
              <strong>
                {walletName}: {shortKey(wallet.publicKey)}
              </strong>
              <button className="ghost" onClick={() => void disconnectWallet()}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className="wallet-list">
              {walletOptions.map((option) => (
                <button
                  className="ghost"
                  key={option.label}
                  onClick={() => void connectWallet(option)}
                >
                  Connect {option.label}
                </button>
              ))}
            </div>
          )}
          <dl>
            <div>
              <dt>Program</dt>
              <dd>{shortKey(PROGRAM_ID)}</dd>
            </div>
            <div>
              <dt>RPC</dt>
              <dd>{DEFAULT_RPC}</dd>
            </div>
            <div>
              <dt>Treasury</dt>
              <dd>{TREASURY_WALLET ? shortKey(TREASURY_WALLET) : "Unset"}</dd>
            </div>
          </dl>
        </div>
      </header>

      {notice ? <div className={`notice ${notice.type}`}>{notice.message}</div> : null}

      <main className="grid">
        <section className="card">
          <div className="section-head">
            <p className="eyebrow">Create stake</p>
            <h2>Open a commitment</h2>
          </div>
          <form className="stack" onSubmit={createStake}>
            <label>
              Goal
              <textarea
                value={form.goal}
                onChange={(event) =>
                  setForm((current) => ({ ...current, goal: event.target.value }))
                }
                placeholder="Launch the portfolio redesign before Friday"
                maxLength={200}
                required
              />
            </label>
            <label>
              Validator wallet
              <input
                value={form.validator}
                onChange={(event) =>
                  setForm((current) => ({ ...current, validator: event.target.value }))
                }
                placeholder="Validator public key"
                required
              />
            </label>
            <div className="row">
              <label>
                Deadline
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, deadline: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Amount (SOL)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, amount: event.target.value }))
                  }
                  required
                />
              </label>
            </div>
            <button className="primary" type="submit" disabled={!wallet?.publicKey || submitting}>
              {submitting ? "Submitting..." : "Create stake"}
            </button>
          </form>
        </section>

        <section className="card">
          <div className="section-head inline">
            <div>
              <p className="eyebrow">Validator queue</p>
              <h2>Review live commitments</h2>
            </div>
            <button className="ghost" onClick={() => void loadStakes()} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="stakes">
            {visibleStakes.length === 0 ? (
              <div className="empty">
                <p>No stakes to show yet.</p>
                <span>Connect a wallet, create one, or point the app at a live program.</span>
              </div>
            ) : (
              visibleStakes.map((stake) => {
                const status = getStakeStatus(stake.status);
                const canResolve =
                  connectedKey === stake.validator.toBase58() && status === "Pending";

                return (
                  <article className="stake" key={stake.publicKey.toBase58()}>
                    <div className="stake-top">
                      <span className={`pill ${status.toLowerCase()}`}>{status}</span>
                      <span>{formatSol(stake.amount)} SOL</span>
                    </div>
                    <h3>{stake.goal}</h3>
                    <dl>
                      <div>
                        <dt>Creator</dt>
                        <dd>{shortKey(stake.creator)}</dd>
                      </div>
                      <div>
                        <dt>Validator</dt>
                        <dd>{shortKey(stake.validator)}</dd>
                      </div>
                      <div>
                        <dt>Deadline</dt>
                        <dd>{new Date(stake.deadline.toNumber() * 1000).toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt>Treasury</dt>
                        <dd>{shortKey(stake.treasury)}</dd>
                      </div>
                    </dl>
                    {canResolve ? (
                      <div className="actions">
                        <button
                          className="primary"
                          onClick={() => void resolveStake(stake, "complete")}
                          disabled={submitting}
                        >
                          Mark complete
                        </button>
                        <button
                          className="danger"
                          onClick={() => void resolveStake(stake, "fail")}
                          disabled={submitting}
                        >
                          Mark failed
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
