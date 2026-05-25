#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQhgwdnB6m");

mod errors;
mod instructions;
mod state;
mod transfer;

pub use errors::CommitmentStakeError;
pub use state::{StakeAccount, StakeStatus};

#[derive(Accounts)]
#[instruction(stake_id: u64, goal: String, deadline: i64, validator: Pubkey, amount: u64)]
pub struct CreateStake<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + StakeAccount::INIT_SPACE,
        seeds = [b"stake", creator.key().as_ref(), &stake_id.to_le_bytes()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut)]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveStake<'info> {
    #[account(
        mut,
        seeds = [b"stake", creator.key().as_ref(), &stake_account.stake_id.to_le_bytes()],
        bump = stake_account.bump,
        has_one = creator @ CommitmentStakeError::InvalidCreator,
        has_one = validator @ CommitmentStakeError::InvalidValidator,
        close = creator
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(mut)]
    pub creator: SystemAccount<'info>,
    pub validator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FailStake<'info> {
    #[account(
        mut,
        seeds = [b"stake", creator.key().as_ref(), &stake_account.stake_id.to_le_bytes()],
        bump = stake_account.bump,
        has_one = creator @ CommitmentStakeError::InvalidCreator,
        has_one = validator @ CommitmentStakeError::InvalidValidator,
        has_one = treasury @ CommitmentStakeError::InvalidTreasury,
        close = creator
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(mut)]
    pub creator: SystemAccount<'info>,
    pub validator: Signer<'info>,
    #[account(mut)]
    pub treasury: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[program]
pub mod commitment_stake {
    use super::*;

    pub fn create_stake(
        ctx: Context<CreateStake>,
        stake_id: u64,
        goal: String,
        deadline: i64,
        validator: Pubkey,
        amount: u64,
    ) -> Result<()> {
        instructions::create_stake(ctx, stake_id, goal, deadline, validator, amount)
    }

    pub fn complete_stake(ctx: Context<ResolveStake>) -> Result<()> {
        instructions::complete_stake(ctx)
    }

    pub fn fail_stake(ctx: Context<FailStake>) -> Result<()> {
        instructions::fail_stake(ctx)
    }
}
