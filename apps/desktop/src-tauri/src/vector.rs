//! Vector/semantic search stub — mirrors the JS `lib/vector.ts` embedding.
/// Local embedding using hashed TF + synonym groups, no ONNX dependency.
/// This module is the Rust counterpart for `sqlite-vec` hybrid search.
/// A future PR will swap this for `all-MiniLM` via `onnx` + `sqlite-vec`.

use serde::{Deserialize, Serialize};

const DIM: usize = 64;

/// Small synonym groups — must stay in sync with `apps/desktop/src/lib/vector.ts`.
const SYNONYM_GROUPS: &[&[&str]] = &[
    &["vacation", "holiday", "trip", "getaway", "travel"],
    &["car", "automobile", "vehicle", "auto"],
    &["salary", "pay", "wage", "income", "compensation"],
    &["hello", "hi", "hey", "greetings"],
    &["react", "frontend", "ui"],
    &["rust", "cargo", "tauri"],
];

fn hash_token(token: &str) -> u32 {
    let mut h: u32 = 2166136261;
    for b in token.bytes() {
        h ^= b as u32;
        h = h.wrapping_mul(16777619);
    }
    h
}

fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect()
}

/// Deterministic embedding — 64 dims, L2-normalized, synonym-aware.
pub fn embed(text: &str) -> Vec<f32> {
    let mut vec = vec![0f32; DIM];
    let tokens = tokenize(text);
    if tokens.is_empty() {
        return vec;
    }
    for token in tokens {
        let bucket = (hash_token(&token) as usize) % DIM;
        vec[bucket] += 1.0;
        // synonym group boost
        for (gid, group) in SYNONYM_GROUPS.iter().enumerate() {
            if group.contains(&token.as_str()) {
                let group_bucket = (hash_token(&format!("__group_{}", gid)) as usize) % DIM;
                vec[group_bucket] += 1.5;
                let canon = group[0];
                let canon_bucket = (hash_token(canon) as usize) % DIM;
                if canon_bucket != bucket {
                    vec[canon_bucket] += 0.7;
                }
                break;
            }
        }
    }
    let norm: f32 = vec.iter().map(|v| v * v).sum::<f32>().sqrt();
    if norm > 0.0 {
        for v in &mut vec {
            *v /= norm;
        }
    }
    vec
}

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    dot.clamp(-1.0, 1.0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorRow {
    pub message_id: String,
    pub embedding: Vec<f32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embed_is_normalized() {
        let v = embed("hello world");
        let norm: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 1e-5);
    }

    #[test]
    fn synonyms_have_high_similarity() {
        let a = embed("vacation");
        let b = embed("holiday trip");
        assert!(cosine_similarity(&a, &b) > 0.3);
    }

    #[test]
    fn unrelated_have_low_similarity() {
        let a = embed("vacation");
        let b = embed("quantum physics");
        assert!(cosine_similarity(&a, &b) < 0.3);
    }
}
