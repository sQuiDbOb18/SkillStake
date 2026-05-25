use anchor_lang::prelude::*;

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
