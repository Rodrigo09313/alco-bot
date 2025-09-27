export type PollFSMState =
  | { name: 'IDLE' }
  | { name: 'POLL_YESNO'; pollId: number }
  | { name: 'POLL_CHOOSE_DRINK'; pollId: number }
  | { name: 'POLL_CHOOSE_AMOUNT'; pollId: number; drinkId: number; drinkName: string };

export const idle: PollFSMState = { name: 'IDLE' };
