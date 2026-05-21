## Contributing & Local testing

Follow these steps to run and evaluate the project locally.

Prerequisites
- Rust (stable)
- Solana CLI
- Anchor CLI (avm recommended)
- Node.js 20+

Install JS deps
```bash
npm install
```

Build the Anchor program
```bash
npm run anchor:build
```

Start local validator (separate terminal)
```bash
solana-test-validator
```

Run tests
```bash
npm run anchor:test
```

Frontend dev
```bash
cp app/.env.example app/.env
# set VITE_PROGRAM_ID and VITE_TREASURY_WALLET in app/.env
npm run app:dev
```

For CI and GitHub Pages the repo already includes workflows in `.github/workflows/`.
