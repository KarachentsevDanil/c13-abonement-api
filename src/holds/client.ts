// Клієнт catalog-api: броні зберігає сервіс каталогу, сюди вони приходять по HTTP.
export interface Hold { id: number; bookId: number; readerId: number }

export interface HoldsClient {
  // Усі активні броні книги, зокрема бронь самого читача.
  // Таймаут запиту 2 с, повторних спроб немає.
  activeForBook(bookId: number): Promise<Hold[]>;
}

export const HOLDS_TIMEOUT_MS = 2000;

export function createHoldsClient(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = HOLDS_TIMEOUT_MS,
): HoldsClient {
  return {
    async activeForBook(bookId) {
      const res = await fetchImpl(`${baseUrl}/books/${bookId}/holds?status=active`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`catalog-api responded ${res.status}`);
      return (await res.json()) as Hold[];
    },
  };
}
