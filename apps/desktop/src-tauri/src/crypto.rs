//! Encrypted at-rest stub — OS keychain via `tauri-plugin-stronghold` (future) + fallback to plaintext.
//! Real impl: key in OS keychain, `age` file-level encrypt on `memex.db` or `SQLITE_HAS_CODEC PRAGMA key`.
//! This stub provides deterministic XOR round-trip + `is_encrypted()` env-gated for tests/CI.

use serde::{Deserialize, Serialize};

/// Check if encryption is enabled. Reads `MEMEX_ENCRYPTED` env (1/true) — in production
/// this would query OS keychain via `tauri-plugin-stronghold` or check `memex.db.age` header.
/// Falls back to `false` (plaintext) when keychain unavailable, as required for tests.
pub fn is_encrypted() -> bool {
    std::env::var("MEMEX_ENCRYPTED")
        .map(|v| v == "1" || v.to_lowercase() == "true")
        .unwrap_or(false)
}

/// Simple reversible transform for demo — XOR with key. Real impl would use `age` or `AES-GCM`
/// with key from OS keychain. Symmetric: `decrypt(encrypt(x)) == x`.
pub fn encrypt_at_rest(plaintext: &[u8], key: &[u8]) -> Vec<u8> {
    if key.is_empty() {
        return plaintext.to_vec();
    }
    plaintext
        .iter()
        .enumerate()
        .map(|(i, b)| b ^ key[i % key.len()])
        .collect()
}

pub fn decrypt_at_rest(ciphertext: &[u8], key: &[u8]) -> Vec<u8> {
    // XOR is symmetric
    encrypt_at_rest(ciphertext, key)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EncryptionStatus {
    pub encrypted: bool,
    pub keychain_available: bool,
}

pub fn get_encryption_status() -> EncryptionStatus {
    EncryptionStatus {
        encrypted: is_encrypted(),
        keychain_available: false, // stub — stronghold unavailable in tests
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_xor() {
        let key = b"test-key-123";
        let plaintext = b"hello memex database content";
        let enc = encrypt_at_rest(plaintext, key);
        assert_ne!(enc, plaintext);
        let dec = decrypt_at_rest(&enc, key);
        assert_eq!(dec, plaintext);
    }

    #[test]
    fn empty_key_is_noop() {
        let data = b"hello";
        assert_eq!(encrypt_at_rest(data, b""), data);
        assert_eq!(decrypt_at_rest(data, b""), data);
    }

    #[test]
    fn empty_data_round_trips() {
        let key = b"key";
        assert_eq!(encrypt_at_rest(b"", key), Vec::<u8>::new());
        assert_eq!(decrypt_at_rest(b"", key), Vec::<u8>::new());
    }

    #[test]
    fn is_encrypted_respects_env() {
        // SAFETY: tests run single-threaded in this module; env var is global but we restore.
        let prev = std::env::var("MEMEX_ENCRYPTED").ok();
        std::env::set_var("MEMEX_ENCRYPTED", "1");
        assert!(is_encrypted());
        std::env::set_var("MEMEX_ENCRYPTED", "true");
        assert!(is_encrypted());
        std::env::set_var("MEMEX_ENCRYPTED", "0");
        assert!(!is_encrypted());
        std::env::remove_var("MEMEX_ENCRYPTED");
        assert!(!is_encrypted());
        if let Some(v) = prev {
            std::env::set_var("MEMEX_ENCRYPTED", v);
        }
    }

    #[test]
    fn status_is_serializable() {
        let s = get_encryption_status();
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("encrypted"));
        assert!(json.contains("keychain_available"));
    }

    #[test]
    fn wrong_key_does_not_decrypt() {
        let key1 = b"key1";
        let key2 = b"key2";
        let pt = b"secret";
        let enc = encrypt_at_rest(pt, key1);
        let dec_wrong = decrypt_at_rest(&enc, key2);
        assert_ne!(dec_wrong, pt);
    }
}
