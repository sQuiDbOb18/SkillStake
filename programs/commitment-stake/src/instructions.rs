use anchor_lang::{prelude::*, system_program};

use crate::{
    errors::CommitmentStakeError,
    state::{StakeStatus, MAX_GOAL_LENGTH},
    transfer::transfer_lamports,
    CreateStake, FailStake, ResolveStake,
};

pub fn create_stake(
    ctx: Context<CreateStake>,
    stake_id: u64,
    goal: String,
    deadline: i64,
    validator: Pubkey,
    amount: u64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    validate_create_stake(&goal, deadline, amount, now)?;

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

fn validate_create_stake(goal: &str, deadline: i64, amount: u64, now: i64) -> Result<()> {
    require!(!goal.trim().is_empty(), CommitmentStakeError::GoalRequired);
    require!(
        goal.chars().count() <= MAX_GOAL_LENGTH,
        CommitmentStakeError::GoalTooLong
    );
    require!(deadline > now, CommitmentStakeError::DeadlineMustBeInFuture);
    require!(amount > 0, CommitmentStakeError::AmountMustBePositive);

    Ok(())
}
