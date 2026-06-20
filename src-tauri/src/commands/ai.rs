use std::time::Duration;

#[tauri::command]
pub async fn call_ai(
    provider: String,
    api_key: String,
    model: String,
    prompt: String,
    content: String,
    ollama_url: Option<String>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let full_prompt = if content.is_empty() {
        prompt
    } else {
        format!("{}\n\n{}", prompt, content)
    };

    match provider.as_str() {
        "claude" => {
            let body = serde_json::json!({
                "model": model,
                "max_tokens": 4096,
                "messages": [{"role": "user", "content": full_prompt}]
            });
            let response = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| {
                    if e.is_timeout() {
                        "Request timed out after 120 seconds.".to_string()
                    } else {
                        format!("Network error: {}", e)
                    }
                })?;

            if response.status() == 401 {
                return Err("Invalid API key. Please check Settings.".to_string());
            }
            if response.status() == 429 {
                return Err("API quota exceeded or rate limited. Please wait and try again.".to_string());
            }
            if !response.status().is_success() {
                return Err(format!("API error: HTTP {}", response.status()));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Parse error: {}", e))?;
            let text = json["content"][0]["text"]
                .as_str()
                .ok_or("No response text from Claude")?
                .to_string();
            Ok(text)
        }
        "openai" => {
            let body = serde_json::json!({
                "model": model,
                "messages": [{"role": "user", "content": full_prompt}]
            });
            let response = client
                .post("https://api.openai.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| {
                    if e.is_timeout() {
                        "Request timed out after 120 seconds.".to_string()
                    } else {
                        format!("Network error: {}", e)
                    }
                })?;

            if response.status() == 401 {
                return Err("Invalid API key. Please check Settings.".to_string());
            }
            if response.status() == 429 {
                return Err("API quota exceeded or rate limited. Please wait and try again.".to_string());
            }
            if !response.status().is_success() {
                return Err(format!("API error: HTTP {}", response.status()));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Parse error: {}", e))?;
            let text = json["choices"][0]["message"]["content"]
                .as_str()
                .ok_or("No response text from OpenAI")?
                .to_string();
            Ok(text)
        }
        "deepseek" => {
            let body = serde_json::json!({
                "model": model,
                "messages": [{"role": "user", "content": full_prompt}]
            });
            let response = client
                .post("https://api.deepseek.com/chat/completions")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| {
                    if e.is_timeout() {
                        "DeepSeek request timed out.".to_string()
                    } else if e.is_connect() {
                        "Could not connect to DeepSeek API.".to_string()
                    } else {
                        format!("Network error: {}", e)
                    }
                })?;

            if response.status() == 401 {
                return Err("Invalid API key. Please check Settings.".to_string());
            }
            if response.status() == 429 {
                return Err("API quota exceeded or rate limited. Please wait and try again.".to_string());
            }
            if !response.status().is_success() {
                let status = response.status();
                let body_text = response.text().await.unwrap_or_default();
                return Err(format!("DeepSeek API error ({}): {}", status, body_text));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Parse error: {}", e))?;
            let text = json["choices"][0]["message"]["content"]
                .as_str()
                .ok_or("No response text from DeepSeek")?
                .to_string();
            Ok(text)
        }
        "ollama" => {
            let ollama_client = reqwest::Client::builder()
                .timeout(Duration::from_secs(300))
                .build()
                .map_err(|e| format!("Client error: {}", e))?;

            let base_url = ollama_url
                .unwrap_or_else(|| "http://127.0.0.1:11434".to_string());
            let url = format!("{}/api/chat", base_url.trim_end_matches('/'));

            let body = serde_json::json!({
                "model": model,
                "messages": [{"role": "user", "content": full_prompt}],
                "stream": false
            });
            let response = ollama_client
                .post(&url)
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| {
                    if e.is_timeout() {
                        "Ollama request timed out after 5 minutes. The model may still be loading. Try again or use a smaller model.".to_string()
                    } else if e.is_connect() {
                        "Could not connect to Ollama. Is it running? Check with: ollama list".to_string()
                    } else {
                        format!("Network error: {}", e)
                    }
                })?;

            if !response.status().is_success() {
                let status = response.status();
                let body_text = response.text().await.unwrap_or_default();
                return Err(format!("Ollama error (HTTP {}): {}", status, body_text));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Parse error: {}", e))?;
            let text = json["message"]["content"]
                .as_str()
                .ok_or("No response text from Ollama")?
                .to_string();
            Ok(text)
        }
        _ => Err("Unknown provider".to_string()),
    }
}

#[tauri::command]
pub async fn detect_ollama(url: String) -> Result<bool, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    match client.get(format!("{}/api/tags", url.trim_end_matches('/'))).send().await {
        Ok(res) => Ok(res.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn fetch_ollama_models(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let response = client
        .get(format!("{}/api/tags", url.trim_end_matches('/')))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    response.text().await.map_err(|e| format!("Read error: {}", e))
}
