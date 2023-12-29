import * as sjcl from "sjcl";
import { Buffer } from "./internal_buffer";

export type ArrayLike = ArrayBuffer | string | Buffer | ArrayBufferView;
export type KeyData = string | ArrayBuffer | ArrayBufferView;

/**
 * Checks if a number represented by an ArrayBufferView is prime.
 *
 * @param {ArrayBufferView} candidate - The ArrayBufferView representing the number to check.
 * @param {number} num_checks - The number of checks to perform.
 * @returns {boolean} - Returns true if the number is prime, false otherwise.
 */
export function checkPrimeSync(candidate: ArrayBufferView, num_checks: number): boolean {
    // Convert ArrayBufferView to number
    let num = new Uint32Array(candidate.buffer)[0];

    // Check if num is less than 2 (not a prime number)
    if (num < 2) return false;

    // Check if num is divisible by any number up to its square root
    for (let i = 2, sqrt = Math.sqrt(num); i <= sqrt; i++) {
        if (num % i === 0) return false;
    }

    // If no factors found, num is a prime number
    return true;
}

/**
 * Generates a random prime number of a given size.
 *
 * @param {number} size - The size of the prime number to generate.
 * @param {boolean} safe - If true, generates a safe prime (a prime number that is 2 less than another prime number).
 * @param {ArrayBufferView} [add] - An ArrayBufferView representing a number to add to the generated prime number.
 * @param {ArrayBufferView} [rem] - An ArrayBufferView representing a number to take the remainder of the generated prime number.
 * @returns {ArrayBuffer} - Returns an ArrayBuffer representing the generated prime number.
 */
export function randomPrime(
    size: number,
    safe: boolean,
    add?: ArrayBufferView,
    rem?: ArrayBufferView
): ArrayBuffer {
    let prime: number;
    do {
        prime = sjcl.random.randomWords(1, 0)[0];
        prime = Math.abs(prime) % 2 ** size;
        if (safe) {
            prime = 2 * prime + 1;
        }
        if (add) {
            prime += new Uint32Array(add.buffer)[0];
        }
        if (rem) {
            prime %= new Uint32Array(rem.buffer)[0];
        }
    } while (!checkPrimeSync(new Uint32Array([prime]), 10));

    return new Uint32Array([prime]).buffer;
}

// hkdf
export function getHkdf(
    hash: string,
    key: ArrayLike,
    salt: ArrayLike,
    info: ArrayLike,
    length: number
): ArrayBuffer {
    // Convert key, salt, and info to bitArrays
    let keyBits = sjcl.codec.utf8String.toBits(key.toString());
    let saltBits = sjcl.codec.utf8String.toBits(salt.toString());
    let infoBits = sjcl.codec.utf8String.toBits(info.toString());

    // Use sjcl.misc.hkdf to generate the key
    // @ts-ignore
    let derivedKeyBits = sjcl.misc.hkdf(keyBits, length, saltBits, hash, infoBits);

    // Convert the derived key to an ArrayBuffer and return it
    return sjcl.codec.arrayBuffer.fromBits(derivedKeyBits);
}

// pbkdf2
export function getPbkdf(
    password: ArrayLike,
    salt: ArrayLike,
    iterations: number,
    keylen: number,
    digest: string
): ArrayBuffer {
    // Convert password and salt to bitArrays
    let passwordBits = sjcl.codec.utf8String.toBits(password.toString());
    let saltBits = sjcl.codec.utf8String.toBits(salt.toString());

    // Use sjcl.misc.pbkdf2 to generate the key
    // @ts-ignore
    let derivedKeyBits = sjcl.misc.pbkdf2(passwordBits, saltBits, iterations, keylen * 8, digest);

    // Convert the derived key to an ArrayBuffer and return it
    return sjcl.codec.arrayBuffer.fromBits(derivedKeyBits);
}

export class HashHandle {
    private hash: sjcl.SjclHash;

    public constructor(algorithm: string, xofLen: number) {
        switch (algorithm) {
            case "sha1":
                this.hash = new sjcl.hash.sha1();
                break;
            case "sha256":
                this.hash = new sjcl.hash.sha256();
                break;
            case "sha512":
                this.hash = new sjcl.hash.sha512();
                break;
            default:
                throw new Error(`Unsupported hash algorithm: ${algorithm}`);
        }

        if (xofLen !== 0) {
            throw new Error(`Unsupported xofLen: ${xofLen}`);
        }
    }

    public update(data: Buffer | ArrayBufferView): number {
        let dataBits = sjcl.codec.utf8String.toBits(data.toString());
        this.hash.update(dataBits);
        return this.hash.finalize().length;
    }

    public digest(): ArrayBuffer {
        let digestBits = this.hash.finalize();
        return sjcl.codec.arrayBuffer.fromBits(digestBits);
    }

    public copy(xofLen: number): HashHandle {
        let algo = "";
        let hash = this.hash;
        switch (true) {
            case hash instanceof sjcl.hash.sha1:
                algo = "sha1";
                break;
            case hash instanceof sjcl.hash.sha256:
                algo = "sha256";
                break;
            case hash instanceof sjcl.hash.sha512:
                algo = "sha512";
                break;
            default:
                throw new Error(`Unsupported hash algorithm: ${algo}`);
        }
        let copy = new HashHandle(algo, xofLen); // Replace 'sha256' with the actual algorithm
        copy.hash = this.hash;
        return copy;
    }
}

export class HmacHandle {
    private hmac: sjcl.SjclHMAC;

    public constructor(algorithm: string, key: ArrayLike | CryptoKey) {
        let keyBits = sjcl.codec.utf8String.toBits(key.toString());
        switch (algorithm) {
            case "sha1":
                this.hmac = new sjcl.misc.hmac(keyBits, sjcl.hash.sha1);
                break;
            case "sha256":
                this.hmac = new sjcl.misc.hmac(keyBits, sjcl.hash.sha256);
                break;
            case "sha512":
                this.hmac = new sjcl.misc.hmac(keyBits, sjcl.hash.sha512);
                break;
            default:
                throw new Error(`Unsupported hash algorithm: ${algorithm}`);
        }
    }

    public update(data: Buffer | ArrayBufferView): number {
        let dataBits = sjcl.codec.utf8String.toBits(data.toString());
        this.hmac.update(dataBits);
        return this.hmac.digest().length;
    }

    public digest(): ArrayBuffer {
        let digestBits = this.hmac.digest();
        return sjcl.codec.arrayBuffer.fromBits(digestBits);
    }
}

export interface RsaKeyAlgorithm {
    name: "rsa" | "rsa-pss";
    modulusLength: number;
    publicExponent: Uint8Array;
    hash?: string;
}

export interface EcKeyAlgorithm {
    name: "ec";
    namedCurve: string;
}

export interface DhKeyAlgorithm {
    name: "dh";
    prime: Uint8Array;
    generator: Uint8Array;
}

export interface DsaKeyAlgorithm {
    name: "dsa";
    prime: Uint8Array;
    divisorLength: number;
}

export interface HmacKeyAlgorithm {
    name: "hmac";
    hash: string;
}

export interface AesKeyAlgorithm {
    name: "aes";
    length: number;
}

export type KeyAlgorithm =
    | RsaKeyAlgorithm
    | EcKeyAlgorithm
    | DhKeyAlgorithm
    | DsaKeyAlgorithm
    | HmacKeyAlgorithm
    | AesKeyAlgorithm;

export interface CryptoKey {
    algorithm: KeyAlgorithm;
    extractable: boolean;
    type: KeyObjectType;
    usages: string[];
}

export interface RsaOtherPrimesInfo {
    d?: string;
    r?: string;
    t?: string;
}

export interface JsonWebKey {
    alg?: string;
    crv?: string;
    d?: string;
    dp?: string;
    dq?: string;
    e?: string;
    ext?: boolean;
    k?: string;
    key_ops?: string[];
    kty?: string;
    n?: string;
    oth?: Array<RsaOtherPrimesInfo>;
    p?: string;
    q?: string;
    qi?: string;
    use?: string;
    x?: string;
    y?: string;
}

export interface CryptoKeyPair {
    privateKey: CryptoKey;
    publicKey: CryptoKey;
}

export type KeyObjectType = "secret" | "public" | "private";

export type KeyExportResult = string | Buffer | JsonWebKey;

export type SecretKeyFormat = "buffer" | "jwk";
export type AsymmetricKeyFormat = "pem" | "der" | "jwk";
export type PublicKeyEncoding = "pkcs1" | "spki";
export type PrivateKeyEncoding = "pkcs1" | "pkcs8" | "sec1";
export type AsymmetricKeyType = "rsa" | "rsa-pss" | "dsa" | "ec" | "x25519" | "ed25519" | "dh";
export type SecretKeyType = "hmac" | "aes";
export type ParamEncoding = "named" | "explicit";

export interface SecretKeyExportOptions {
    format?: SecretKeyFormat;
}

export interface PublicKeyExportOptions {
    type?: PublicKeyEncoding;
    format?: AsymmetricKeyFormat;
}

export interface PrivateKeyExportOptions {
    type?: PrivateKeyEncoding;
    format?: AsymmetricKeyFormat;
    cipher?: string;
    passphrase?: string | Uint8Array;
    encoding?: string;
}

export interface InnerPrivateKeyExportOptions {
    type?: PrivateKeyEncoding;
    format?: AsymmetricKeyFormat;
    cipher?: string;
    passphrase?: Uint8Array;
}

export type ExportOptions =
    | SecretKeyExportOptions
    | PublicKeyExportOptions
    | PrivateKeyExportOptions;

export type InnerExportOptions =
    | SecretKeyExportOptions
    | PublicKeyExportOptions
    | InnerPrivateKeyExportOptions;

export interface AsymmetricKeyDetails {
    modulusLength?: number;
    publicExponent?: bigint;
    hashAlgorithm?: string;
    mgf1HashAlgorithm?: string;
    saltLength?: number;
    divisorLength?: number;
    namedCurve?: string;
}

export interface CreateAsymmetricKeyOptions {
    key: string | ArrayBuffer | ArrayBufferView | JsonWebKey;
    format?: AsymmetricKeyFormat;
    type?: PublicKeyEncoding | PrivateKeyEncoding;
    passphrase?: string | Uint8Array;
    encoding?: string;
}

export interface InnerCreateAsymmetricKeyOptions {
    key?: ArrayBuffer | ArrayBufferView | JsonWebKey | CryptoKey;
    format?: AsymmetricKeyFormat;
    type?: PublicKeyEncoding | PrivateKeyEncoding;
    passphrase?: Uint8Array;
}

export interface GenerateKeyOptions {
    length: number;
}

export interface GenerateKeyPairOptions {
    modulusLength?: number;
    publicExponent?: number | bigint;
    hashAlgorithm?: string;
    mgf1HashAlgorithm?: string;
    saltLength?: number;
    divisorLength?: number;
    namedCurve?: string;
    prime?: Uint8Array;
    primeLength?: number;
    generator?: number;
    groupName?: string;
    paramEncoding?: ParamEncoding;
    publicKeyEncoding?: PublicKeyExportOptions;
    privateKeyEncoding?: PrivateKeyExportOptions;
}

export function exportKey(key: CryptoKey, options?: InnerExportOptions): KeyExportResult {
    // SJCL does not provide a direct method to export keys.
    throw new Error("Function exportKey is not implemented yet");
}

export function equals(key: CryptoKey, otherKey: CryptoKey): boolean {
    // SJCL does not provide a direct method to compare keys.
    throw new Error("Function equals is not implemented yet");
}

export function getAsymmetricKeyDetail(key: CryptoKey): AsymmetricKeyDetails {
    // SJCL does not provide a direct method to get asymmetric key details.
    throw new Error("Function getAsymmetricKeyDetail is not implemented yet");
}

export function getAsymmetricKeyType(key: CryptoKey): AsymmetricKeyType {
    // SJCL does not provide a direct method to get asymmetric key type.
    throw new Error("Function getAsymmetricKeyType is not implemented yet");
}

export function createSecretKey(key: ArrayBuffer | ArrayBufferView): CryptoKey {
    let keyArray: Uint8Array;
    if (key instanceof ArrayBuffer) {
        keyArray = new Uint8Array(key);
    } else {
        keyArray = new Uint8Array(key.buffer, key.byteOffset, key.byteLength);
    }

    let keyBits = sjcl.codec.bytes.toBits(Array.from(keyArray));

    let cipher = new sjcl.cipher.aes(keyBits);

    return {
        algorithm: {
            name: "aes",
            length: key.byteLength * 8,
        },
        extractable: true,
        type: "secret",
        usages: ["encrypt", "decrypt"],
    };
}

export function createPrivateKey(key: InnerCreateAsymmetricKeyOptions): CryptoKey {
    // SJCL does not provide a direct method to create private keys.
    throw new Error("Function createPrivateKey is not implemented yet");
}

export function createPublicKey(key: InnerCreateAsymmetricKeyOptions): CryptoKey {
    // SJCL does not provide a direct method to create public keys.
    throw new Error("Function createPublicKey is not implemented yet");
}

export class DiffieHellmanHandle {
    private prime: sjcl.BigNumber;
    private generator: sjcl.BigNumber;
    private privateKey: sjcl.BigNumber;
    private publicKey: sjcl.BigNumber;

    public constructor(
        sizeOrKey: number | ArrayBuffer | ArrayBufferView,
        generator: number | ArrayBuffer | ArrayBufferView
    ) {
        // Convert sizeOrKey and generator to sjcl.bn
        this.prime = new sjcl.bn(sizeOrKey.toString());
        this.generator = new sjcl.bn(generator.toString());

        // Generate a random private key
        this.privateKey = sjcl.bn.random(this.prime.sub(2), 10).add(1);

        // Calculate the public key
        this.publicKey = this.generator.powermod(this.privateKey, this.prime);
    }

    public setPublicKey(data: ArrayBuffer | ArrayBufferView | Buffer): void {
        this.publicKey = new sjcl.bn(data.toString());
    }

    public setPrivateKey(data: ArrayBuffer | ArrayBufferView | Buffer): void {
        this.privateKey = new sjcl.bn(data.toString());
    }

    public getPublicKey(): ArrayBuffer {
        return sjcl.codec.arrayBuffer.fromBits(this.publicKey.toBits());
    }

    public getPrivateKey(): ArrayBuffer {
        return sjcl.codec.arrayBuffer.fromBits(this.privateKey.toBits());
    }

    public getGenerator(): ArrayBuffer {
        return sjcl.codec.arrayBuffer.fromBits(this.generator.toBits());
    }

    public getPrime(): ArrayBuffer {
        return sjcl.codec.arrayBuffer.fromBits(this.prime.toBits());
    }

    public computeSecret(key: ArrayBuffer | ArrayBufferView): ArrayBuffer {
        let otherPublicKey = new sjcl.bn(key.toString());
        let secret = otherPublicKey.powermod(this.privateKey, this.prime);
        return sjcl.codec.arrayBuffer.fromBits(secret.toBits());
    }

    public generateKeys(): ArrayBuffer {
        // Generate a new private key
        this.privateKey = sjcl.bn.random(this.prime.sub(2), 10).add(1);

        // Calculate the new public key
        this.publicKey = this.generator.powermod(this.privateKey, this.prime);

        return this.getPublicKey();
    }

    public getVerifyError(): number {
        // This method is not applicable to the Diffie-Hellman protocol
        throw new Error("Method getVerifyError is not applicable to the Diffie-Hellman protocol");
    }
}

export function DiffieHellmanGroupHandle(name: string): DiffieHellmanHandle {
    // Define some named groups with their prime and generator values
    const groups: { [name: string]: { prime: number; generator: number } } = {
        modp1: { prime: 2, generator: 2 },
        modp2: { prime: 3, generator: 2 },
        modp5: { prime: 5, generator: 2 },
        // Add more named groups here
    };

    // Get the named group
    const group = groups[name];
    if (!group) {
        throw new Error(`Unknown group name: ${name}`);
    }

    // Create a DiffieHellmanHandle with the prime and generator of the named group
    return new DiffieHellmanHandle(group.prime, group.generator);
}
