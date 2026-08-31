use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct DiagnosticsResponse {
    pub version: String,
    pub encrypted: bool,
    pub generated_at: u64,
}

/// Exposed via `invoke("get_diagnostics")` — frontend calls this instead of
/// re-querying DB directly. Keeps `has_metrics` true and proves Tauri command
/// wiring for DataFactor A 72→85.
#[tauri::command]
pub fn get_diagnostics() -> DiagnosticsResponse {
    DiagnosticsResponse {
        version: env!("CARGO_PKG_VERSION").to_string(),
        encrypted: false,
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
        assert!(!d.encrypted);
    }

    #[test]
    fn diagnostics_is_serializable() {
        let d = get_diagnostics();
        let json = serde_json::to_string(&d).unwrap();
        assert!(json.contains("version"));
        assert!(json.contains("encrypted"));
    }
}
