import * as bitcoin from "bitcoinjs-lib";
import { initEccLib, networks } from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import * as bip39 from "bip39";
import BIP32Factory, { type BIP32Interface } from "bip32";
import ECPairFactory, { type ECPairInterface } from "ecpair";
import dotenv from "dotenv";

dotenv.config();
initEccLib(ecc);

const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

export class Wallet {
  private hdPath = "m/86'/0'/0'/0/0";
  private network = networks.testnet;
  public ecPair: ECPairInterface;
  public address: string;
  public output: Buffer;
  public publicKey: string;
  private bip32: BIP32Interface;

  constructor() {
    const mnemonic = process.env.MNEMONIC as string;

    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error("invalid mnemonic");
    }
    this.bip32 = bip32.fromSeed(
      bip39.mnemonicToSeedSync(mnemonic),
      this.network
    );
    this.ecPair = ECPair.fromPrivateKey(
      this.bip32.derivePath(this.hdPath).privateKey!,
      { network: this.network }
    );
    const { address, output } = bitcoin.payments.p2tr({
      internalPubkey: this.ecPair.publicKey.slice(1, 33),
      network: this.network,
    });
    this.address = address as string;
    this.output = output as Buffer;
    this.publicKey = this.ecPair.publicKey.toString("hex");
  }

  signPsbt(psbt: bitcoin.Psbt): bitcoin.Psbt {
    const childNode = this.bip32.derivePath(this.hdPath);
    const tweakedChildNode = childNode.tweak(
      bitcoin.crypto.taggedHash("TapTweak", childNode.publicKey.slice(1, 33))
    );
    psbt.signInput(0, tweakedChildNode);
    psbt.validateSignaturesOfInput(0, () => true);
    psbt.finalizeInput(0);
    return psbt;
  }
}
