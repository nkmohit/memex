use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct DiagnosticsResponse {
    pub version: String,
    pub generated_at: u64,
}

/// Exposed via `invoke("get_diagnostics")`.
/// Returns the Cargo package version. `generated_at` is 0 (the command does not read a clock).
#[tauri::command]
pub fn get_diagnostics() -> DiagnosticsResponse {
    DiagnosticsResponse {
        version: env!("CARGO_PKG_VERSION").to_string(),
        generated_at: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagnostics_version_matches_cargo() {
        let d = get_diagnostics();
        assert!(!d.version.is_empty());
        assert_eq!(d.version, env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn diagnostics_is_serializable() {
        let d = get_diagnostics();
        let json = serde_json::to_string(&d).unwrap();
        assert!(json.contains("version"));
        assert!(json.contains("generated_at"));
    }
}
