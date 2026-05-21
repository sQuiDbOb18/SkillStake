use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQhgwdnB6m");

const MAX_GOAL_LENGTH: usize = 200;

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
        let now = Clock::get()?.unix_timestamp;

        require!(!goal.trim().is_empty(), CommitmentStakeError::GoalRequired);
        require!(
            goal.chars().count() <= MAX_GOAL_LENGTH,
            CommitmentStakeError::GoalTooLong
        );
        require!(deadline > now, CommitmentStakeError::DeadlineMustBeInFuture);
        require!(amount > 0, CommitmentStakeError::AmountMustBePositive);

        let stake_account = &mut ctx.accounts.stake_account;
        stake_account.creator = ctx.accounts.creator.key();
        stake_account.validator = validator;
        stake_account.treasury = ctx.accounts.treasury.key();
        stake_account.stake_id = stake_id;
        stake_account.goal = goal;
        stake_account.deadline = deadline;
        stake_account.amount = amount;
        stake_account.created_at = now;
        stake_account.status = StakeStatus::Pending as u8;
        stake_account.bump = ctx.bumps.stake_account;

        let transfer_accounts = system_program::Transfer {
            from: ctx.accounts.creator.to_account_info(),
            to: stake_account.to_account_info(),
        };

        let transfer_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_accounts,
        );

        system_program::transfer(transfer_context, amount)?;

        Ok(())
    }

    pub fn complete_stake(ctx: Context<ResolveStake>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let amount = {
            let stake_account = &ctx.accounts.stake_account;
            require!(
                stake_account.status == StakeStatus::Pending as u8,
                CommitmentStakeError::StakeAlreadyResolved
            );
            require!(now <= stake_account.deadline, CommitmentStakeError::DeadlinePassed);
            stake_account.amount
        };

        transfer_lamports(
            &ctx.accounts.stake_account.to_account_info(),
            &ctx.accounts.creator.to_account_info(),
            amount,
        )?;

        ctx.accounts.stake_account.status = StakeStatus::Completed as u8;

        Ok(())
    }

    pub fn fail_stake(ctx: Context<FailStake>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let amount = {
            let stake_account = &ctx.accounts.stake_account;
            require!(
                stake_account.status == StakeStatus::Pending as u8,
                CommitmentStakeError::StakeAlreadyResolved
            );
            require!(now <= stake_account.deadline, CommitmentStakeError::DeadlinePassed);
            stake_account.amount
        };

        transfer_lamports(
            &ctx.accounts.stake_account.to_account_info(),
            &ctx.accounts.treasury.to_account_info(),
            amount,
        )?;

        ctx.accounts.stake_account.status = StakeStatus::Failed as u8;

        Ok(())
    }
}

fn transfer_lamports(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
    let from_balance = from.lamports();
    require!(
        from_balance >= amount,
        CommitmentStakeError::InsufficientVaultBalance
    );

    **from.try_borrow_mut_lamports()? = from_balance
        .checked_sub(amount)
        .ok_or(CommitmentStakeError::MathOverflow)?;
    **to.try_borrow_mut_lamports()? = to
        .lamports()
        .checked_add(amount)
        .ok_or(CommitmentStakeError::MathOverflow)?;

    Ok(())
}

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

#[account]
#[derive(InitSpace)]
pub struct StakeAccount {
    pub creator: Pubkey,
    pub validator: Pubkey,
    pub treasury: Pubkey,
    pub stake_id: u64,
    pub deadline: i64,
    pub amount: u64,
    pub created_at: i64,
    pub status: u8,
    pub bump: u8,
    #[max_len(200)]
    pub goal: String,
}

#[repr(u8)]
pub enum StakeStatus {
    Pending = 0,
    Completed = 1,
    Failed = 2,
}

#[error_code]
pub enum CommitmentStakeError {
    #[msg("A goal is required.")]
    GoalRequired,
    #[msg("The goal is too long.")]
    GoalTooLong,
    #[msg("The deadline must be in the future.")]
    DeadlineMustBeInFuture,
    #[msg("The deadline has already passed.")]
    DeadlinePassed,
    #[msg("The staked amount must be positive.")]
    AmountMustBePositive,
    #[msg("This stake has already been resolved.")]
    StakeAlreadyResolved,
    #[msg("The provided creator does not match the stake.")]
    InvalidCreator,
    #[msg("The provided validator does not match the stake.")]
    InvalidValidator,
    #[msg("The provided treasury does not match the stake.")]
    InvalidTreasury,
    #[msg("The stake vault does not hold enough lamports.")]
    InsufficientVaultBalance,
    #[msg("Math overflow occurred.")]
    MathOverflow,
}
