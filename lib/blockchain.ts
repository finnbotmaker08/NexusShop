export type SupportedCoin = "bitcoin" | "litecoin";

type CoinbasePriceResponse = {
  data?: {
    amount?: string;
    currency?: string;
  };
};

type BlockCypherTransaction = {
  hash?: string;
  confirmations?: number;
  outputs?: Array<{
    value?: number;
    addresses?: string[];
  }>;
};

export function getCoinSymbol(coin: SupportedCoin): "BTC" | "LTC" {
  return coin === "bitcoin" ? "BTC" : "LTC";
}

export async function getEurCoinRate(coin: SupportedCoin): Promise<number> {
  const symbol = getCoinSymbol(coin);
  let response: Response;
  try {
    response = await fetch(
      `https://api.coinbase.com/v2/prices/${symbol}-EUR/spot`,
      {
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      },
    );
  } catch (error) {
    console.error(`Could not fetch the ${symbol}/EUR exchange rate:`, error);
    throw new Error("The current cryptocurrency exchange rate is unavailable.");
  }

  if (!response.ok) {
    console.error(`${symbol}/EUR price provider returned status:`, response.status);
    throw new Error("The current cryptocurrency exchange rate is unavailable.");
  }

  let result: CoinbasePriceResponse;
  try {
    result = (await response.json()) as CoinbasePriceResponse;
  } catch (error) {
    console.error("The exchange-rate provider returned invalid JSON:", error);
    throw new Error("The current cryptocurrency exchange rate is invalid.");
  }

  const amount = Number(result.data?.amount);
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    result.data?.currency !== "EUR"
  ) {
    throw new Error("The current cryptocurrency exchange rate is invalid.");
  }

  return amount;
}

export function cryptoAmountForEur(
  totalMinor: number,
  eurPerCoin: number,
): string {
  if (
    !Number.isSafeInteger(totalMinor) ||
    totalMinor <= 0 ||
    !Number.isFinite(eurPerCoin) ||
    eurPerCoin <= 0
  ) {
    throw new Error("Cannot quote this amount in cryptocurrency.");
  }

  const satoshis = Math.ceil((totalMinor / 100 / eurPerCoin) * 100_000_000);
  if (!Number.isSafeInteger(satoshis) || satoshis <= 0) {
    throw new Error("The cryptocurrency amount is outside the supported range.");
  }

  return (satoshis / 100_000_000).toFixed(8);
}

export async function verifyBlockCypherTransaction({
  coin,
  transactionId,
  address,
  expectedAmount,
}: {
  coin: SupportedCoin;
  transactionId: string;
  address: string;
  expectedAmount: string | number;
}): Promise<{ receivedAmount: string; confirmations: number }> {
  const coinCode = coin === "bitcoin" ? "btc" : "ltc";
  const endpoint = new URL(
    `https://api.blockcypher.com/v1/${coinCode}/main/txs/${encodeURIComponent(transactionId)}`,
  );
  const token = process.env.BLOCKCYPHER_TOKEN;
  if (token) endpoint.searchParams.set("token", token);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    console.error("Could not reach BlockCypher to verify payment:", error);
    throw new Error("The blockchain provider could not be reached. Try again shortly.");
  }

  if (response.status === 404) {
    throw new Error("That transaction is not visible on the blockchain yet.");
  }
  if (!response.ok) {
    console.error("BlockCypher transaction lookup returned status:", response.status);
    throw new Error("The blockchain provider could not verify this transaction.");
  }

  let result: BlockCypherTransaction;
  try {
    result = (await response.json()) as BlockCypherTransaction;
  } catch (error) {
    console.error("BlockCypher returned invalid transaction JSON:", error);
    throw new Error("The blockchain provider returned an invalid transaction.");
  }

  if (result.hash?.toLowerCase() !== transactionId.toLowerCase()) {
    throw new Error("The blockchain transaction ID did not match.");
  }

  const outputs = Array.isArray(result.outputs) ? result.outputs : [];
  let receivedBaseUnits = 0;
  for (const output of outputs) {
    if (
      Array.isArray(output.addresses) &&
      output.addresses.includes(address) &&
      Number.isSafeInteger(output.value) &&
      typeof output.value === "number" &&
      output.value > 0
    ) {
      receivedBaseUnits += output.value;
      if (!Number.isSafeInteger(receivedBaseUnits)) {
        throw new Error("The transaction contains an invalid payment total.");
      }
    }
  }

  const expectedBaseUnits = Math.ceil(Number(expectedAmount) * 100_000_000);
  if (!Number.isSafeInteger(expectedBaseUnits) || expectedBaseUnits <= 0) {
    throw new Error("The order has an invalid cryptocurrency amount.");
  }
  if (receivedBaseUnits < expectedBaseUnits) {
    throw new Error("The transaction has not paid the full amount to the store address.");
  }

  const confirmations =
    typeof result.confirmations === "number" &&
    Number.isSafeInteger(result.confirmations) &&
    result.confirmations >= 0
      ? result.confirmations
      : 0;

  return {
    receivedAmount: (receivedBaseUnits / 100_000_000).toFixed(8),
    confirmations,
  };
}
