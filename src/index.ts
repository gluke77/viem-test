import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync, generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import {
  createPublicClient,
  http,
  formatEther,
  Address,
  PublicClient,
  Account,
  formatUnits,
  createWalletClient,
  parseEther,
  parseUnits,
  WalletClient,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// WIF

// import { base58 } from "@scure/base";

// const WIF_PREFIX = 0x80;

// function privateKeyToWIF(privateKey: Uint8Array): string {
//   const extendedKey = new Uint8Array(privateKey.length + 2);
//   extendedKey[0] = WIF_PREFIX;
//   extendedKey.set(privateKey, 1);
//   extendedKey[privateKey.length + 1] = 0x01; // Compression flag
//   return base58.encode(extendedKey);
// }

async function getBalance(
  client: PublicClient,
  address: Address,
  chainName: string = "Sepolia",
) {
  try {
    const balance = await client.getBalance({ address });
    console.log(
      `💰 Wallet balance on ${chainName}: ${formatEther(balance)} ETH`,
    );
  } catch (error) {
    console.error(`Error fetching balance on ${chainName}:`, error);
  }
}

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "address", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

async function getErc20Balance(
  client: PublicClient,
  address: Address,
  tokenAddress: Address,
) {
  try {
    const [balance, symbol, decimals] = await Promise.all([
      client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      }),
      client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "symbol",
      }),
      client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "decimals",
      }),
    ]);

    console.log(
      `💰 Wallet balance for ${symbol}: ${formatUnits(balance, decimals)}`,
    );
  } catch (error) {
    console.error(`Error fetching ERC20 balance for ${tokenAddress}:`, error);
  }
}

async function getAccount(mnemonic?: string): Promise<Account> {
  if (!mnemonic) {
    console.log("******* Generating New Wallet *******");
    mnemonic = generateMnemonic(wordlist);
  }
  console.log("🌱 Seed Phrase:", mnemonic);

  const seed = mnemonicToSeedSync(mnemonic);
  const masterKey = HDKey.fromMasterSeed(seed);

  if (!masterKey.privateKey) {
    throw new Error("Could not generate master private key.");
  }

  const masterPrivateKeyHex = Buffer.from(masterKey.privateKey).toString("hex");
  console.log("🔑 Master Private Key (Hex):", masterPrivateKeyHex);
  console.log("🔑 Master Private Key (bip32):", masterKey.privateExtendedKey);
  console.log("*************************************");

  // Derive private key for ETH
  console.log("\n******* Deriving ETH Private Key *******");
  const ethKey = masterKey.derive("m/44'/60'/0'/0/0");
  if (!ethKey.privateKey) {
    throw new Error("Could not derive ETH private key.");
  }
  const ethPrivateKeyHex = Buffer.from(ethKey.privateKey).toString("hex");
  console.log("🔑 Derived ETH Private Key (Hex):", ethPrivateKeyHex);
  console.log("🔑 Derived ETH Private Key (bip32):", ethKey.privateExtendedKey);
  console.log("******************************************");

  // Generate public key
  console.log("\n******* Generating Public Key *******");
  const publicKey = ethKey.publicKey;
  if (!publicKey) {
    throw new Error("Could not generate public key.");
  }
  console.log("🔑 Public Key:", Buffer.from(publicKey).toString("hex"));
  console.log("*************************************");

  // Generate wallet address
  console.log("\n******* Generating Wallet Address *******");
  const account = privateKeyToAccount(`0x${ethPrivateKeyHex}`);
  console.log("🏠 Wallet Address:", account.address);
  console.log("***************************************");

  return account;
}

async function sendNative(
  walletClient: WalletClient,
  from: Account,
  to: Address,
  amount: bigint,
) {
  console.log(`\n******* Sending ${formatEther(amount)} ETH to ${to} *******`);
  try {
    const hash = await walletClient.sendTransaction({
      account: from,
      to,
      value: amount,
      chain: undefined,
    });
    console.log(`💸 Transaction hash: ${hash}`);
  } catch (error) {
    console.error("Error sending native currency:", error);
  }
}

async function sendErc20(
  walletClient: WalletClient,
  from: Account,
  to: Address,
  tokenAddress: Address,
  amount: bigint,
) {
  console.log(
    `\n******* Sending ${formatUnits(amount, 6)} USDC to ${to} *******`,
  );
  try {
    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, amount],
      account: from,
      chain: undefined,
    });
    console.log(`💸 Transaction hash: ${hash}`);
  } catch (error) {
    console.error("Error sending ERC20 token:", error);
  }
}

async function main() {
  const mnemonic1 =
    "obvious judge observe crane punch skill plug noodle cute brass ship slush";
  const account1 = await getAccount(mnemonic1);

  const mnemonic2 =
    "rug visit grab large casual ceiling destroy guilt tortoise drill kiss trap";
  const account2 = await getAccount(mnemonic2);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(),
  });

  const walletClient = createWalletClient({
    chain: sepolia,
    transport: http(),
  });

  const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const eurcAddress = "0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4";

  console.log("\n******* Checking Initial Balances *******");
  console.log("--- Account 1 ---");
  await getBalance(publicClient, account1.address);
  await getErc20Balance(publicClient, account1.address, usdcAddress);
  await getErc20Balance(publicClient, account1.address, eurcAddress);
  console.log("--- Account 2 ---");
  await getBalance(publicClient, account2.address);
  await getErc20Balance(publicClient, account2.address, usdcAddress);
  await getErc20Balance(publicClient, account2.address, eurcAddress);
  console.log("****************************************");

  await sendNative(
    walletClient,
    account1,
    account2.address,
    parseEther("0.01"),
  );
  await sendErc20(
    walletClient,
    account1,
    account2.address,
    usdcAddress,
    parseUnits("0.1", 6),
  );

  console.log("\n******* Checking Final Balances *******");
  console.log("--- Account 1 ---");
  await getBalance(publicClient, account1.address);
  await getErc20Balance(publicClient, account1.address, usdcAddress);
  await getErc20Balance(publicClient, account1.address, eurcAddress);
  console.log("--- Account 2 ---");
  await getBalance(publicClient, account2.address);
  await getErc20Balance(publicClient, account2.address, usdcAddress);
  await getErc20Balance(publicClient, account2.address, eurcAddress);
  console.log("****************************************");
}

main().catch(console.error);
