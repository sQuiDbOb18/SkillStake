# SkillStake

SkillStake is a Solana commitment staking dApp built with Anchor and React. A user escrows SOL into a stake PDA together with a goal, deadline, and validator wallet. The validator can resolve the commitment on or before the deadline:

- `complete_stake`: returns the locked SOL to the creator
- `fail_stake`: sends the locked SOL to the configured treasury wallet

The repo includes:

- an Anchor program in [`programs/commitment-stake/src/lib.rs`](./programs/commitment-stake/src/lib.rs)
- Anchor integration tests in [`tests/commitment-stake.ts`](./tests/commitment-stake.ts)
- a Vite + React frontend in [`app`](./app)
- GitHub Actions for CI and GitHub Pages deployment in [`.github/workflows`](./.github/workflows)

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup and [INTERVIEW.md](INTERVIEW.md) for talking points to discuss in interviews.

## Architecture

Each stake is a PDA derived from:

```text
["stake", creator_pubkey, stake_id_le_bytes]
```

The `stake_id` is generated in the frontend, which lets the same wallet create multiple commitments without collisions.

`StakeAccount` stores:

- `goal`
- `deadline`
- `validator`
- `treasury`
- `amount`
- `creator`
- `created_at`
- `status`

When a stake is created, the program initializes the PDA and transfers the staked SOL from the creator into that PDA. When the validator resolves the stake, the locked amount is moved to the creator or treasury, and the PDA closes back to the creator.

## Project structure

```text
.
├── Anchor.toml
├── Cargo.toml
├── programs/commitment-stake
├── tests
├── app
└── .github/workflows
```

## Prerequisites

- Rust stable
- Solana CLI
- Anchor CLI
- Node.js 20+
- A wallet at `~/.config/solana/id.json` for local Anchor commands

Helpful installs:

```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
```

## Local setup

1. Install JavaScript dependencies:

```bash
npm install
```

2. Build the program:

```bash
npm run anchor:build
```

3. If you are deploying with a new program key, sync the generated program ID:

```bash
anchor keys list
anchor keys sync
```

4. Start a local validator in a separate terminal:

```bash
solana-test-validator
```

5. Run the test suite:

```bash
npm run anchor:test
```

## Frontend setup

Copy the example env file and fill in your network values:

```bash
cp app/.env.example app/.env
```

Recommended `app/.env` for devnet:

```env
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
VITE_PROGRAM_ID=YOUR_DEPLOYED_PROGRAM_ID
VITE_TREASURY_WALLET=YOUR_DEVNET_TREASURY_PUBKEY
VITE_NETWORK=devnet
VITE_BASE_PATH=/
```

Run the frontend:

```bash
npm run app:dev
```

Build the frontend:

```bash
npm run app:build
```

## Deploying the Solana program

### Localnet

```bash
anchor deploy
```

### Devnet

1. Switch Solana CLI:

```bash
solana config set --url devnet
```

2. Fund your deployer:

```bash
solana airdrop 2
```

3. Update `Anchor.toml` provider cluster if needed, then deploy:

```bash
anchor deploy --provider.cluster devnet
```

4. Put the deployed program ID into `app/.env`.

## GitHub-ready deployment

This repo is set up for GitHub Pages deployment of the React app.

### 1. Push the repo to GitHub

```bash
git init
git add .
git commit -m "Initial SkillStake dApp"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Enable Pages

- In GitHub, open `Settings -> Pages`
- Set the source to `GitHub Actions`

### 3. Add repository variables

In `Settings -> Secrets and variables -> Actions -> Variables`, add:

- `VITE_PROGRAM_ID`
- `VITE_SOLANA_RPC_URL`
- `VITE_TREASURY_WALLET`
- `VITE_NETWORK`

The workflow automatically sets:

- `VITE_BASE_PATH=/<repo-name>/`

### 4. Push to `main`

The workflow in [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml) builds `app/dist` and deploys it to GitHub Pages.

## Core flows

### Create stake

- creator enters goal, validator pubkey, deadline, and SOL amount
- frontend generates a `stake_id` and derives the stake PDA
- Anchor creates the stake account and transfers SOL into it

### Complete stake

- validator signs `complete_stake`
- program checks that the signer matches the stake validator
- locked SOL is returned to creator

### Fail stake

- validator signs `fail_stake`
- program checks the validator and treasury
- locked SOL is moved to treasury

## Important behavior

- validators can only resolve a stake while it is still pending
- resolution must happen on or before the stored deadline
- a failed stake can only send funds to the treasury originally stored on creation
- rent is returned to the creator when the stake PDA closes

## Suggested next upgrades

- add an admin-owned global config PDA for treasury management
- add index filtering by creator and validator on-chain
- emit events for easier analytics and notification services
- add support for automatic failure after deadline through an external crank service

## Notes

- The placeholder program ID in this repo is the standard Anchor default until you deploy your own program.
- The frontend uses the checked-in IDL at [`app/src/idl/commitment_stake.json`](./app/src/idl/commitment_stake.json). After changing program interfaces, rebuild and update the frontend copy.
