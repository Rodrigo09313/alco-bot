// Репозиторий записей потребления: одна запись = один тип напитка и количество "порций".
// amount и created_at теперь есть в схеме.

import { q } from './sql';

export async function addConsumption(p: {
  userId: number;
  pollId: number;
  drinkCode: string; // FK на drinks(code)
  amount: number;   // кол-во условных порций
}) {
  // Защита от мусора
  const amt = Math.max(1, Math.floor(p.amount));

  // Вставляем запись; created_at = now() (по умолчанию на уровне БД)
  await q`
    INSERT INTO consumption_records (user_id, poll_id, drink_code, amount)
    VALUES (${p.userId}, ${p.pollId}, ${p.drinkCode}, ${amt})
  `;
}
