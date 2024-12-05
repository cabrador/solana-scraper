import {
  Connection,
  ParsedTransactionWithMeta,
  PublicKey,
} from "@solana/web3.js";

import { sleep } from "@117/sleep";
import * as dl from "jsr:@timepp/zero-config-deno-log";
import logSymbols from "npm:log-symbols";

async function createCSV(strings: string[], filePath: string): Promise<void> {
  // Join strings with ';' and add a newline at the end
  const csvContent = strings.join(";") + "\n";

  // Write the content to the file
  await Deno.writeTextFile(filePath, csvContent);
  console.log(`CSV file created at: ${filePath}`);
}

// change date format:
dl.setDateFormat("m-d H:M:S");

function incrementValue(map: Map<string, number>, key: string) {
  const currentValue = map.get(key) || 0; // Default to 0 if key doesn't exist
  map.set(key, currentValue + 1);
}

/**
 * Fetches the list of public keys that have interacted with a given contract.
 * @param connectionUrl - The RPC endpoint to connect to (e.g., 'https://api.mainnet-beta.solana.com').
 * @param contractPublicKey - The public key of the contract as a string.
 * @returns A promise that resolves to a list of unique public keys that interacted with the contract.
 */
async function getInteractingAddresses(
  connectionUrl: string,
  contractPublicKey: string[],
): Promise<string[]> {
  const connection = new Connection(connectionUrl, "confirmed");
  const uniqueAddresses = new Set<string>();
  for (const contract of contractPublicKey) {
    const contractKey = new PublicKey(contract);

    console.info(
      logSymbols.info,
      "Fetching signatures for contract:" + contractKey.toString(),
    );
    // Fetch transaction signatures associated with the contract
    const signatures = await connection.getSignaturesForAddress(contractKey, {
      limit: 1000, // How many transactions per fetch
    });

    let currentBlockSlot = 0;
    // Fetch and parse each transaction to find interacting addresses
    for (const signatureInfo of signatures) {
      if (currentBlockSlot != signatureInfo.slot) {
        console.info(
          logSymbols.info,
          "New block slot!",
          signatureInfo.slot,
        );
        currentBlockSlot = signatureInfo.slot!;
      }
      let transaction: ParsedTransactionWithMeta | null;
      try {
        transaction = await connection
          .getParsedTransaction(
            signatureInfo.signature,
            { "maxSupportedTransactionVersion": 0 },
          );
      } catch (error) {
        console.error(
          logSymbols.error,
          "Error fetching transaction: ",
          error,
        );
        // sleep for a ten seconds on error
        console.log(logSymbols.info, "Sleeping for 10 seconds");
        await sleep(10000)
        console.log(logSymbols.info, "Continuing...");
        continue
        // return Array.from(uniqueAddresses);
      }

      if (!transaction) {
        console.warn(logSymbols.warning, "Transaction not found");
        continue;
      }
      if (!transaction.transaction.message.accountKeys) {
        console.warn(logSymbols.warning, "Message not found");
        continue;
      }

      // Add all account keys from the transaction to the set
      transaction.transaction.message.accountKeys.forEach((account) => {
        if (account.signer) {
          if (!uniqueAddresses.has(account.pubkey.toString())) {
            console.info(
                logSymbols.success,
                "Found new unique address: ",
                account.pubkey.toString(),
                "\nTotal unique addresses: ",
                uniqueAddresses.size+1,
            );
          }
          uniqueAddresses.add(account.pubkey.toString());
          return
        }
      });

      await sleep(100);
    }
  }

  // Return the list of unique addresses
  return Array.from(uniqueAddresses);
}

(async () => {
  const rpcUrl = "https://endpoints.omniatech.io/v1/sol/mainnet/public";
  const contracts = [
    "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
    "2wT8Yq49kHgDzXuPxZSaeLaH1qbmGXtEyPy64bL7aD3c",
    "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
  ];
  const CSVFilePath = "addreses1.csv";

  try {
    const addresses = await getInteractingAddresses(rpcUrl, contracts);
    console.info(
      logSymbols.success,
      "Unique interacting addresses: ",
      addresses,
    );
    await createCSV(addresses, CSVFilePath);
  } catch (error) {
    console.error(
      logSymbols.error,
      "Error fetching interacting addresses: ",
      error,
    );
  }
})();
