# Interview Talking Points

Quick notes you can reference when discussing this project:

- Purpose: lightweight commitment staking on Solana — creators lock SOL behind a goal and validator resolves outcome before a deadline.
- Tech stack: Anchor (Rust) program, Anchor tests (TypeScript), React + Vite frontend.
- Key design choices:
  - PDA per stake with seeds: `["stake", creator, stake_id_le_bytes]` to allow multiple stakes per user.
  - Funds stored directly in stake PDA; when resolved the PDA is closed and lamports returned to creator or sent to treasury.
  - Validator-signed resolution prevents arbitrary changes; deadlines enforced on-chain.
  - Simple ABI (create, complete, fail) keeps on-chain logic auditable and minimal.
- Safety & UX considerations:
  - Goal max length enforced on-chain to bound account size.
  - Deadlines checked against `Clock::get()`.
  - Frontend derives PDAs and displays human-friendly dates and short keys.
- How to evaluate during an interview:
  - Run `npm run anchor:test` to execute the integration tests.
  - Start `npm run app:dev`, connect Phantom, create a stake, then switch to the validator wallet to resolve.

Potential next improvements to discuss:
- Add events for off-chain indexers and notifications.
- Add an admin-owned global config PDA for treasury management.
- Add filters/indices (per-creator, per-validator) using a separate indexer or on-chain datalog.
