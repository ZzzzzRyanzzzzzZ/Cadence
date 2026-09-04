(function () {
  const CAD = window.CAD;
  const subtle = window.crypto && window.crypto.subtle ? window.crypto.subtle : null;
  const ITERATIONS = 250000;

  function supported() { return !!subtle; }

  function toB64(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function fromB64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function deriveKey(passphrase, salt) {
    const base = await subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encrypt(plaintext, passphrase) {
    if (!subtle) throw new Error("This browser cannot encrypt here. Use a secure (https) connection or localhost.");
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
    return { v: 1, kdf: "PBKDF2-SHA256", iterations: ITERATIONS, salt: toB64(salt), iv: toB64(iv), ciphertext: toB64(ct) };
  }

  async function decrypt(payload, passphrase) {
    if (!subtle) throw new Error("This browser cannot decrypt here. Use a secure (https) connection or localhost.");
    const salt = fromB64(payload.salt);
    const iv = fromB64(payload.iv);
    const key = await deriveKey(passphrase, salt);
    const plain = await subtle.decrypt({ name: "AES-GCM", iv }, key, fromB64(payload.ciphertext));
    return new TextDecoder().decode(plain);
  }

  CAD.crypto = { supported, encrypt, decrypt, ITERATIONS };
})();
