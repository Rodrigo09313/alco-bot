import { sql } from './pg';

type AddConsumptionArgs = {
  userId: number;
  pollId: number;
  drinkCode: string; // ВАЖНО: ссылка на drinks(code)
  amount: number;
  unit?: string;     // по умолчанию 'portion'
};

export async function addConsumption(args: AddConsumptionArgs) {
  const unit = args.unit ?? 'portion';
  await sql`
    INSERT INTO consumption_records (user_id, poll_id, drink_code, amount, unit)
    VALUES (${args.userId}, ${args.pollId}, ${args.drinkCode}, ${args.amount}, ${unit})
  `;
}
