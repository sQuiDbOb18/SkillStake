use anchor_lang::prelude::*;

pub const MAX_GOAL_LENGTH: usize = 200;

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
