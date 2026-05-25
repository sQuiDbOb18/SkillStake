use anchor_lang::prelude::*;

use crate::errors::CommitmentStakeError;

pub fn transfer_lamports(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
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
